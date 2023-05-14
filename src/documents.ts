import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { bucket } from './index';
import { dbColRefs, dbDocRefs } from './utils/db';
import { ApplicantDocument, ApplicantPage } from './utils/types';
// import { incrementApplicantDocs } from './applicants';
import { updateDashboardCounters } from './dashboards';
import { updateForm } from './forms';
import { updateApplicant } from './applicants';
import { PDFDocument } from 'pdf-lib';

export const onDocStatusUpdate = functions
  .region('asia-southeast2')
  .runWith({
    timeoutSeconds: 300,
    memory: '2GB',
  })
  .firestore.document('companies/{companyId}/documents/{documentId}')
  .onUpdate(async (change, context) => {
    const prevDoc = change.before.data() as ApplicantDocument;
    const newDoc = change.after.data() as ApplicantDocument;
    const docId = context.params.documentId;
    const { formId, companyId, dashboardId, applicantId } = newDoc;
    const INCREMENT = FieldValue.increment(1);
    const DECREMENT = FieldValue.increment(-1);

    try {
      // Get Company
      const companyRef = dbDocRefs.getCompanyRef(companyId);
      const companySnap = await companyRef.get();
      const companyData = companySnap.data();
      if (!companyData) {
        throw new Error('Could not find any company data');
      }

      if (prevDoc.status !== newDoc.status) {
        const status = newDoc.status;
        // Submitted by Applicant
        if (status === 'submitted' && companyData.options.adminCheck) {
          // Add document to Admin Page for checking
          await updateForm(formId, {
            adminCheckDocs: INCREMENT,
          });
        }
        // Accepted by Admin
        if (status === 'admin-checked') {
          if (companyData.options.adminCheck) {
            // Remove document from Admin Page
            await updateForm(formId, {
              adminCheckDocs: DECREMENT,
            });
          }
          // Increase adminAcceptedDocs in applicant
          if (newDoc.isRequired) {
            await updateApplicant(
              { companyId, dashboardId, applicantId },
              {
                adminAcceptedDocs: INCREMENT,
              }
            );
            // Increase Optional docs counter to show action button on dashboard
          } else {
            await updateApplicant(
              { companyId, dashboardId, applicantId },
              {
                unCheckedOptionalDocs: INCREMENT,
              }
            );
          }
          // Increase dashboard actions count
          await updateDashboardCounters(
            companyId,
            dashboardId,
            'actionsCount',
            1
          );
        }
        // Accepted by User
        if (status === 'accepted') {
          // Increase accepted docs in applicant if required
          if (newDoc.isRequired) {
            await updateApplicant(
              { companyId, dashboardId, applicantId },
              {
                acceptedDocs: INCREMENT,
              }
            );
            // Decrease Optional docs counter to hide action button on dashboard
          } else {
            await updateApplicant(
              { companyId, dashboardId, applicantId },
              {
                unCheckedOptionalDocs: DECREMENT,
              }
            );
          }

          // Remove action count from dashboard counter
          await updateDashboardCounters(
            companyId,
            dashboardId,
            'actionsCount',
            -1
          );
          await stitchAndUploadPDF({ id: docId, ...newDoc });
        }
        if (status === 'rejected') {
          // Rejected by Admin
          if (prevDoc.status === 'submitted') {
            // Remove document from Admin Page
            await updateForm(formId, {
              adminCheckDocs: DECREMENT,
            });
          }
          // Rejected by User
          if (prevDoc.status === 'admin-checked') {
            // Decrease adminAcceptedDocs in applicant if required
            if (newDoc.isRequired) {
              await updateApplicant(
                { companyId, dashboardId, applicantId },
                {
                  adminAcceptedDocs: DECREMENT,
                }
              );

              // eslint-disable-next-line max-len
              // Decrease Optional docs counter to hide action button on dashboard
            } else {
              await updateApplicant(
                { companyId, dashboardId, applicantId },
                {
                  unCheckedOptionalDocs: DECREMENT,
                }
              );
            }
            // Decrease dashboard actions count
            await updateDashboardCounters(
              companyId,
              dashboardId,
              'actionsCount',
              -1
            );
          }
        }
        await change.after.ref.update({
          isUpdating: false,
        });
      } else {
        return functions.logger.log('Document status not updated');
      }
    } catch (error) {
      functions.logger.error(error);
    }
  });

export const restitchAndUploadPDF = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/documents/{documentId}')
  .onUpdate(async (change, context) => {
    const newApplicantDocumentWithId = {
      id: change.after.id,
      ...change.after.data(),
    } as ApplicantDocument & { id: string };
    try {
      if (newApplicantDocumentWithId.restitchDocument) {
        await stitchAndUploadPDF(newApplicantDocumentWithId);
        functions.logger.log('Successfully restitched document');
      } else {
        functions.logger.log('Not restitching document');
      }
    } catch (error) {
      functions.logger.error(error);
    } finally {
      const { companyId, id } = newApplicantDocumentWithId;
      const docRef = dbDocRefs.getDocumentRef(companyId, id);
      await docRef.update({
        restitchDocument: false,
      });
      return;
    }
  });

const stitchAndUploadPDF = async (doc: ApplicantDocument & { id: string }) => {
  functions.logger.log('Running stitchAndUploadPDF');
  const pagesRef = dbColRefs.getPagesRef(doc.companyId);
  // eslint-disable-next-line max-len
  const pages = await pagesRef
    .where('docId', '==', doc.id)
    .where('submissionCount', '==', doc.submissionCount)
    .orderBy('pageNumber')
    .get();
  const pagesData = pages.docs.map((page) => page.data());
  functions.logger.log('Pages data', pagesData);
  const mergedDoc = await stitchPDFPages(pagesData);

  const newFileName = doc.updatedName || `${doc.name}.pdf`;
  // eslint-disable-next-line max-len
  const newFilePath = `companies/${doc.companyId}/dashboards/${doc.dashboardId}/final/${doc.applicantId}/${newFileName}`;
  const file = bucket.file(newFilePath);
  await file.save(mergedDoc, {
    metadata: {
      contentType: 'application/pdf',
      contentDisposition: `attachment; filename=${newFileName}`,
    },
  });
  return;
};

export const stitchPDFPages = async (pages: ApplicantPage[]) => {
  functions.logger.log('Running stitchPDFPages');
  const pdfDoc = await PDFDocument.create();
  for (const page of pages) {
    // eslint-disable-next-line max-len
    const filePath = `companies/${page.companyId}/dashboards/${page.dashboardId}/fixed/${page.applicantId}/${page.name}.pdf`;
    const [pdf] = await bucket.file(filePath).download();
    const doc = await PDFDocument.load(pdf);
    const docPages = await pdfDoc.copyPages(doc, doc.getPageIndices());
    docPages.forEach((docPage) => {
      functions.logger.log('Adding page', docPage);
      pdfDoc.addPage(docPage);
    });
  }
  const mergedDoc = await pdfDoc.save();
  const mergedDocBuffer = Buffer.from(mergedDoc);
  return mergedDocBuffer;
};

export const toggleStatusNotApplicable = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/documents/{documentId}')
  .onUpdate(async (change, context) => {
    const prevDoc = change.before.data() as ApplicantDocument;
    const newDoc = change.after.data() as ApplicantDocument;
    const increment = FieldValue.increment(1);
    const decrement = FieldValue.increment(-1);
    const { companyId, dashboardId, applicantId } = newDoc;

    if (
      newDoc.status === 'not-applicable' &&
      prevDoc.status !== 'not-applicable'
    ) {
      const applicantRef = dbDocRefs.getApplicantRef(
        companyId,
        dashboardId,
        applicantId
      );
      await applicantRef.update({
        totalDocs: decrement,
      });
    } else if (
      newDoc.status !== 'not-applicable' &&
      prevDoc.status === 'not-applicable'
    ) {
      const applicantRef = dbDocRefs.getApplicantRef(
        companyId,
        dashboardId,
        applicantId
      );
      await applicantRef.update({
        totalDocs: increment,
      });
    }
  });

export const createDocument = async (
  companyId: string,
  documentData: ApplicantDocument
) => {
  const documentsRef = dbColRefs.getDocumentsRef(companyId);
  await documentsRef.add(documentData);
};

export const updateDocument = async (
  companyId: string,
  documentId: string,
  documentData: Partial<ApplicantDocument>
) => {
  const documentRef = dbDocRefs.getDocumentRef(companyId, documentId);
  await documentRef.update({
    ...documentData,
  });
};

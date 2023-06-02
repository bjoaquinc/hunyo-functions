import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { bucket } from './index';
import { dbColRefs, dbDocRefs } from './utils/db';
import {
  ApplicantDocument,
  ApplicantPage,
  EmailData,
  SendApplicantDocumentRejectionTemplate,
} from './utils/types';
// import { incrementApplicantDocs } from './applicants';
import { updateDashboardCounters } from './dashboards';
import { updateForm } from './forms';
import { updateApplicant } from './applicants';
import { PDFDocument } from 'pdf-lib';
import { getFormLink, getFormattedDate } from './utils/helpers';
import { createMessage } from './messages';
import { storagePaths } from './utils/storage';

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
          // Send Rejection Email to Applicant
          const EMAIL_DATA = await getRejectionMessage({
            id: docId,
            ...newDoc,
          });
          await createMessage({
            messageTypes: companyData.messageTypes,
            emailData: EMAIL_DATA,
          });
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

const getRejectionMessage = async (
  doc: ApplicantDocument & { id: string }
): Promise<EmailData> => {
  const { companyId, dashboardId, applicantId, formId } = doc;

  // Get Applicant
  const applicantRef = dbDocRefs.getApplicantRef(
    companyId,
    dashboardId,
    applicantId
  );
  const applicantSnap = await applicantRef.get();
  const applicantData = applicantSnap.data();
  if (!applicantData || !applicantData.name) {
    throw new Error('Could not find any applicant data');
  }

  // Get Company
  const companyRef = dbDocRefs.getCompanyRef(companyId);
  const companySnap = await companyRef.get();
  const companyData = companySnap.data();
  if (!companyData) {
    throw new Error('Could not find any company data');
  }

  // Get Dashboard
  const dashboardRef = dbDocRefs.getPublishedDashboardRef(
    companyId,
    dashboardId
  );
  const dashboardSnap = await dashboardRef.get();
  const dashboardData = dashboardSnap.data();
  if (!dashboardData) {
    throw new Error('Could not find any dashboard data');
  }

  // Get email data
  const SUBJECT = `Action Required: Please resubmit ${doc.alias || doc.name}`;
  const FROM_NAME = companyData.name;
  const BODY = `Dear ${applicantData.name.first},<br><br>
  We are unable to accept your document. Please resubmit your document.<br><br>
  Thank you,<br>
  ${companyData.name}`;
  const FORM_LINK = getFormLink(formId);
  const FORMATTED_DEADLINE = getFormattedDate(dashboardData.deadline);

  const TEMPLATE_DATA: SendApplicantDocumentRejectionTemplate = {
    name: 'Applicant Reject Email',
    data: {
      formLink: FORM_LINK,
      documentName: doc.alias || doc.name,
      companyName: companyData.name,
      companyDeadline: FORMATTED_DEADLINE,
      applicantName: applicantData.name.first,
    },
  };

  return {
    subject: SUBJECT,
    recipients: [
      {
        email: applicantData.email,
        type: 'to',
      },
    ],
    fromName: FROM_NAME,
    body: BODY,
    template: TEMPLATE_DATA,
  };
};

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
      functions.logger.debug('Error stiching document', error);
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
    let DOC_FOLDER: 'fixed' | 'originals';
    if (page.submittedFormat === 'application/pdf') {
      DOC_FOLDER = 'originals';
    } else {
      DOC_FOLDER = 'fixed';
    }
    // eslint-disable-next-line max-len
    const filePath = `companies/${page.companyId}/dashboards/${page.dashboardId}/${DOC_FOLDER}/${page.applicantId}/${page.name}.pdf`;
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

export const updateFinalDocumentName = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/documents/{documentId}')
  .onUpdate(async (change, context) => {
    try {
      const newDocument = change.after.data() as ApplicantDocument;
      const prevDocument = change.before.data() as ApplicantDocument;
      if (
        newDocument.updatedName !== prevDocument.updatedName &&
        newDocument.status === 'accepted'
      ) {
        const { companyId, dashboardId, applicantId, updatedName } =
          newDocument;
        const { updatedName: prevUpdatedName } = prevDocument;
        if (!updatedName || !prevUpdatedName) {
          throw new Error('Updated name is not defined');
        }
        const prevFilePath = storagePaths.getFinalDocPath(
          companyId,
          dashboardId,
          applicantId,
          prevUpdatedName
        );
        const newFilePath = storagePaths.getFinalDocPath(
          companyId,
          dashboardId,
          applicantId,
          updatedName
        );
        const finalDocumentRef = bucket.file(prevFilePath);
        await finalDocumentRef.setMetadata({
          contentDisposition: `attachment; filename="${updatedName}"`,
        });
        await finalDocumentRef.rename(newFilePath);
      }
    } catch (error) {
      functions.logger.error('Error updating final document name', error);
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

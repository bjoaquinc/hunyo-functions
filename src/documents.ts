import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
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
    const INCREMENT = admin.firestore.FieldValue.increment(1);
    const DECREMENT = admin.firestore.FieldValue.increment(-1);

    if (prevDoc.status !== newDoc.status) {
      const status = newDoc.status;
      // Submitted by Applicant
      if (status === 'submitted') {
        // Add document to Admin Page for checking
        await updateForm(formId, {
          adminCheckDocs: INCREMENT,
        });
      }
      // Accepted by Admin
      if (status === 'admin-checked') {
        // Remove document from Admin Page
        await updateForm(formId, {
          adminCheckDocs: DECREMENT,
        });
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
  });

// export const updateDocumentStatusToAdminChecked = functions
//   .region('asia-southeast2')
//   .firestore.document('companies/{companyId}/documents/{documentId}')
//   .onUpdate(async (change, context) => {
//     const oldDoc = change.before.data() as ApplicantDocument;
//     const newDoc = change.after.data() as ApplicantDocument;
//     const { companyId, dashboardId, applicantId } = newDoc;

//     if (
//       newDoc.status === 'submitted' &&
//       newDoc.totalPages === newDoc.adminAcceptedPages &&
//       oldDoc.totalPages > oldDoc.adminAcceptedPages
//     ) {
//       const applicantDocRef = change.after.ref;
//       await applicantDocRef.update({
//         status: 'admin-checked',
//       });
//       await incrementApplicantDocs(
//         {
//           companyId,
//           dashboardId,
//           applicantId,
//         },
//         'adminAcceptedDocs',
//         1
//       );
//       await updateDashboardCounters(
//         companyId,
//         dashboardId,
//         'actionsCount',
//         1
//       );
//       return functions.logger.log(
//         'Successfully updated applicant document status to admin-checked'
//       );
//     }
//   });

// export const updateDocumentStatusToAccepted = functions
//   .region('asia-southeast2')
//   .firestore.document('companies/{companyId}/documents/{documentId}')
//   .onUpdate(async (change, context) => {
//     const prevDoc = change.before.data() as ApplicantDocument;
//     const newDoc = change.after.data() as ApplicantDocument;
//     const docId = context.params.documentId;

//     if (
//       newDoc.status === 'admin-checked' &&
//       newDoc.totalPages === newDoc.acceptedPages &&
//       prevDoc.totalPages > prevDoc.acceptedPages
//     ) {
//       const { companyId, dashboardId, applicantId } = newDoc;
//       const applicantDocRef = change.after.ref;
//       await applicantDocRef.update({
//         status: 'accepted',
//       });
//       await incrementApplicantDocs(
//         {
//           companyId,
//           dashboardId,
//           applicantId,
//         },
//         'acceptedDocs',
//         1
//       );
//       await stitchAndUploadPDF({ id: docId, ...newDoc });
//       return functions.logger.log(
//         'Successfully updated applicant document status to accepted'
//       );
//     }
//   });

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
  const file = admin.storage().bucket().file(newFilePath);
  await file.save(mergedDoc, {
    metadata: {
      contentType: 'application/pdf',
      contentDisposition: `attachment; filename=${newFileName}`,
    },
  });
};

export const stitchPDFPages = async (pages: ApplicantPage[]) => {
  functions.logger.log('Running stitchPDFPages');
  const pdfDoc = await PDFDocument.create();
  for (const page of pages) {
    // eslint-disable-next-line max-len
    const filePath = `companies/${page.companyId}/dashboards/${page.dashboardId}/fixed/${page.applicantId}/${page.name}.pdf`;
    const [pdf] = await admin.storage().bucket().file(filePath).download();
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
    const increment = admin.firestore.FieldValue.increment(1);
    const decrement = admin.firestore.FieldValue.increment(-1);
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

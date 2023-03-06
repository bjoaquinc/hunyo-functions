// import * as functions from 'firebase-functions';
// import * as admin from 'firebase-admin';
// import {
//   AdminCheck,
//   AdminCheckDoc,
//   AdminCheckPage,
//   DocRejection,
//   FormDoc,
//   UpdatedForm,
//   WorkerDoc,
// } from '../../src/utils/types';
// import { createAdminCheck, updateAdminCheck } from './admin';
// import { updateForm } from './forms';
// import { dbColRefs } from './utils/db';
// import { Timestamp } from 'firebase/firestore';
// import { createWorkerDocument } from './documents';
// import { createAction } from './actions';
// import { updateApplicant } from './applicants';
// import { incrementDashboardCounters } from './dashboards';
// import { createRejectionPages } from './rejections';

// // FORM TASKS

// export const formTaskManager = functions
//   .region('asia-southeast2')
//   .firestore.document('forms/{formId}')
//   .onUpdate(async (change, context) => {
//     const formId = context.params.formId;
//     const form = { id: formId, ...change.after.data() } as UpdatedForm & {
//       id: string;
//     };

//     for (const docId of Object.keys(form.docs)) {
//       const doc = {
//         id: docId,
//         data: form.docs[docId],
//       };
//       const hasFormTask = doc.data.systemTask !== null;
//       if (hasFormTask && systemHasCheckedDocPages(doc.data)) {
//         // Remove system task
//         await updateForm(formId, {
//           [`docs.${docId}.systemTask`]: null,
//         });
//         // Perform system task
//         const adminCheckId = await getAdminCheckId(form);
//         const systemTask = doc.data.systemTask as string;
//         await formWorkers[systemTask](adminCheckId, doc);
//       }
//     }
//   });

// const formWorkers: {
//   [key: string]: (
//     adminCheckId: string,
//     doc: {
//       id: string;
//       data: FormDoc;
//     }
//   ) => Promise<void>;
// } = {
//   createDoc: async (adminCheckId, doc) => {
//     const updatedDoc = turnFormDocIntoAdminCheckDoc(doc.data);
//     await updateAdminCheck(adminCheckId, {
//       [`docs.${doc.id}`]: updatedDoc,
//       isChecked: false,
//     });
//   },
// };

// const getAdminCheckId = async (form: UpdatedForm & { id: string }) => {
//   const adminCheckRef = dbColRefs.adminChecksRef;
//   const adminCheckSnapshots = await adminCheckRef
//     .where('applicant.id', '==', form.applicant.id)
//     .get();
//   if (adminCheckSnapshots.empty) {
//     const adminCheckId = createAdminCheck({
//       createdAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
//       applicant: form.applicant,
//       companyId: form.company.id,
//       dashboard: form.dashboard,
//       formId: form.id,
//       docs: {},
//       isChecked: false,
//     });
//     return adminCheckId;
//   } else {
//     const adminCheck = adminCheckSnapshots.docs[0];
//     return adminCheck.id;
//   }
// };

// const turnFormDocIntoAdminCheckDoc = (doc: FormDoc): AdminCheckDoc => {
//   const updatedDoc = {
//     adminCheckStatus: 'Not Checked',
//     ...doc,
//   } as AdminCheckDoc;
//   updatedDoc.systemTask = null;
//   return updatedDoc;
// };

// const systemHasCheckedDocPages = (doc: FormDoc) => {
//   if (!doc.pages) return false;
//   for (const pageId of Object.keys(doc.pages)) {
//     if (!doc.pages[pageId].systemCheckStatus) {
//       return false;
//     }
//   }
//   return true;
// };

// // ADMIN TASKS

// export const adminTaskManager = functions
//   .region('asia-southeast2')
//   .firestore.document('adminChecks/{adminCheckId}')
//   .onUpdate(async (change, context) => {
//     const adminCheckId = context.params.adminCheckId;
//     const adminCheck = {
//       id: adminCheckId,
//       ...change.after.data(),
//     } as AdminCheck & {
//       id: string;
//     };

//     for (const docId of Object.keys(adminCheck.docs)) {
//       const doc = {
//         id: docId,
//         data: adminCheck.docs[docId],
//       };
//       const hasAdminWorkerTask = doc.data.systemTask !== null;
//       if (hasAdminWorkerTask) {
//         functions.logger.log('Admin Task is Running');
//         // Remove system task
//         await updateAdminCheck(adminCheckId, {
//           [`docs.${docId}.systemTask`]: null,
//         });
//         // Perform system task
//         const systemTask = doc.data.systemTask as string;
//         await adminWorkers[systemTask](doc, adminCheck);
//       }
//     }
//   });

// const adminWorkers: {
//   [key: string]: (
//     doc: { id: string; data: AdminCheckDoc },
//     adminCheck: AdminCheck & {
//       id: string;
//     }
//   ) => Promise<void>;
// } = {
//   acceptDoc: async (doc, adminCheck) => {
//     try {
//       const { companyId, dashboard, formId, applicant } = adminCheck;
//       const workerDoc = turnAdminCheckDocIntoWorkerDoc(
//         {
//           adminCheckId: adminCheck.id,
//           companyId: companyId,
//           dashboardId: dashboard.id,
//           applicantId: applicant.id,
//           formId: formId,
//         },
//         doc.data
//       );
//       await createWorkerDocument(companyId, dashboard.id, doc.id, workerDoc);
//       const actionRef = await createAction(companyId, {
//         createdAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
//         applicant,
//         workerDocId: doc.id,
//         doc: workerDoc,
//         isComplete: false,
//       });
//       await updateApplicant(
//         {
//           companyId,
//           dashboardId: dashboard.id,
//           applicantId: applicant.id,
//         },
//         {
//           actions: admin.firestore.FieldValue.arrayUnion({
//             id: actionRef.id,
//             type: 'verifyDocuments',
//           }),
//           docIds: admin.firestore.FieldValue.arrayUnion(doc.id),
//         }
//       );
//       await incrementDashboardCounters(
//         companyId,
//         dashboard.id,
//         'actionsCount',
//         1
//       );
//     } catch (error) {
//       functions.logger.log(error);
//     }
//   },
//   rejectPages: async (doc, adminCheck) => {
//     try {
//       const rejectedPages: (AdminCheckPage & {
//         id: string;
//       })[] = [];
//       Object.keys(doc.data.pages).forEach((pageId) => {
//         const page = doc.data.pages[pageId];
//         if (
//           page.adminCheckStatus &&
//           page.adminCheckStatus === 'Rejected' &&
//           page.rejection
//         ) {
//           rejectedPages.push({ id: pageId, ...page });
//         }
//       });

//       await createRejectionPages({
//         createdAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
//         companyId: adminCheck.companyId,
//         dashboardId: adminCheck.dashboard.id,
//         applicantId: adminCheck.applicant.id,
//         formId: adminCheck.formId,
//         docId: doc.id,
//         pages: rejectedPages,
//         rejectionData: doc.data.rejection as DocRejection,
//       });
//     } catch (error) {
//       functions.logger.log(error);
//     }
//   },
// };

// const turnAdminCheckDocIntoWorkerDoc = (
//   ids: {
//     adminCheckId: string;
//     companyId: string;
//     dashboardId: string;
//     applicantId: string;
//     formId: string;
//   },
//   adminCheckDoc: AdminCheckDoc
// ) => {
//   const { adminCheckId, companyId, dashboardId, applicantId, formId } = ids;
//   const workerDoc: WorkerDoc = {
//     createdAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
//     adminCheckId,
//     companyId,
//     dashboardId,
//     applicantId,
//     formId,
//     ...adminCheckDoc,
//   };
//   return workerDoc;
// };

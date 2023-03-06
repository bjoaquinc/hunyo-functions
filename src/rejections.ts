// import * as functions from 'firebase-functions';
// import { RejectionPages } from '../../src/utils/types';
// import { updateForm } from './forms';
// import { dbColRefs } from './utils/db';

// export const onCreateRejection = functions
//   .region('asia-southeast2')
//   .firestore.document('rejections/{rejectionId}')
//   .onCreate(async (snap, context) => {
//     // TODO: Update applicant form with rejected pages
//     const rejection = snap.data() as RejectionPages;
//     if (rejection.rejectionData.code === 'rejectPages') {
//       const formId = rejection.formId;
//       const updatedData: { [key: string]: any } = {};
//       const DOC_COMPUTED_KEY = `docs.${rejection.docId}`;
//       rejection.pages.forEach((page) => {
//         const PAGE_COMPUTED_KEY = `${DOC_COMPUTED_KEY}.pages.${page.id}`;
//         updatedData[`${PAGE_COMPUTED_KEY}.status`] = 'Rejected';
//         updatedData[`${PAGE_COMPUTED_KEY}.rejection`] = page.rejection;
//       });
//       updatedData[`${DOC_COMPUTED_KEY}.status`] = 'Rejected';
//       updatedData[`${DOC_COMPUTED_KEY}.rejection`] = rejection.rejectionData;
//       functions.logger.log('updatedData', updatedData);
//       await updateForm(formId, {
//         ...updatedData,
//       });
//     }
//   });

// export const createRejectionPages = async (rejectionData: RejectionPages) => {
//   const rejectionsPagesRef = dbColRefs.rejectionsPagesRef;
//   await rejectionsPagesRef.add(rejectionData);
// };

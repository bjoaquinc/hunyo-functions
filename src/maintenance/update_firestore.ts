// import * as functions from 'firebase-functions';
// import * as admin from 'firebase-admin';
// import { dbColRefs } from '../utils/db';

// export const updateFirestore = functions
//   .region('asia-southeast2')
//   .pubsub.schedule('45 17 19 * *')
//   .timeZone('Asia/Manila')
//   .onRun(async (context) => {
//     functions.logger.log('Running cron job');
//     const docCol = dbColRefs.getDocumentsRef('s8wSwN8DfmMzeoXd1i4k');
//     try {
//       const docSnaps = await docCol.get();
//       functions.logger.log('is it empty?: ', docSnaps.empty);
//       const promises: Promise<FirebaseFirestore.WriteResult>[] = [];
//       docSnaps.forEach((doc) => {
//         const data = doc.data();
// eslint-disable-next-line max-len
//         functions.logger.log(`got data for ${data.name} ${data.applicantId}`);
//         let promise;
//         if (
//           data.status === 'accepted' ||
//           data.status === 'submitted' ||
//           data.status === 'admin-checked'
//         ) {
//           promise = doc.ref.update({
//             submissionCount: 1,
//           });
//         } else if (data.status === 'rejected') {
//           promise = doc.ref.update({
//             submissionCount: 1,
//             rejection: {
//               reasons: ['other'],
//               rejectedBy: 'admin',
//               rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
//               message: 'Please resubmit.',
//             },
//           });
//         } else {
//           promise = doc.ref.update({
//             submissionCount: 0,
//           });
//         }
//         promises.push(promise);
//       });
//       await Promise.all(promises);
//       functions.logger.log('Successfully updated all docs');
//     } catch (err) {
//       functions.logger.error(err);
//     }
//   });

// export const addCreatedAtToForms = functions
//   .region('asia-southeast2')
//   .pubsub.schedule('55 18 21 * *')
//   .timeZone('Asia/Manila')
//   .onRun(async (context) => {
//     functions.logger.log('Running cron job');
//     const formsRef = dbColRefs.formsRef;
//     try {
//       const formsSnap = await formsRef.get();
//       functions.logger.log('is it empty?: ', formsSnap.empty);
//       for (const form of formsSnap.docs) {
//         functions.logger.log(`Updating data for form ${form.id}`);
//         await form.ref.update({
//           createdAt: admin.firestore.FieldValue.serverTimestamp(),
//         });
//         await new Promise((resolve) => setTimeout(resolve, 100));
//       }
//       functions.logger.log('Successfully added createdAt to all forms');
//     } catch (err) {
//       functions.logger.error(err);
//     }
//   });

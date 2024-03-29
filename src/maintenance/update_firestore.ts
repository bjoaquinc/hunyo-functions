import { error } from 'firebase-functions/logger';
import * as functions from 'firebase-functions';
import { bucket } from '../index';
import { CustomMetadata, triggerOnImageUpload } from '../manage-files';
// import * as admin from 'firebase-admin';
// import { dbColRefs, dbDocRefs } from '../utils/db';

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

// export const addFormIdsToApplicant = functions
//   .region('asia-southeast2')
//   .pubsub.schedule('45 13 27 * *')
//   .timeZone('Asia/Manila')
//   .onRun(async (context) => {
//     functions.logger.log('Running cron job');
//     const formsRef = dbColRefs.formsRef;
//     try {
//       const formsSnap = await formsRef.get();
//       functions.logger.log('is it empty?: ', formsSnap.empty);
//       for (const form of formsSnap.docs) {
//         const { company, dashboard, applicant } = form.data();
//         const applicantRef = dbDocRefs.getApplicantRef(
//           company.id,
//           dashboard.id,
//           applicant.id
//         );
//         const applicantSnap = await applicantRef.get();
//         if (applicantSnap.exists) {
//           // Handle if it exists
//           await applicantRef.update({
//             formId: form.id,
//           });
//           functions.logger.log(
//             `Successfully updated ${applicant.email} with id ${applicant.id}`
//           );
//         } else {
//           functions.logger.log(`${applicant.email} does not exist`);
//         }
//       }
//       return functions.logger.log(
//         'Successfully added formId to all applicants'
//       );
//     } catch (err) {
//       return functions.logger.error(err);
//     }
//   });

export const fixImageUpload = functions
  .region('asia-southeast2')
  .runWith({
    timeoutSeconds: 400,
    memory: '4GB',
    secrets: ['SITE_ENGINE_API_SECRET', 'SITE_ENGINE_API_USER'],
  })
  .pubsub.schedule('45 17 19 * *')
  .timeZone('Asia/Manila')
  .onRun(async (context) => {
    try {
      // Get temporary docs
      const temporaryStoragePath = 'temporary-docs/';
      const [files] = await bucket.getFiles({
        prefix: temporaryStoragePath,
      });
      // loop through files and move them to the correct path
      const promises: Promise<void>[] = [];
      for (const file of files) {
        const filePath = file.name;
        const contentType = (file.metadata as { [key: string]: string })
          .contentType;
        const metadata = await file.getMetadata();
        const customMetadata = (
          metadata[0] as { [key: string]: CustomMetadata }
        ).metadata;
        const promise = triggerOnImageUpload(
          filePath,
          contentType,
          customMetadata
        );
        promises.push(promise);
      }
      await Promise.all(promises);
      functions.logger.log('Successfully moved all files');
    } catch (err) {
      error(err);
    }
  });

import { AdminCheck } from '../../src/utils/types';
import { dbColRefs, dbDocRefs } from './utils/db';

export const createAdminCheck = async (adminCheckData: AdminCheck) => {
  const adminChecksRef = dbColRefs.adminChecksRef;
  const adminCheckRef = await adminChecksRef.add(adminCheckData);
  return adminCheckRef.id;
};

export const updateAdminCheck = async (
  adminCheckId: string,
  adminCheckData: Partial<AdminCheck> | { [key: string]: any }
) => {
  const adminCheckRef = dbDocRefs.getAdminCheckRef(adminCheckId);
  await adminCheckRef.update(adminCheckData);
};

// export const onCheck = functions.firestore
//   .document('forms/{formId}')
//   .onUpdate((change, context) => {
//     const prevFormData = change.before.data() as Form;
//     const newFormData = change.after.data() as Form;

//     for (let index = 0; index < Object.keys(newFormData.docs).length; index++) {
//       if (isChecked(prevFormData.docs[index], newFormData.docs[index])) {
//         // Do the stuff
//         const status = newFormData.docs[index]
//           .adminCheckStatus as AdminCheckStatus;
//         if (status === 'Accepted') {
//           onAccepted();
//         }

//         if (status === 'Rejected') {
//           onRejected();
//         }
//       }
//     }
//   });

// const isChecked = (prevDoc: FormDoc, newDoc: FormDoc) =>
//   !prevDoc.adminCheckStatus && newDoc.adminCheckStatus ? true : false;

// const onAccepted = () => {
//   // Update Applicant Item
//   // Send documents
//   // update applicant status
//   // increment dashboard counters incomplete and actions
//   // create action required to verify docs
// };

// const onRejected = () => {
//   functions.logger.log('rejected');
// };

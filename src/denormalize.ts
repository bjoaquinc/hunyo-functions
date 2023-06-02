import * as functions from 'firebase-functions';
import { FieldValue, WriteResult } from 'firebase-admin/firestore';

import { db } from './index';
import {
  ApplicantWithData,
  Company,
  User,
  ApplicantStatus,
} from './utils/types';
import { dbColRefs, dbDocRefs } from './utils/db';
import { deepEquals, getUpdatedDocName } from './utils/helpers';

export const addUserToCompany = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/users/{userId}')
  .onCreate(async (snapshot) => {
    const userData = snapshot.data() as User;
    const companyRef = db.collection('companies').doc(userData.company.id);
    const companyDoc = await companyRef.get();
    const companyData = companyDoc.data() as Company | null;
    if (!companyData) {
      return functions.logger.log('No company exists.');
    } else {
      if (!companyData.users.includes(snapshot.id)) {
        await companyRef.update({
          users: FieldValue.arrayUnion(snapshot.id),
        });
        return functions.logger.log(
          `Added ${userData.name.first} ${userData.name.last} to company list.`
        );
      } else {
        return functions.logger.log('User already added to company');
      }
    }
  });

export const denormalizeApplicantData = functions
  .region('asia-southeast2')
  .firestore.document(
    'companies/{companyId}/dashboards/{dashboardId}/applicants/{applicantId}'
  )
  .onUpdate(async (change, context) => {
    try {
      const prevApplicant = change.before.data() as ApplicantWithData;
      const newApplicant = change.after.data() as ApplicantWithData;
      // TODO: Check if applicants name was updated
      const { companyId, applicantId } = context.params;
      const {
        name: prevName,
        phoneNumbers: prevPhoneNumbers,
        email: prevEmail,
      } = prevApplicant;
      const { name, phoneNumbers, email } = newApplicant;
      const updatedApplicantData: {
        id: string;
        status: ApplicantStatus;
        email: string;
        name?: {
          first: string;
          middle: string;
          last: string;
        };
        phoneNumbers?: {
          primary: string;
          secondary: string;
        };
      } = {
        id: applicantId,
        status: newApplicant.status,
        name: name,
        phoneNumbers: phoneNumbers,
        email: email,
        // address: address,
      };
      let hasChanges = false;

      if (!deepEquals(prevName, name)) {
        // Manage different names
        updatedApplicantData.name = name;

        // Update doc names
        const docsRef = dbColRefs.getDocumentsRef(companyId);
        const docsSnap = await docsRef
          .where('applicantId', '==', applicantId)
          .get();
        if (!docsSnap.empty) {
          const promises: Promise<WriteResult>[] = [];
          docsSnap.forEach((doc) => {
            const docData = doc.data();
            const updatedDocName = getUpdatedDocName(docData.name, name);
            const promise = doc.ref.update({
              updatedName: updatedDocName,
            });
            promises.push(promise);
          });
          await Promise.all(promises);
        }
        hasChanges = true;
      }

      if (!deepEquals(prevPhoneNumbers, phoneNumbers)) {
        // Manage different phone numbers
        updatedApplicantData.phoneNumbers = phoneNumbers;
        hasChanges = true;
      }

      if (email !== prevEmail) {
        // Manage different emails
        updatedApplicantData.email = email;
        hasChanges = true;
      }

      // if (address !== prevAddress) {
      //   // Manage different addresses
      //   updatedApplicantData.address = address;
      //   hasChanges = true;
      // }

      // Update applicant data in form
      if (hasChanges) {
        const formRef = dbDocRefs.getFormRef(newApplicant.formId);
        await formRef.update({
          applicant: {
            ...updatedApplicantData,
          },
        });
      }
    } catch (error) {
      functions.logger.error('Error denormalizing applicant data', error);
    }
  });

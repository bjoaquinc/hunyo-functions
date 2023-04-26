import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import { db } from './index';
import { Company, User } from './utils/types';

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
          users: admin.firestore.FieldValue.arrayUnion(snapshot.id),
        });
        return functions.logger.log(
          `Added ${userData.name.first} ${userData.name.last} to company list.`
        );
      } else {
        return functions.logger.log('User already added to company');
      }
    }
  });

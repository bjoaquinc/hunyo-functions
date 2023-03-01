import * as functions from 'firebase-functions';

import { db } from './index';

export const addCompanyUserRole = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/users/{userId}')
  .onCreate(async (snapshot, context) => {
    const companyId = context.params.companyId;
    const userId = snapshot.id;
    const privateDataRef = db
      .collection('companies')
      .doc(companyId)
      .collection('privateData')
      .doc('private');
    const privateDataSnapshot = await privateDataRef.get();
    const privateData = privateDataSnapshot.data() as {
      roles: { [key: string]: string };
    };
    let roles: { [key: string]: string } = {};
    if (privateData) {
      roles = { ...privateData.roles };
      roles[userId] = 'editor';
    } else {
      roles[userId] = 'admin';
    }
    await privateDataRef.set({
      roles,
    });
    functions.logger.log(`Successfully set the role of user with id ${userId}`);
  });

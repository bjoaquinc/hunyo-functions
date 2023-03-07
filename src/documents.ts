import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { dbColRefs } from './utils/db';
import { ApplicantDocument } from '../../src/utils/new-types';

export const updateDocumentStatusToAdminChecked = functions.firestore
  .document('companies/{companyId}/documents/{documentId}')
  .onUpdate(async (change, context) => {
    const oldDoc = change.before.data() as ApplicantDocument;
    const newDoc = change.after.data() as ApplicantDocument;

    if (
      newDoc.status === 'submitted' &&
      newDoc.totalPages === newDoc.adminAcceptedPages &&
      oldDoc.totalPages > newDoc.adminAcceptedPages
    ) {
      const applicantDocRef = change.after
        .ref as admin.firestore.DocumentReference<ApplicantDocument>;
      await applicantDocRef.update({
        status: 'admin-checked',
      });
      return functions.logger.log(
        'Successfully updated applicant document status to admin-checked'
      );
    }
  });

export const createDocument = async (
  companyId: string,
  documentData: ApplicantDocument
) => {
  const documentsRef = dbColRefs.getDocumentsRef(companyId);
  await documentsRef.add(documentData);
};

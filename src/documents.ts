import * as functions from 'firebase-functions';
import { dbColRefs } from './utils/db';
import { ApplicantDocument } from '../../src/utils/new-types';
import { incrementApplicantDocs } from './applicants';
import { decrementFormAdminCheckDocs } from './forms';
import { incrementDashboardCounters } from './dashboards';

export const updateDocumentStatusToAdminChecked = functions.firestore
  .document('companies/{companyId}/documents/{documentId}')
  .onUpdate(async (change, context) => {
    const oldDoc = change.before.data() as ApplicantDocument;
    const newDoc = change.after.data() as ApplicantDocument;
    const { companyId, dashboardId, applicantId } = newDoc;

    if (
      newDoc.status === 'submitted' &&
      newDoc.totalPages === newDoc.adminAcceptedPages &&
      oldDoc.totalPages > oldDoc.adminAcceptedPages
    ) {
      const applicantDocRef = change.after.ref;
      await applicantDocRef.update({
        status: 'admin-checked',
      });
      await incrementApplicantDocs(
        {
          companyId,
          dashboardId,
          applicantId,
        },
        'adminAcceptedDocs',
        1
      );
      await incrementDashboardCounters(
        companyId,
        dashboardId,
        'actionsCount',
        1
      );
      await decrementFormAdminCheckDocs(newDoc.formId);
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

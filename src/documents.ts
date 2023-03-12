import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { dbColRefs, dbDocRefs } from './utils/db';
import { ApplicantDocument } from '../../src/utils/new-types';
import { incrementApplicantDocs } from './applicants';
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
      return functions.logger.log(
        'Successfully updated applicant document status to admin-checked'
      );
    }
  });

export const decrementUserActionsCount = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/documents/{documentId}')
  .onUpdate(async (change, context) => {
    const prevDoc = change.before.data() as ApplicantDocument;
    const newDoc = change.after.data() as ApplicantDocument;

    if (
      prevDoc.status === 'admin-checked' &&
      (newDoc.status === 'accepted' || newDoc.status === 'rejected')
    ) {
      const { companyId, dashboardId } = newDoc;
      await incrementDashboardCounters(
        companyId,
        dashboardId,
        'actionsCount',
        -1
      );
    }
  });

export const updateDocumentStatusToAccepted = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/documents/{documentId}')
  .onUpdate(async (change, context) => {
    const prevDoc = change.before.data() as ApplicantDocument;
    const newDoc = change.after.data() as ApplicantDocument;

    if (
      newDoc.status === 'admin-checked' &&
      newDoc.totalPages === newDoc.acceptedPages &&
      prevDoc.totalPages > prevDoc.acceptedPages
    ) {
      const { companyId, dashboardId, applicantId } = newDoc;
      const applicantDocRef = change.after.ref;
      await applicantDocRef.update({
        status: 'accepted',
      });
      await incrementApplicantDocs(
        {
          companyId,
          dashboardId,
          applicantId,
        },
        'acceptedDocs',
        1
      );
      return functions.logger.log(
        'Successfully updated applicant document status to accepted'
      );
    }
  });

export const toggleStatusNotApplicable = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/documents/{documentId}')
  .onUpdate(async (change, context) => {
    const prevDoc = change.before.data() as ApplicantDocument;
    const newDoc = change.after.data() as ApplicantDocument;
    const increment = admin.firestore.FieldValue.increment(1);
    const decrement = admin.firestore.FieldValue.increment(-1);
    const { companyId, dashboardId, applicantId } = newDoc;

    if (
      newDoc.status === 'not-applicable' &&
      prevDoc.status !== 'not-applicable'
    ) {
      const applicantRef = dbDocRefs.getApplicantRef(
        companyId,
        dashboardId,
        applicantId
      );
      await applicantRef.update({
        totalDocs: decrement,
      });
    } else if (
      newDoc.status !== 'not-applicable' &&
      prevDoc.status === 'not-applicable'
    ) {
      const applicantRef = dbDocRefs.getApplicantRef(
        companyId,
        dashboardId,
        applicantId
      );
      await applicantRef.update({
        totalDocs: increment,
      });
    }
  });

export const createDocument = async (
  companyId: string,
  documentData: ApplicantDocument
) => {
  const documentsRef = dbColRefs.getDocumentsRef(companyId);
  await documentsRef.add(documentData);
};

import * as functions from 'firebase-functions';
import { PublishedDashboard } from '../../src/utils/types';
import * as admin from 'firebase-admin';
import { dbDocRefs } from './utils/db';
import { createApplicant } from './applicants';
import { Timestamp } from 'firebase/firestore';

export const addApplicantsToDashboard = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/dashboards/{dashboardId}')
  .onUpdate(async (change, context) => {
    // Add applicants to dashboard
    const newDashboard = change.after.data() as PublishedDashboard;
    const prevDashboard = change.before.data() as PublishedDashboard;
    // const prevDashboard = change.before.data() as DraftDashboard;
    const hasNewApplicants =
      newDashboard.newApplicants.length > 0 &&
      (!prevDashboard.newApplicants || !prevDashboard.newApplicants.length) &&
      newDashboard.isPublished;
    const publishedDashboardWithApplicants =
      !prevDashboard.isPublished &&
      newDashboard.isPublished &&
      newDashboard.newApplicants.length > 0;
    if (hasNewApplicants || publishedDashboardWithApplicants) {
      const companyId = context.params.companyId;
      const dashboardId = context.params.dashboardId;
      const applicants = newDashboard.newApplicants;
      const TOTAL_DOCS = Object.values(newDashboard.docs).filter(
        (doc) => doc.isRequired
      ).length; // Only documents that are required are counted.
      const promises: Promise<void>[] = [];
      applicants.forEach((applicantEmail) => {
        const promise = createApplicant(
          {
            companyId,
            dashboardId,
          },
          {
            createdAt:
              admin.firestore.FieldValue.serverTimestamp() as Timestamp,
            email: applicantEmail,
            dashboard: {
              id: dashboardId,
            },
            status: 'not-submitted',
            totalDocs: TOTAL_DOCS,
            adminAcceptedDocs: 0,
            acceptedDocs: 0,
            unCheckedOptionalDocs: 0,
          }
        );
        promises.push(promise);
      });
      await Promise.all(promises);
      const increment = (quantity: number) =>
        admin.firestore.FieldValue.increment(quantity);
      await change.after.ref.update({
        newApplicants: [],
        applicantsCount: increment(applicants.length),
        incompleteApplicantsCount: increment(applicants.length),
      });
    }
  });

export const updateDashboardCounters = async (
  companyId: string,
  dashboardId: string,
  counter:
    | 'applicantsCount'
    | 'completeApplicantsCount'
    | 'incompleteApplicantsCount'
    | 'actionsCount'
    | 'messagesSentCount',
  count: number
) => {
  const increment = admin.firestore.FieldValue.increment(count);
  const dashboardRef = dbDocRefs.getPublishedDashboardRef(
    companyId,
    dashboardId
  );
  await dashboardRef.update({
    [counter]: increment,
  });
};

import * as functions from 'firebase-functions';
import { DraftDashboard, PublishedDashboard } from '../../src/utils/types';
import * as admin from 'firebase-admin';
import { dbDocRefs } from './utils/db';
import { createApplicant } from './applicants';
import { Timestamp } from 'firebase/firestore';

export const onPublishDashboard = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/dashboards/{dashboardId}')
  .onUpdate(async (change, context) => {
    const newDashboard = change.after.data() as PublishedDashboard;
    const prevDashboard = change.before.data() as DraftDashboard;
    const isPublished = newDashboard.isPublished && !prevDashboard.isPublished;

    if (isPublished) {
      const companyId = context.params.companyId;
      const dashboardId = context.params.dashboardId;
      const applicants = newDashboard.applicants;
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
              status: 'not-submitted',
              id: dashboardId,
            },
            actions: [],
            totalDocs: 0,
            adminAcceptedDocs: 0,
            acceptedDocs: 0,
          }
        );
        promises.push(promise);
      });
      await Promise.all(promises);
      await incrementDashboardCounters(
        companyId,
        dashboardId,
        'applicantsCount',
        applicants.length
      );
    }
  });

export const incrementDashboardCounters = async (
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

import * as functions from 'firebase-functions';
import { DraftDashboard, PublishedDashboard } from '../../src/utils/types';
import * as admin from 'firebase-admin';
import { dbDocRefs } from './utils/db';
import { createApplicant } from './applicants';
import { Timestamp } from 'firebase/firestore';
import { storagePaths } from './utils/storage';

export const addApplicantsToDashboard = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/dashboards/{dashboardId}')
  .onUpdate(async (change, context) => {
    const newDashboard = change.after.data() as PublishedDashboard;
    const prevDashboard = change.before.data() as PublishedDashboard;
    const hasNewApplicants =
      newDashboard.newApplicants.length > 0 &&
      !prevDashboard.newApplicants.length &&
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

export const copySamples = functions
  .region('asia-southeast2')
  .runWith({
    memory: '2GB',
    timeoutSeconds: 300,
  })
  .firestore.document('companies/{companyId}/dashboards/{dashboardId}')
  .onCreate(async (docSnap, context) => {
    const dashboard = docSnap.data() as DraftDashboard;
    const companyId = context.params.companyId;
    const copiedDashboard = dashboard.copiedDashboard;

    if (copiedDashboard) {
      const sampleNames = Object.values(dashboard.docs)
        .filter((doc) => doc.sample !== undefined)
        .map(
          (doc) => (doc.sample as { file: string; contentType: string }).file
        );

      if (sampleNames.length > 0) {
        const promises: Promise<any>[] = [];
        const oldFilePath = (sampleName: string) =>
          storagePaths.getSamplePath(companyId, copiedDashboard, sampleName);
        const newFilePath = (sampleName: string) =>
          storagePaths.getSamplePath(companyId, docSnap.id, sampleName);

        sampleNames.forEach((name) => {
          const promise = admin
            .storage()
            .bucket()
            .file(oldFilePath(name))
            .copy(newFilePath(name));
          promises.push(promise);
        });
        await Promise.all(promises);
        return functions.logger.log('Copied all samples');
      } else {
        return functions.logger.log(
          `No samples in dashboard ${copiedDashboard}`
        );
      }
    } else {
      return functions.logger.log('No samples to copy');
    }
  });

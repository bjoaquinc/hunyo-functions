import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { dbColRefs, dbDocRefs } from './utils/db';
import { Applicant } from '../../src/utils/types';
import { updateDashboardCounters } from './dashboards';

export const updateApplicantStatusAndIncrementDashboardCounters = functions
  .region('asia-southeast2')
  .firestore.document(
    'companies/{companyId}/dashboards/{dashboardId}/applicants/{applicantId}'
  )
  .onUpdate(async (change, context) => {
    const prevApplicant = change.before.data() as Applicant;
    const newApplicant = change.after.data() as Applicant;
    const applicantRef = change.after
      .ref as admin.firestore.DocumentReference<Applicant>;
    const companyId = context.params.companyId;
    const dashboardId = context.params.dashboardId;

    if (applicantIsIncomplete(prevApplicant, newApplicant)) {
      await applicantRef.update({
        status: 'incomplete',
      });
      return functions.logger.log(
        'Successfully updated applicant status to incomplete'
      );
    }

    if (applicantIsComplete(prevApplicant, newApplicant)) {
      await applicantRef.update({
        status: 'complete',
      });
      await updateDashboardCounters(
        companyId,
        dashboardId,
        'completeApplicantsCount',
        1
      );
      // Decrement applicant from incomplete
      await updateDashboardCounters(
        companyId,
        dashboardId,
        'incompleteApplicantsCount',
        -1
      );
      return functions.logger.log(
        'Successfully updated applicant status to complete'
      );
    }
  });

const applicantIsIncomplete = (
  prevApplicant: Applicant,
  newApplicant: Applicant
) => {
  if (
    newApplicant.status === 'not-submitted' &&
    newApplicant.adminAcceptedDocs > 0 &&
    prevApplicant.adminAcceptedDocs === 0
  ) {
    return true;
  }
  return false;
};

const applicantIsComplete = (
  prevApplicant: Applicant,
  newApplicant: Applicant
) => {
  if (
    newApplicant.status === 'incomplete' &&
    newApplicant.totalDocs === newApplicant.acceptedDocs &&
    prevApplicant.totalDocs > prevApplicant.acceptedDocs
  ) {
    return true;
  }
  return false;
};

export const incrementApplicantDocs = async (
  refIds: { companyId: string; dashboardId: string; applicantId: string },
  docsType: 'adminAcceptedDocs' | 'acceptedDocs',
  incrementNumber: number
) => {
  const { companyId, dashboardId, applicantId } = refIds;
  const applicantRef = dbDocRefs.getApplicantRef(
    companyId,
    dashboardId,
    applicantId
  );
  const increment = admin.firestore.FieldValue.increment(incrementNumber);
  await applicantRef.update({
    [docsType]: increment,
  });
};

export const createApplicant = async (
  dbIds: {
    companyId: string;
    dashboardId: string;
  },
  applicantData: Applicant
) => {
  const { companyId, dashboardId } = dbIds;
  const applicantRef = dbColRefs.getApplicantsRef(companyId, dashboardId);
  await applicantRef.add(applicantData);
};

export const updateApplicant = async (
  ids: {
    companyId: string;
    dashboardId: string;
    applicantId: string;
  },
  applicantData: Partial<Applicant> | { [key: string]: any }
) => {
  const { companyId, dashboardId, applicantId } = ids;
  const applicantRef = dbDocRefs.getApplicantRef(
    companyId,
    dashboardId,
    applicantId
  );
  await applicantRef.update(applicantData);
};

import * as functions from 'firebase-functions';
import { dbColRefs, dbDocRefs } from './utils/db';
import { Applicant } from '../../src/utils/types';
import { incrementDashboardCounters } from './dashboards';

export const onUpdateApplicant = functions.firestore
  .document(
    'companies/{companyId}/dashboards/{dashboardId}/applicants/{applicantId}'
  )
  .onUpdate(async (change, context) => {
    const prevApplicant = change.before.data() as Applicant;
    const newApplicant = change.after.data() as Applicant;
    const { companyId, dashboardId, applicantId } = context.params;
    const isFirstDocumentSubmitted =
      prevApplicant.docIds.length === 0 && newApplicant.docIds.length > 0;

    if (isFirstDocumentSubmitted) {
      functions.logger.log('First document submitted');
      await updateApplicant(
        {
          companyId,
          dashboardId,
          applicantId,
        },
        {
          'dashboard.status': 'Incomplete',
        }
      );
      await incrementDashboardCounters(
        companyId,
        dashboardId,
        'incompleteApplicantsCount',
        1
      );
    }
  });

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

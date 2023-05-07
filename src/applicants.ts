import * as functions from 'firebase-functions';
import {
  FieldValue,
  Timestamp,
  DocumentReference,
} from 'firebase-admin/firestore';
import { dbColRefs, dbDocRefs } from './utils/db';
import {
  Applicant,
  ApplicantWithFormId,
  Message,
  SendApplicantDocumentRequestTemplate,
} from './utils/types';
import { updateDashboardCounters } from './dashboards';
import { createMessage } from './messages';
import { DateTime } from 'luxon';

export const onDeleteApplicant = functions
  .region('asia-southeast2')
  .firestore.document(
    'companies/{companyId}/dashboards/{dashboardId}/applicants/{applicantId}'
  )
  .onUpdate(async (change, context) => {
    const prevApplicant = change.before.data() as Applicant;
    const newApplicant = change.after.data() as Applicant;
    if (!prevApplicant.isDeleted && newApplicant.isDeleted) {
      const decrement = (count: number) => FieldValue.increment(count);
      const companyId = context.params.companyId;
      const dashboardId = context.params.dashboardId;
      const dashboardRef = dbDocRefs.getPublishedDashboardRef(
        companyId,
        dashboardId
      );

      const UNCHECKED_DOCS_COUNT =
        newApplicant.adminAcceptedDocs - newApplicant.acceptedDocs;
      if (newApplicant.status === 'complete') {
        await dashboardRef.update({
          completeApplicantsCount: decrement(-1),
          applicantsCount: decrement(-1),
          actionsCount: decrement(-UNCHECKED_DOCS_COUNT),
        });
      } else {
        await dashboardRef.update({
          incompleteApplicantsCount: decrement(-1),
          applicantsCount: decrement(-1),
          actionsCount: decrement(-UNCHECKED_DOCS_COUNT),
        });
      }
      const formSnaps = await dbColRefs.formsRef
        .where('applicant.id', '==', change.after.id)
        .get();
      const [formSnap] = formSnaps.docs;
      if (formSnap) {
        await formSnap.ref.update({
          isDeleted: true,
        });
      }
    } else {
      return functions.logger.log('Applicant was not deleted.');
    }
  });

export const updateApplicantStatusAndIncrementDashboardCounters = functions
  .region('asia-southeast2')
  .firestore.document(
    'companies/{companyId}/dashboards/{dashboardId}/applicants/{applicantId}'
  )
  .onUpdate(async (change, context) => {
    const prevApplicant = change.before.data() as Applicant;
    const newApplicant = change.after.data() as Applicant;
    const applicantRef = change.after.ref as DocumentReference<Applicant>;
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

export const resendLinkToApplicant = functions
  .region('asia-southeast2')
  .firestore.document(
    'companies/{companyId}/dashboards/{dashboardId}/applicants/{applicantId}'
  )
  .onUpdate(async (change, context) => {
    const prevApplicant = change.before.data() as ApplicantWithFormId;
    const newApplicant = change.after.data() as ApplicantWithFormId;
    const companyId = context.params.companyId;
    const dashboardId = context.params.dashboardId;
    const applicantId = context.params.applicantId;

    if (!prevApplicant.resendLink && newApplicant.resendLink) {
      const companySnap = await dbDocRefs.getCompanyRef(companyId).get();
      const company = companySnap.data();
      if (!company) {
        return functions.logger.error('Could not find company');
      }
      const dashboardSnap = await dbDocRefs
        .getPublishedDashboardRef(companyId, dashboardId)
        .get();
      const dashboard = dashboardSnap.data();
      if (!dashboard) {
        return functions.logger.error('Could not find dashboard');
      }
      const EMAIL_SUBJECT =
        'Action required: New documents needed for your application';

      const DEV_URL = 'http://localhost:8080';
      const PROD_URL = 'https://hunyo.design';
      let FORM_LINK = '';
      if (process.env.FUNCTIONS_EMULATOR) {
        FORM_LINK = `${DEV_URL}/applicant/forms/${newApplicant.formId}`;
      } else {
        FORM_LINK = `${PROD_URL}/applicant/forms/${newApplicant.formId}`;
      }
      const DEADLINE = DateTime.fromMillis(
        dashboard.deadline.toMillis()
      ).toLocaleString({
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const APPLICANT_NAME = newApplicant.name?.first;
      const TEMPLATE: SendApplicantDocumentRequestTemplate = {
        name: 'Applicant Documents Request',
        data: {
          formLink: FORM_LINK,
          companyName: company.name,
          companyDeadline: DEADLINE,
          applicantName: APPLICANT_NAME,
        },
      };
      const METADATA = {
        applicantId,
        companyId,
        dashboardId,
      };
      const MESSAGE: Message = {
        createdAt:
          // eslint-disable-next-line max-len
          FieldValue.serverTimestamp() as Timestamp,
        recipients: [{ email: newApplicant.email, type: 'to' }],
        subject: EMAIL_SUBJECT,
        body: dashboard.messages.opening,
        fromName: company.name,
        metadata: METADATA,
        template: TEMPLATE,
      };
      await createMessage(MESSAGE);
    } else {
      return functions.logger.log('Applicant was not resent.');
    }
  });

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
  const increment = FieldValue.increment(incrementNumber);
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

import * as functions from 'firebase-functions';
import { FormDoc, DashboardDoc, Form, Applicant } from '../../src/utils/types';
import { updateApplicant } from './applicants';
import { createMessage } from './messages';
import { dbDocRefs, dbColRefs } from './utils/db';

export const createForm = functions.firestore
  .document(
    // eslint-disable-next-line max-len
    'companies/{companyId}/dashboards/{dashboardId}/applicants/{applicantId}'
  )
  .onCreate(async (snapshot, context) => {
    const companyId = context.params.companyId;
    const dashboardId = context.params.dashboardId;
    const applicantId = context.params.applicantId;
    const companyRef = dbDocRefs.getCompanyRef(companyId);
    const dashboardRef = dbDocRefs.getPublishedDashboardRef(
      companyId,
      dashboardId
    );
    const applicantData = snapshot.data() as Applicant;
    const formsRef = dbColRefs.formsRef;

    const companySnap = await companyRef.get();
    const companyData = companySnap.data();
    if (!companyData) {
      return functions.logger.log(`Incorrect company id ${companyId}`);
    }

    const dashboardSnap = await dashboardRef.get();
    const dashboardData = dashboardSnap.data();
    if (!dashboardData) {
      return functions.logger.log(`Incorrect dashboard id ${dashboardId}`);
    }

    const formDocs = turnDashboardDocsIntoFormDocs(
      dashboardData.docs,
      applicantId
    );

    await formsRef.add({
      applicant: {
        id: snapshot.id,
        status: 'Not Submitted',
        email: applicantData.email,
      },
      company: {
        id: companyId,
        logo: companyData.logo,
        name: companyData.name,
      },
      dashboard: {
        id: dashboardId,
        formContent: dashboardData.formContent,
        deadline: dashboardData.deadline,
        job: dashboardData.job,
        country: dashboardData.country,
        messages: dashboardData.messages,
      },
      docs: formDocs,
    });
  });

const turnDashboardDocsIntoFormDocs = (
  docs: {
    [key: string]: DashboardDoc;
  },
  applicantId: string
) => {
  const formDocs: { [key: string]: FormDoc } = {};
  Object.keys(docs).forEach((key) => {
    formDocs[`${applicantId}-${key}`] = {
      name: key,
      status: 'Not Submitted',
      systemTask: null,
      ...docs[key],
    };
  });
  return formDocs;
};

export const updateForm = async (
  formId: string,
  formData: { [key: string]: Partial<Form> | any }
) => {
  const formRef = dbDocRefs.getFormRef(formId);
  await formRef.update({
    ...formData,
  });
};

export const onCreateForm = functions.firestore
  .document('forms/{formId}')
  .onCreate(async (snapshot, context) => {
    const form = { id: context.params.formId, ...snapshot.data() } as Form & {
      id: string;
    };
    const { company, dashboard, applicant } = form;
    const EMAIL_SUBJECT =
      'Action required: New documents needed for your application';
    const DEV_URL = 'http://localhost:8080';
    const PROD_URL = 'https://hunyo.design';
    let FORM_LINK = '';
    if (process.env.NODE_ENV === 'production') {
      FORM_LINK = `${PROD_URL}/applicant/forms/${form.id}`;
    } else {
      FORM_LINK = `${DEV_URL}/applicant/forms/${form.id}`;
    }
    await createMessage(
      [{ email: applicant.email, type: 'to' }],
      EMAIL_SUBJECT,
      dashboard.messages.opening,
      company.name,
      { formLink: FORM_LINK, applicantId: applicant.id }
    );
  });

export const onApplicantNameChange = functions.firestore
  .document('forms/{formId}')
  .onUpdate(async (change, context) => {
    const prevForm = change.before.data() as Form;
    const newForm = change.after.data() as Form;
    const nameHasChanged =
      prevForm.applicant.name !== newForm.applicant.name ||
      prevForm.applicant.name?.first !== newForm.applicant.name?.first;
    prevForm.applicant.name?.last !== newForm.applicant.name?.last;

    if (nameHasChanged) {
      const name = newForm.applicant.name;
      const { company, dashboard, applicant } = newForm;
      await updateApplicant(
        {
          companyId: company.id,
          dashboardId: dashboard.id,
          applicantId: applicant.id,
        },
        {
          name,
        }
      );
    }
  });

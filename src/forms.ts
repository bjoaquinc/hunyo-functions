import * as functions from 'firebase-functions';
import { FormDoc, DashboardDoc, Form } from '../../src/utils/types';
import { updateApplicant } from './applicants';
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

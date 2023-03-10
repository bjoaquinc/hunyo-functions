import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  Form,
  Applicant,
  Message,
  MessageMetadata,
  SendApplicantDocumentRequestTemplate,
} from '../../src/utils/types';
import { updateApplicant } from './applicants';
import { createMessage } from './messages';
import { dbDocRefs, dbColRefs } from './utils/db';
import { Timestamp } from 'firebase/firestore';
import { createDocument } from './documents';

export const createForm = functions
  .region('asia-southeast2')
  .firestore.document(
    // eslint-disable-next-line max-len
    'companies/{companyId}/dashboards/{dashboardId}/applicants/{applicantId}'
  )
  .onCreate(async (snapshot, context) => {
    const companyId = context.params.companyId;
    const dashboardId = context.params.dashboardId;
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

    const formDocRef = await formsRef.add({
      applicant: {
        id: snapshot.id,
        status: 'not-submitted',
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
      adminCheckDocs: 0,
    });

    const promises: Promise<void>[] = [];
    Object.keys(dashboardData.docs).forEach((docName) => {
      const promise = createDocument(companyId, {
        createdAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
        formId: formDocRef.id,
        name: docName,
        requestedFormat: dashboardData.docs[docName].format,
        isRequired: dashboardData.docs[docName].isRequired,
        sample: dashboardData.docs[docName].sample,
        instructions: dashboardData.docs[docName].instructions,
        dashboardId,
        applicantId: snapshot.id,
        companyId,
        status: 'not-submitted',
        docNumber: dashboardData.docs[docName].docNumber,
        totalPages: 0,
        adminAcceptedPages: 0,
        acceptedPages: 0,
      });
      promises.push(promise);
    });
  });

// export const decrementFormAdminCheckDocs = async (formId: string) => {
//   const formRef = dbDocRefs.getFormRef(formId);
//   const decrement = admin.firestore.FieldValue.increment(-1);
//   await formRef.update({
//     adminCheckDocs: decrement,
//   });
// };

// const turnDashboardDocsIntoFormDocs = (
//   docs: {
//     [key: string]: DashboardDoc;
//   },
//   applicantId: string
// ) => {
//   const formDocs: { [key: string]: FormDoc } = {};
//   Object.keys(docs).forEach((key) => {
//     formDocs[`${applicantId}-${key}`] = {
//       name: key,
//       status: 'Not Submitted',
//       systemTask: null,
//       ...docs[key],
//     };
//   });
//   return formDocs;
// };

export const updateForm = async (
  formId: string,
  formData: { [key: string]: Partial<Form> | any }
) => {
  const formRef = dbDocRefs.getFormRef(formId);
  await formRef.update({
    ...formData,
  });
};

export const onCreateForm = functions
  .region('asia-southeast2')
  .firestore.document('forms/{formId}')
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
    const template: SendApplicantDocumentRequestTemplate = {
      name: 'Applicant Documents Request',
      data: {
        formLink: FORM_LINK,
        companyName: company.name,
      },
    };
    const metadata: MessageMetadata = {
      companyId: company.id,
      dashboardId: dashboard.id,
      applicantId: applicant.id,
    };
    const message: Message = {
      createdAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
      recipients: [{ email: applicant.email, type: 'to' }],
      subject: EMAIL_SUBJECT,
      body: dashboard.messages.opening,
      fromName: company.name,
      metadata: metadata,
      template,
    };
    await createMessage(message);
  });

export const onApplicantNameChange = functions
  .region('asia-southeast2')
  .firestore.document('forms/{formId}')
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

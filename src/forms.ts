import * as functions from 'firebase-functions';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  Form,
  Applicant,
  Message,
  MessageMetadata,
  SendApplicantDocumentRequestTemplate,
} from './utils/types';
import { updateApplicant } from './applicants';
import { createMessage } from './messages';
import { dbDocRefs, dbColRefs } from './utils/db';
import { createDocument } from './documents';
import { DateTime } from 'luxon';

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

    // Create Form for Applicant
    const formDocRef = await formsRef.add({
      createdAt: FieldValue.serverTimestamp() as Timestamp,
      applicant: {
        id: snapshot.id,
        status: 'not-submitted',
        email: applicantData.email,
        name: applicantData.name,
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

    // Add FormId to Applicant
    await snapshot.ref.update({
      formId: formDocRef.id,
    });

    // Create Documents for the Applicant
    const promises: Promise<void>[] = [];
    const docs = dashboardData.docs;
    Object.keys(docs).forEach((docName) => {
      const promise = createDocument(companyId, {
        createdAt: FieldValue.serverTimestamp() as Timestamp,
        formId: formDocRef.id,
        name: docName,
        alias: docs[docName].alias,
        requestedFormat: docs[docName].format,
        isRequired: docs[docName].isRequired,
        sample: docs[docName].sample,
        instructions: docs[docName].instructions,
        dashboardId,
        applicantId: snapshot.id,
        companyId,
        status: 'not-submitted',
        docNumber: docs[docName].docNumber,
        totalPages: 0,
        submissionCount: 0,
        isUpdating: false,
      });
      promises.push(promise);
    });
  });

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
    if (process.env.FUNCTIONS_EMULATOR) {
      FORM_LINK = `${DEV_URL}/applicant/forms/${form.id}`;
    } else {
      FORM_LINK = `${PROD_URL}/applicant/forms/${form.id}`;
    }
    const dateTime = DateTime.fromMillis(dashboard.deadline.toMillis());
    const DEADLINE = dateTime.toLocaleString({
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    });
    const APPLICANT_NAME = form.applicant.name;
    const template: SendApplicantDocumentRequestTemplate = {
      name: 'Applicant Documents Request',
      data: {
        formLink: FORM_LINK,
        companyName: company.name,
        companyDeadline: DEADLINE,
        applicantName: APPLICANT_NAME?.first,
      },
    };
    const metadata: MessageMetadata = {
      companyId: company.id,
      dashboardId: dashboard.id,
      applicantId: applicant.id,
    };
    const message: Message = {
      createdAt: FieldValue.serverTimestamp() as Timestamp,
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

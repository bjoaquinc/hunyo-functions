import { db } from '../index';
import * as admin from 'firebase-admin';
import {
  Company,
  User,
  Applicant,
  Form,
  PublishedDashboard,
  DraftDashboard,
  AdminCheck,
  WorkerDoc,
  Action,
  Message,
} from '../../../src/utils/types';

export const converter = <T>() => ({
  toFirestore: (data: T) => data,
  // eslint-disable-next-line max-len
  fromFirestore: (snap: admin.firestore.QueryDocumentSnapshot) =>
    snap.data() as T,
});

export const dbColRefs = {
  companiesRef: db.collection('companies').withConverter(converter<Company>()),
  formsRef: db.collection('forms').withConverter(converter<Form>()),
  messagesRef: db.collection('messages').withConverter(converter<Message>()),
  adminChecksRef: db
    .collection('adminChecks')
    .withConverter(converter<AdminCheck>()),
  getUsersRef: (companyId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('users')
      .withConverter(converter<User>()),
  getActionsRef: (companyId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('actions')
      .withConverter(converter<Action>()),
  getPublishedDashboardsRef: (companyId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('dashboards')
      .withConverter(converter<PublishedDashboard>()),
  getApplicantsRef: (companyId: string, dashboardId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('dashboards')
      .doc(dashboardId)
      .collection('applicants')
      .withConverter(converter<Applicant>()),
  getDocumentsRef: (companyId: string, dashboardId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('dashboards')
      .doc(dashboardId)
      .collection('documents')
      .withConverter(converter<WorkerDoc>()),
};

export const dbDocRefs = {
  getCompanyRef: (companyId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .withConverter(converter<Company>()),
  getFormRef: (formId: string) =>
    db.collection('forms').doc(formId).withConverter(converter<Form>()),
  getMessageRef: (messageId: string) =>
    db
      .collection('messages')
      .doc(messageId)
      .withConverter(converter<Message>()),
  getAdminCheckRef: (adminCheckId: string) =>
    db
      .collection('adminChecks')
      .doc(adminCheckId)
      .withConverter(converter<AdminCheck>()),
  getUserRef: (companyId: string, userId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('users')
      .doc(userId)
      .withConverter(converter<User>()),
  getDraftDashboardRef: (companyId: string, dashboardId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('dashboards')
      .doc(dashboardId)
      .withConverter(converter<DraftDashboard>()),
  getPublishedDashboardRef: (companyId: string, dashboardId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('dashboards')
      .doc(dashboardId)
      .withConverter(converter<PublishedDashboard>()),
  getApplicantRef: (
    companyId: string,
    dashboardId: string,
    applicantId: string
  ) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('dashboards')
      .doc(dashboardId)
      .collection('applicants')
      .doc(applicantId)
      .withConverter(converter<Applicant>()),
};

export const dbColGroupRefs = {
  applicantsRef: db
    .collectionGroup('applicants')
    .withConverter(converter<Applicant>()),
};

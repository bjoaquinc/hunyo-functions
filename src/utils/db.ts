import { db } from '../index';
import * as admin from 'firebase-admin';
import {
  Company,
  User,
  Applicant,
  Form,
  PublishedDashboard,
  DraftDashboard,
  Message,
  AcceptedPage,
} from '../../../src/utils/types';
import { ApplicantDocument, ApplicantPage } from '../../../src/utils/new-types';

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
  acceptedPagesRef: db
    .collection('acceptedPages')
    .withConverter(converter<AcceptedPage>()),
  getUsersRef: (companyId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('users')
      .withConverter(converter<User>()),
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
  getDocumentsRef: (companyId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('documents')
      .withConverter(converter<ApplicantDocument>()),
  getPagesRef: (companyId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('pages')
      .withConverter(converter<ApplicantPage>()),
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
  getPageRef: (companyId: string, pageId: string) =>
    db
      .collection('companies')
      .doc(companyId)
      .collection('pages')
      .doc(pageId)
      .withConverter(converter<ApplicantPage>()),
};

export const dbColGroupRefs = {
  applicantsRef: db
    .collectionGroup('applicants')
    .withConverter(converter<Applicant>()),
};

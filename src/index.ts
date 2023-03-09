/* eslint-disable max-len */
/* eslint-disable object-curly-spacing */
/* eslint-disable indent */
import admin from 'firebase-admin';
admin.initializeApp();
export const db = admin.firestore();
db.settings({
  ignoreUndefinedProperties: true,
});

import * as privateData from './private';
import * as denormalize from './denormalize';
import * as dashboards from './dashboards';
import * as forms from './forms';
import * as manageFiles from './manage-files';
import * as messages from './messages';
import * as applicants from './applicants';
import * as documents from './documents';

export const { addCompanyUserRole } = privateData;
export const { addUserToCompany } = denormalize;
export const { createForm, onApplicantNameChange, onCreateForm } = forms;
export const { onImageUpload, onPDFUpload, onSampleUpload, onPageAccepted } =
  manageFiles;
export const { onPublishDashboard } = dashboards;
export const { onCreateMessage, onUpdateMessage } = messages;
export const { updateApplicantStatusAndIncrementDashboardCounters } =
  applicants;
export const {
  updateDocumentStatusToAdminChecked,
  updateDocumentStatusToAccepted,
  toggleStatusNotApplicable,
} = documents;

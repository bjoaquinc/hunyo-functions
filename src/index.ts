/* eslint-disable max-len */
/* eslint-disable object-curly-spacing */
/* eslint-disable indent */
import admin from 'firebase-admin';
import * as functions from 'firebase-functions';
admin.initializeApp();
import * as amplitude from '@amplitude/analytics-node';
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  functions.logger.log('Running in emulator');
  amplitude.init(process.env.AMPLITUDE_API_KEY_DEV as string);
} else {
  functions.logger.log('Running in production');
  amplitude.init(process.env.AMPLITUDE_API_KEY_PROD as string);
}
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
export const {
  onImageUpload,
  onPDFUpload,
  onSampleUpload,
  onImageStatusUpdated,
  onImagePropertyUpdated,
  updateImageProperties,
} = manageFiles;
export const { onPublishDashboard } = dashboards;
export const { onCreateMessage, onUpdateMessage } = messages;
export const { updateApplicantStatusAndIncrementDashboardCounters } =
  applicants;
export const {
  // updateDocumentStatusToAdminChecked,
  // updateDocumentStatusToAccepted,
  toggleStatusNotApplicable,
  decrementUserActionsCount,
} = documents;

/* eslint-disable max-len */
/* eslint-disable object-curly-spacing */
/* eslint-disable indent */

// Initialize App
import { initializeApp } from 'firebase-admin/app';

const app = initializeApp();

// Initialize Firestore
import { getFirestore } from 'firebase-admin/firestore';

export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

// Initialize Storage
import { getStorage } from 'firebase-admin/storage';
const storage = getStorage(app);
export const bucket = storage.bucket();

// Import Functions
import * as functions from 'firebase-functions';

// Initialize Amplitude
import * as amplitude from '@amplitude/analytics-node';
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  functions.logger.log('Running in emulator');
  amplitude.init(process.env.AMPLITUDE_API_KEY_DEV as string);
} else {
  functions.logger.log('Running in production');
  amplitude.init(process.env.AMPLITUDE_API_KEY_PROD as string);
}

import * as privateData from './private';
import * as denormalize from './denormalize';
import * as dashboards from './dashboards';
import * as forms from './forms';
import * as manageFiles from './manage-files';
import * as messages from './messages';
import * as applicants from './applicants';
import * as documents from './documents';
import * as pages from './pages';
import * as invites from './invites';
// import * as maintenance from './maintenance/update_firestore';

export const { addCompanyUserRole } = privateData;
export const { addUserToCompany } = denormalize;
export const { createForm, onApplicantNameChange, sendFormLinkToApplicant } =
  forms;
export const {
  onImageUpload,
  onPDFUpload,
  onSampleUpload,
  onImageStatusUpdated,
  onImagePropertyUpdated,
  updateImageProperties,
} = manageFiles;
export const { addApplicantsToDashboard, copySamples } = dashboards;
export const { onCreateMessage, updateApplicantLatestMessage } = messages;
export const {
  updateApplicantStatusAndIncrementDashboardCounters,
  onDeleteApplicant,
  resendLinkToApplicant,
} = applicants;
export const {
  onDocStatusUpdate,
  toggleStatusNotApplicable,
  restitchAndUploadPDF,
} = documents;
export const { onDeletePage } = pages;
export const { onCreateInvite } = invites;
// export const { addFormIdsToApplicant } = maintenance;

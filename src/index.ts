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
import * as taskManager from './task-manager';
import * as applicants from './applicants';
import * as messages from './messages';

export const { addCompanyUserRole } = privateData;
export const { addUserToCompany } = denormalize;
export const { createForm, onApplicantNameChange, onCreateForm } = forms;
export const { onFileUpload } = manageFiles;
export const { onPublishDashboard } = dashboards;
export const { formTaskManager, adminTaskManager } = taskManager;
export const { onUpdateApplicant } = applicants;
export const { onCreateMessage } = messages;

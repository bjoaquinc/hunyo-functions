// import * as functions from 'firebase-functions';

import { dbColRefs } from './utils/db';
import { WorkerDoc } from '../../src/utils/types';

export const createWorkerDocument = async (
  companyId: string,
  dashboardId: string,
  documentId: string,
  documentData: WorkerDoc
) => {
  const documentsRef = dbColRefs.getDocumentsRef(companyId, dashboardId);
  await documentsRef.doc(documentId).set(documentData);
};

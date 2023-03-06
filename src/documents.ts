// import * as functions from 'firebase-functions';

import { dbColRefs } from './utils/db';
import { ApplicantDocument } from '../../src/utils/new-types';

export const createDocument = async (
  companyId: string,
  documentData: ApplicantDocument
) => {
  const documentsRef = dbColRefs.getDocumentsRef(companyId);
  await documentsRef.add(documentData);
};

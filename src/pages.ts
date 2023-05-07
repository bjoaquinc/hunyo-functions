import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { bucket } from './index';
import { ApplicantPage } from './utils/types';
import { storagePaths } from './utils/storage';
import { updateDocument } from './documents';

export const onDeletePage = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/pages/{pageId}')
  .onDelete(async (snapshot, context) => {
    const pageData = snapshot.data() as ApplicantPage;
    // Delete Pages from fixed and original storage
    const { companyId, dashboardId, applicantId, name, docId } = pageData;
    const originalStoragePath = storagePaths.getOriginalDocPath(
      companyId,
      dashboardId,
      applicantId,
      `${name}.jpeg`
    );
    const fixedStoragePath = storagePaths.getFixedDocPath(
      companyId,
      dashboardId,
      applicantId,
      `${name}.pdf`
    );
    // Remove Files from Storage
    const deleteObject = (path: string) => bucket.file(path).delete();
    const promises: Promise<unknown>[] = [];
    promises.push(deleteObject(originalStoragePath));
    promises.push(deleteObject(fixedStoragePath));
    await Promise.all(promises);
    // Decrement Total Pages on document
    const decrement = FieldValue.increment(-1);
    await updateDocument(companyId, docId, {
      totalPages: decrement as unknown as number,
    });
  });

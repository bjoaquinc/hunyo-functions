import { AdminCheck } from '../../src/utils/types';
import { dbColRefs, dbDocRefs } from './utils/db';

export const createAdminCheck = async (adminCheckData: AdminCheck) => {
  const adminChecksRef = dbColRefs.adminChecksRef;
  const adminCheckRef = await adminChecksRef.add(adminCheckData);
  return adminCheckRef.id;
};

export const updateAdminCheck = async (
  adminCheckId: string,
  adminCheckData: Partial<AdminCheck> | { [key: string]: any }
) => {
  const adminCheckRef = dbDocRefs.getAdminCheckRef(adminCheckId);
  await adminCheckRef.update(adminCheckData);
};

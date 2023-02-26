import { Action } from '../../src/utils/types';
import { dbColRefs } from './utils/db';

export const createAction = async (companyId: string, actionData: Action) => {
  const actionsRef = dbColRefs.getActionsRef(companyId);
  const actionRef = await actionsRef.add(actionData);
  return actionRef;
};

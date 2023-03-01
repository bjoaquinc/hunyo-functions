/* eslint-disable camelcase */
import { dbColRefs, dbDocRefs } from './utils/db';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Message } from '../../src/utils/types';
import { Timestamp } from 'firebase/firestore';
import { sendMessage } from './mailchimp';
import { updateApplicant } from './applicants';
import { MessagesSendResponse } from '@mailchimp/mailchimp_transactional';

export const createMessage = async (message: Message) => {
  const messagesRef = dbColRefs.messagesRef;
  const { subject, recipients, body, fromName, metadata, template } = message;
  functions.logger.log('message', message);
  await messagesRef.add({
    createdAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
    subject,
    recipients,
    body,
    fromName,
    metadata,
    template,
  });
};

export const updateMessage = async (
  messageId: string,
  messageData: Partial<Message> | { [key: string]: any }
) => {
  const messageRef = dbDocRefs.getMessageRef(messageId);
  await messageRef.update({
    ...messageData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
  });
};

export const onCreateMessage = functions.firestore
  .document('messages/{messageId}')
  .onCreate(async (snap, context) => {
    try {
      const message = snap.data() as Message;
      const messageId = context.params.messageId;
      const responseList = (await sendMessage(
        message
      )) as MessagesSendResponse[];
      functions.logger.log(responseList);
      const response = responseList[0];
      const { _id, reject_reason, status } = response;
      const messageResponseData = {
        id: _id,
        status,
        rejectReason: reject_reason,
      };
      await updateMessage(messageId, {
        messageResponseData,
      });
    } catch (error) {
      functions.logger.log(error);
    }
  });

export const onUpdateMessage = functions.firestore
  .document('messages/{messageId}')
  .onUpdate(async (change, context) => {
    const prevMessage = change.before.data() as Message;
    const newMessage = change.after.data() as Message;
    const messageId = context.params.messageId;
    if (
      !prevMessage.messageResponseData &&
      newMessage.messageResponseData &&
      newMessage.metadata
    ) {
      const { companyId, dashboardId, applicantId } = newMessage.metadata;
      const { status } = newMessage.messageResponseData as { status: string };
      await updateApplicant(
        {
          companyId,
          dashboardId,
          applicantId,
        },
        {
          latestMessage: {
            id: messageId,
            status: status === 'sent' ? 'Delivered' : 'Not Delivered',
            sentAt: newMessage.createdAt,
          },
        }
      );
    }
  });

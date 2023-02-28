/* eslint-disable camelcase */
import { dbColRefs, dbDocRefs } from './utils/db';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {
  MessageRecipient,
  MessagesSendResponse,
} from '@mailchimp/mailchimp_transactional';
import { Timestamp } from 'firebase/firestore';
import { sendMessage } from './mailchimp';
import { Message } from '../../src/utils/types';

export const createMessage = async (
  recipients: MessageRecipient[],
  subject: string,
  body: string,
  fromName?: string,
  metadata?: { [key: string]: any }
) => {
  const messagesRef = dbColRefs.messagesRef;
  await messagesRef.add({
    createdAt: admin.firestore.FieldValue.serverTimestamp() as Timestamp,
    subject,
    recipients,
    body,
    fromName,
    metadata,
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
      const formLink = getFormLink(message);
      const response = (await sendMessage(
        message.body,
        message.subject,
        message.recipients,
        message.fromName,
        [],
        formLink
      )) as MessagesSendResponse[];
      const responseObject = response[0];
      const { _id, reject_reason, status } = responseObject;
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

const getFormLink = (message: Message) => {
  const { metadata } = message;
  if (metadata && metadata.formLink) {
    return metadata.formLink as string;
  } else {
    return '';
  }
};

/* eslint-disable camelcase */
import { dbColRefs, dbDocRefs } from './utils/db';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { MessagesSendResponse } from '@mailchimp/mailchimp_transactional';
import { Message } from '../../src/utils/types';
import { Timestamp } from 'firebase/firestore';
import { sendMessage } from './mailchimp';
import { updateApplicant } from './applicants';

export const createMessage = async (message: Message) => {
  const messagesRef = dbColRefs.messagesRef;
  const { subject, recipients, body, fromName, metadata } = message;
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

export const onUpdateMessage = functions.firestore
  .document('messages/{messageId}')
  .onUpdate(async (change, context) => {
    const prevMessage = change.before.data() as Message;
    const newMessage = change.after.data() as Message;
    const messageId = context.params.messageId;
    const applicantMessageStatusUpdated =
      !prevMessage.messageResponseData &&
      newMessage.messageResponseData &&
      newMessage.metadata;
    if (applicantMessageStatusUpdated) {
      const { companyId, dashboardId, applicantId } = newMessage.metadata as {
        companyId: string;
        dashboardId: string;
        applicantId: string;
      };
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

/* eslint-disable camelcase */
import { dbColRefs, dbDocRefs } from './utils/db';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Message } from './utils/types';
import { sendMessage } from './mailchimp';
import { updateApplicant } from './applicants';
import { MessagesSendResponse } from '@mailchimp/mailchimp_transactional';

export const createMessage = async (message: Message) => {
  const messagesRef = dbColRefs.messagesRef;
  const { subject, recipients, body, fromName, metadata, template } = message;
  functions.logger.log('message', message);
  await messagesRef.add({
    createdAt:
      admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
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
    updatedAt:
      admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
  });
};

export const onCreateMessage = functions
  .region('asia-southeast2')
  .runWith({
    secrets: ['MAILCHIMP_API_KEY'],
  })
  .firestore.document('messages/{messageId}')
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

export const updateApplicantLatestMessage = functions
  .region('asia-southeast2')
  .firestore.document('messages/{messageId}')
  .onUpdate(async (change, context) => {
    const newMessage = change.after.data() as Message;
    const messageId = context.params.messageId;
    if (newMessage.metadata) {
      const { companyId, dashboardId, applicantId } = newMessage.metadata;
      if (!companyId || !dashboardId || !applicantId) {
        return functions.logger.log('Missing metadata to update applicant');
      }
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
          resendLink: false, // Reset resend link if message is resent
        }
      );
    }
  });

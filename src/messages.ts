/* eslint-disable camelcase */
import { dbColRefs, dbDocRefs } from './utils/db';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';
import { Message } from './utils/types';
import { sendMessage } from './mailchimp';
import { updateApplicant } from './applicants';
import { MessagesSendResponse } from '@mailchimp/mailchimp_transactional';
import { sendSMS } from './semaphore';

export const createMessage = async (message: Omit<Message, 'createdAt'>) => {
  const messagesRef = dbColRefs.messagesRef;
  // const { messageTypes, emailData } = message;
  // eslint-disable-next-line max-len
  // const { subject, recipients, body, fromName, metadata, template } = message;
  functions.logger.log('message', message);
  await messagesRef.add({
    createdAt: FieldValue.serverTimestamp() as Timestamp,
    ...message,
  });
};

export const updateMessage = async (
  messageId: string,
  messageData: Partial<Message> | { [key: string]: any }
) => {
  const messageRef = dbDocRefs.getMessageRef(messageId);
  await messageRef.update({
    updatedAt: FieldValue.serverTimestamp() as Timestamp,
    ...messageData,
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
      const { messageTypes, emailData, smsData } = message;
      const messageId = context.params.messageId;

      // Send email
      if (messageTypes.includes('email') && emailData) {
        const responseList = (await sendMessage(
          emailData
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
          ['emailData.messagResponseData']: messageResponseData,
        });
      }

      // Send sms
      if (messageTypes.includes('sms') && smsData) {
        functions.logger.log('Send sms');
        await sendSMS(smsData);
      }
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
    const { emailData } = newMessage;
    if (emailData && emailData.metadata) {
      const { companyId, dashboardId, applicantId } = emailData.metadata;
      if (!companyId || !dashboardId || !applicantId) {
        return functions.logger.log('Missing metadata to update applicant');
      }
      const { status } = emailData.messageResponseData as { status: string };
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

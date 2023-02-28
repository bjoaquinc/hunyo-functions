import mailchimp, {
  MessageRecipient,
  MessagesMessage,
} from '@mailchimp/mailchimp_transactional';

const client = mailchimp(process.env.MAILCHIMP_API_KEY as string);

export const sendMessage = async (
  emailMessage: string,
  emailSubject: string,
  messageRecipients: MessageRecipient[],
  fromName?: string,
  ccdReceipientEmails?: string[]
) => {
  const message: MessagesMessage = {
    from_email: 'info@hunyo.com',
    from_name: fromName,
    subject: emailSubject,
    text: emailMessage,
    html: emailMessage,
    to: messageRecipients,
    track_opens: true,
  };

  const response = await client.messages.send({ message });
  return response;
};

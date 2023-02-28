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
  ccdReceipientEmails?: string[],
  formLink?: string
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

  if (formLink) {
    const response = await sendTemplateMessage(message, formLink);
    return response;
  } else {
    const response = await sendPlainTextMessage(message);
    return response;
  }
};

const sendPlainTextMessage = async (message: MessagesMessage) => {
  const response = await client.messages.send({ message });
  return response;
};

const sendTemplateMessage = async (
  message: MessagesMessage,
  formLink: string
) => {
  const response = await client.messages.sendTemplate({
    message: {
      global_merge_vars: [
        {
          name: 'FORM_LINK',
          content: formLink,
        },
      ],
      ...message,
    },
    template_name: 'Sending Agencies',
    template_content: [],
  });
  return response;
};

import mailchimp, { MessagesMessage } from '@mailchimp/mailchimp_transactional';
import {
  Message,
  SendApplicantDocumentRequestTemplate,
} from '../../src/utils/types';

const client = mailchimp(process.env.MAILCHIMP_API_KEY as string);

export const sendMessage = async (message: Message) => {
  const mailchimpMessage: MessagesMessage = {
    from_email: 'info@hunyo.com',
    from_name: message.fromName,
    subject: message.subject,
    text: message.body,
    html: message.body,
    to: message.recipients,
    track_opens: true,
    track_clicks: true,
  };

  if (message.template) {
    const response = await sendTemplateMessage(
      mailchimpMessage,
      message.template
    );
    return response;
  } else {
    const response = await sendPlainTextMessage(mailchimpMessage);
    return response;
  }
};

const sendPlainTextMessage = async (message: MessagesMessage) => {
  const response = await client.messages.send({ message });
  return response;
};

const sendTemplateMessage = async (
  message: MessagesMessage,
  template: SendApplicantDocumentRequestTemplate
) => {
  const response = await emailTemplates[template.name](message, template);
  return response;
};

const emailTemplates = {
  'Applicant Documents Request': async (
    message: MessagesMessage,
    template: SendApplicantDocumentRequestTemplate
  ) => {
    const response = await client.messages
      .sendTemplate({
        message: {
          global_merge_vars: [
            {
              name: 'FORM_LINK',
              content: template.data.formLink,
            },
            {
              name: 'COMPANY_NAME',
              content: template.data.companyName,
            },
          ],
          ...message,
        },
        template_name: template.name,
        template_content: [],
      })
      .catch((error) => {
        throw error;
      });
    return response;
  },
};

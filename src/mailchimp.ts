// import * as functions from 'firebase-functions';
import mailchimp, { MessagesMessage } from '@mailchimp/mailchimp_transactional';
import {
  EmailTemplate,
  SendApplicantDocumentRejectionTemplate,
  SendApplicantDocumentRequestTemplate,
  SendTeamInvite,
  EmailData,
} from './utils/types';

export const sendMessage = async (emailData: EmailData) => {
  const mailchimpMessage: MessagesMessage = {
    from_email: 'info@hunyo.com',
    from_name: emailData.fromName,
    subject: emailData.subject,
    text: emailData.body,
    html: emailData.body,
    to: emailData.recipients,
    track_opens: true,
    track_clicks: true,
  };

  if (emailData.template) {
    const response = await sendTemplateMessage(
      mailchimpMessage,
      emailData.template
    );
    return response;
  } else {
    const response = await sendPlainTextMessage(mailchimpMessage);
    return response;
  }
};

const sendPlainTextMessage = async (message: MessagesMessage) => {
  const client = mailchimp(process.env.MAILCHIMP_API_KEY as string);
  const response = await client.messages.send({ message });
  return response;
};

const sendTemplateMessage = async (
  message: MessagesMessage,
  template: EmailTemplate
) => {
  if (template.name === 'Applicant Documents Request') {
    const response = await emailTemplates[template.name](message, template);
    return response;
  }

  if (template.name === 'Team Invite Message') {
    const response = await emailTemplates[template.name](message, template);
    return response;
  }

  if (template.name === 'Applicant Reject Email') {
    const response = await emailTemplates[template.name](message, template);
    return response;
  }
  throw new Error('Template name does not exist');
};

const emailTemplates = {
  'Applicant Documents Request': async (
    message: MessagesMessage,
    template: SendApplicantDocumentRequestTemplate
  ) => {
    const client = mailchimp(process.env.MAILCHIMP_API_KEY as string);
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
            {
              name: 'COMPANY_DEADLINE',
              content: template.data.companyDeadline,
            },
            {
              name: 'APPLICANT_NAME',
              content: template.data.applicantName as string,
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
  'Applicant Reject Email': async (
    message: MessagesMessage,
    template: SendApplicantDocumentRejectionTemplate
  ) => {
    const client = mailchimp(process.env.MAILCHIMP_API_KEY as string);
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
            {
              name: 'APPLICANT_NAME',
              content: template.data.applicantName as string,
            },
            {
              name: 'DOCUMENT_NAME',
              content: template.data.documentName,
            },
            {
              name: 'COMPANY_DEADLINE',
              content: template.data.companyDeadline,
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
  'Team Invite Message': async (
    message: MessagesMessage,
    template: SendTeamInvite
  ) => {
    const client = mailchimp(process.env.MAILCHIMP_API_KEY as string);
    const response = await client.messages
      .sendTemplate({
        message: {
          global_merge_vars: [
            {
              name: 'TEAM_MEMBER_NAME',
              content: template.data.teamMemberName,
            },
            {
              name: 'COMPANY_NAME',
              content: template.data.companyName,
            },
            {
              name: 'INVITE_LINK',
              content: template.data.inviteLink,
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

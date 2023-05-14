import { Timestamp } from 'firebase-admin/firestore';

// Hardcoded types

export type Formats = 'jpeg' | 'pdf';

export type ApplicantStatus = 'not-submitted' | 'incomplete' | 'complete';

export type ApplicantDashboardMessageStatus =
  | 'Pending'
  | 'Delivered'
  | 'Not Delivered';

// Firebase models

export interface Invite {
  createdAt: Timestamp;
  company: {
    name: string;
    id: string;
  };
  email: string;
  resend: boolean;
  isComplete: boolean;
  invitedBy: string;
}

export interface Company {
  createdAt: Timestamp;
  name: string;
  users: string[];
  logo?: string;
  messageTypes: MessageType[];
  options: {
    adminCheck: boolean;
    mobileOnly: boolean;
    imageOnly: boolean;
  };
}

export interface User {
  createdAt: Timestamp;
  company: {
    id: string;
    name: string;
  };
  email: string;
  name: {
    first: string;
    last: string;
  };
  dashboards: {
    id: string;
    title: string;
    type: string;
  }[];
}

interface ApplicantItem {
  email: string;
  name?: {
    first: string;
    middle: string;
    last: string;
  };
  phoneNumbers?: {
    primary: string;
    secondary: string;
  };
  address?: string;
}

export interface DraftDashboard {
  createdAt: Timestamp;
  createdBy: string;
  country: string;
  job: string;
  title: string;
  deadline: Timestamp;
  formContent?: {
    header: string;
    caption: string;
  };
  docs: { [key: string]: DashboardDoc };
  newApplicants: ApplicantItem[];
  messages?: {
    opening: string;
  };
  isPublished: false;
  copiedDashboard?: string;
}

export interface PublishedDashboard {
  createdAt: Timestamp;
  createdBy: string;
  country: string;
  job: string;
  title: string;
  deadline: Timestamp;
  formContent: {
    header: string;
    caption: string;
  };
  docs: { [key: string]: DashboardDoc };
  newApplicants: ApplicantItem[];
  messages: {
    opening: string;
  };
  isPublished: true;
  publishedAt: Timestamp;
  applicantsCount?: number;
  incompleteApplicantsCount?: number;
  completeApplicantsCount?: number;
  actionsCount?: number;
  messagesSentCount?: number;
  copiedDashboard?: string;
}

export interface Applicant {
  createdAt: Timestamp;
  email: string;
  name?: {
    first: string;
    middle: string;
    last: string;
  };
  phoneNumbers?: {
    primary: string;
    secondary: string;
  };
  address?: string;
  latestMessage?: {
    id: string;
    status: ApplicantDashboardMessageStatus;
    sentAt: Timestamp;
  };
  dashboard: {
    id: string;
    submittedAt?: Timestamp;
  };
  status: ApplicantStatus;
  totalDocs: number;
  adminAcceptedDocs: number;
  acceptedDocs: number;
  unCheckedOptionalDocs: number;
  // hasRejectedDocsEmail: boolean;
  resendLink?: boolean;
  isDeleted?: boolean;
}

export interface ApplicantWithFormId extends Applicant {
  formId: string;
}

export interface Form {
  createdAt: Timestamp;
  applicant: {
    id: string;
    status: ApplicantStatus;
    name?: {
      first: string;
      middle: string;
      last: string;
    };
    email: string;
    phoneNumbers?: {
      primary: string;
      secondary: string;
    };
  };
  company: {
    id: string;
    logo?: string;
    name: string;
  };
  dashboard: {
    id: string;
    formContent: {
      header: string;
      caption: string;
    };
    deadline: Timestamp;
    job: string;
    country: string;
    messages: {
      opening: string;
    };
  };
  adminCheckDocs: number;
  isDeleted?: boolean;
}

export interface AcceptedPage {
  createdAt: Timestamp;
  applicantId: string;
  dashboardId: string;
  companyId: string;
  formId: string;
  docId: string;
  pageId: string;
  name: string;
  acceptedBy: string;
  docName: string;
  contentType: string;
}

export interface RejectedPage {
  createdAt: Timestamp;
  applicantId: string;
  dashboardId: string;
  companyId: string;
  formId: string;
  docId: string;
  pageId: string;
  name: string;
  rejectedBy: string;
  reasonForRejection: string;
  otherReason?: string;
  docName: string;
  contentType: string;
}

export interface DashboardDoc {
  format: Formats;
  isRequired: boolean;
  sample?: {
    file: string;
    contentType: string;
  };
  instructions?: string;
  alias?: string;
  docNumber: number;
}

type MessageType = 'sms' | 'email';

export interface Message {
  createdAt: Timestamp;
  messageTypes: MessageType[];
  emailData?: EmailData | null;
  smsData?: SMSData | null;
  updatedAt?: Timestamp;
}

type SMSStatus = 'Pending' | 'Sent' | 'Failed' | 'Refunded';

export interface SMSData {
  phoneNumber: string;
  message: string;
  senderName?: string;
  status?: SMSStatus;
}

export interface EmailData {
  subject: string;
  recipients: {
    email: string;
    type?: 'to' | 'cc' | 'bcc';
  }[];
  body: string;
  fromName?: string;
  metadata?: MessageMetadata;
  template?: EmailTemplate;
  messageResponseData?: {
    id: string;
    status: string;
    rejectReason: string;
    analytics?: {
      opens?: number;
      clicks?: number;
      isSpam?: boolean;
    };
  };
}

export type EmailTemplate =
  | SendApplicantDocumentRequestTemplate
  | SendTeamInvite;
// | SendApplicantDocumentRejectionTemplate;

export interface SendApplicantDocumentRequestTemplate {
  name: 'Applicant Documents Request';
  data: {
    formLink: string;
    companyName: string;
    companyDeadline: string;
    applicantName?: string;
  };
}

export interface SendTeamInvite {
  name: 'Team Invite Message';
  data: {
    teamMemberName: string;
    companyName: string;
    inviteLink: string;
  };
}

export interface MessageMetadata {
  applicantId: string;
  dashboardId: string;
  companyId: string;
}

// New Models

export type RequestStatus = 'not-submitted' | 'incomplete' | 'complete';
export type DocumentStatus =
  | 'not-submitted'
  | 'delayed'
  | 'submitted'
  | 'admin-checked'
  | 'accepted'
  | 'rejected'
  | 'not-applicable';
// export type PageStatus =
//   | 'submitted'
//   | 'admin-checked'
//   | 'accepted'
//   | 'rejected';
export type RejectionReasons =
  | 'wrong-document'
  | 'edges-not-visible'
  | 'blurry'
  | 'too-dark'
  | 'other';

export interface ApplicantDocument {
  createdAt: Timestamp;
  formId: string;
  dashboardId: string;
  applicantId: string;
  companyId: string;
  name: string;
  alias?: string;
  updatedName?: string;
  requestedFormat: 'pdf' | 'jpeg';
  isRequired: boolean;
  sample?: {
    contentType: string;
    file: string;
  };
  instructions?: string;
  status: DocumentStatus;
  deviceSubmitted?: 'desktop' | 'mobile';
  docNumber: number;
  totalPages: number;
  submissionCount: number;
  restitchDocument?: boolean;
  isUpdating: boolean;
  delayedUntil?: Timestamp;
  rejection?: {
    reasons: RejectionReasons[];
    rejectedBy: string;
    rejectedAt: Timestamp;
    message?: string;
  } | null;
}

export interface ApplicantDocumentWithRejection
  extends Omit<ApplicantDocument, 'rejection'> {
  rejection: {
    reasons: RejectionReasons[];
    rejectedBy: string;
    rejectedAt: Timestamp;
    message?: string;
  };
}

export interface ApplicantPage {
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  docId: string;
  formId: string;
  dashboardId: string;
  applicantId: string;
  companyId: string;
  name: string;
  pageNumber: number;
  // status: PageStatus;
  submittedFormat: string;
  submittedSize: number;
  submissionCount: number; // Mapped to document submission count
  updatingFixedImage?: boolean;
  imageProperties?: ApplicantPageImageProperties;
}

export interface ApplicantPageImageProperties {
  brightness?: string;
  contrast?: string;
  sharpness?: string;
  rotateRight: '0' | '90' | '180' | '270';
  normalise: boolean;
  clahe: boolean;
}

export interface Accept {
  createdAt: Timestamp;
  docId: string;
  applicantId: string;
  acceptedBy: string;
}

export interface Reject {
  createdAt: Timestamp;
  docId: string;
  applicantId: string;
  rejectedBy: string;
  reasonForRejection: string;
  message?: string;
}

import { firestore } from 'firebase-admin';

// Hardcoded types

export type Formats = 'jpeg' | 'pdf';

export type ApplicantStatus = 'not-submitted' | 'incomplete' | 'complete';

export type ApplicantDashboardMessageStatus =
  | 'Pending'
  | 'Delivered'
  | 'Not Delivered';

// Firebase models

export interface Invite {
  createdAt: firestore.Timestamp;
  company: {
    name: string;
    id: string;
  };
  email: string;
  resend: boolean;
}

export interface Company {
  createdAt: firestore.Timestamp;
  name: string;
  users: string[];
  logo?: string;
}

export interface User {
  createdAt: firestore.Timestamp;
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

export interface DraftDashboard {
  createdAt: firestore.Timestamp;
  createdBy: string;
  country: string;
  job: string;
  title: string;
  deadline: firestore.Timestamp;
  formContent?: {
    header: string;
    caption: string;
  };
  docs: { [key: string]: DashboardDoc };
  newApplicants: string[];
  savedApplicants: string[];
  messages?: {
    opening: string;
  };
  isPublished: false;
  copiedDashboard?: string;
}

export interface PublishedDashboard {
  createdAt: firestore.Timestamp;
  createdBy: string;
  country: string;
  job: string;
  title: string;
  deadline: firestore.Timestamp;
  formContent: {
    header: string;
    caption: string;
  };
  docs: { [key: string]: DashboardDoc };
  newApplicants: string[];
  savedApplicants: string[];
  messages: {
    opening: string;
  };
  isPublished: true;
  publishedAt: firestore.Timestamp;
  applicantsCount?: number;
  incompleteApplicantsCount?: number;
  completeApplicantsCount?: number;
  actionsCount?: number;
  messagesSentCount?: number;
  copiedDashboard?: string;
}

export interface Applicant {
  createdAt: firestore.Timestamp;
  email: string;
  name?: {
    first: string;
    middle: string;
    last: string;
  };
  latestMessage?: {
    id: string;
    status: ApplicantDashboardMessageStatus;
    sentAt: firestore.Timestamp;
  };
  dashboard: {
    id: string;
    submittedAt?: firestore.Timestamp;
  };
  status: ApplicantStatus;
  totalDocs: number;
  adminAcceptedDocs: number;
  acceptedDocs: number;
  unCheckedOptionalDocs: number;
  isDeleted?: boolean;
}

export interface Form {
  createdAt: firestore.Timestamp;
  applicant: {
    id: string;
    status: ApplicantStatus;
    name?: {
      first: string;
      middle: string;
      last: string;
    };
    email: string;
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
    deadline: firestore.Timestamp;
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
  createdAt: firestore.Timestamp;
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
  createdAt: firestore.Timestamp;
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
  docNumber: number;
}

export interface Message {
  createdAt: firestore.Timestamp;
  subject: string;
  recipients: {
    email: string;
    type?: 'to' | 'cc' | 'bcc';
  }[];
  body: string;
  fromName?: string;
  metadata?: MessageMetadata;
  template?: SendApplicantDocumentRequestTemplate;
  updatedAt?: firestore.Timestamp;
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

export interface SendApplicantDocumentRequestTemplate {
  name: 'Applicant Documents Request';
  data: {
    formLink: string;
    companyName: string;
    companyDeadline: string;
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
  createdAt: firestore.Timestamp;
  formId: string;
  dashboardId: string;
  applicantId: string;
  companyId: string;
  name: string;
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
  isUpdating: boolean;
  delayedUntil?: firestore.Timestamp;
  rejection?: {
    reasons: RejectionReasons[];
    rejectedBy: string;
    rejectedAt: firestore.Timestamp;
    message?: string;
  } | null;
}

export interface ApplicantDocumentWithRejection
  extends Omit<ApplicantDocument, 'rejection'> {
  rejection: {
    reasons: RejectionReasons[];
    rejectedBy: string;
    rejectedAt: firestore.Timestamp;
    message?: string;
  };
}

export interface ApplicantPage {
  createdAt: firestore.Timestamp;
  updatedAt?: firestore.Timestamp;
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
  createdAt: firestore.Timestamp;
  docId: string;
  applicantId: string;
  acceptedBy: string;
}

export interface Reject {
  createdAt: firestore.Timestamp;
  docId: string;
  applicantId: string;
  rejectedBy: string;
  reasonForRejection: string;
  message?: string;
}

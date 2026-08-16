export interface CreateSendRequestDto {
  recipients: Array<{
    contactId?: string;
    name: string;
    email: string;
  }>;
  generatedDocumentId: string;
  emailSubject?: string;
  emailBodyHtml?: string;
  emailBodyText?: string;
}

export interface RetrySendRequestDto {
  recipients: Array<{
    recipientId: string;
    email?: string;
  }>;
}

export interface SendRequestListItem {
  id: string;
  rfqId: string;
  status: string;
  initiatedBy: string | null;
  emailSubject: string;
  replyTo: string | null;
  recipientCount: number;
  recipients: Array<{
    id: string;
    recipientName: string;
    recipientEmail: string;
    status: string;
  }>;
  createdAt: Date | string;
}

export interface SendRequestDetail {
  id: string;
  rfqId: string;
  status: string;
  initiatedBy: string | null;
  generatedDocId: string | null;
  emailSubject: string;
  emailBodyHtml: string;
  replyTo: string | null;
  recipients: Array<{
    id: string;
    contactId: string | null;
    recipientName: string;
    recipientEmail: string;
    status: string;
    errorMessage: string | null;
    sentAt: Date | string | null;
    retryCount: number;
  }>;
  createdAt: Date | string;
  updatedAt: Date | string;
}

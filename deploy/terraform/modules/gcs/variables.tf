variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "name_prefix" {
  type        = string
  default     = null
  description = "Optional override for bucket name prefix. Defaults to claims-manager-{environment}."
}

variable "hmac_service_account_email" {
  type = string
}

variable "allow_public_bucket_iam" {
  type        = bool
  default     = false
  description = "If true, grant roles/storage.objectViewer to allUsers on buckets marked public. Many orgs block allUsers (iam.allowedPolicyMemberDomains); keep false and use signed URLs or authenticated access."
}

variable "create_hmac_key" {
  type        = bool
  default     = false
  description = "If true, create an HMAC key for the chat service account. Requires org to allow service account key creation (not iam.disableServiceAccountKeyCreation)."
}

variable "create_documents_bucket" {
  type        = bool
  default     = true
  description = "If true, create the documents bucket with CORS for the filesystem module."
}

variable "documents_cors_origins" {
  type        = list(string)
  default     = ["http://localhost:5002"]
  description = "Allowed CORS origins for direct-to-GCS uploads from the browser."
}

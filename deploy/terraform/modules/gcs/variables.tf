variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
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

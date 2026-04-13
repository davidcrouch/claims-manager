variable "project_id" {
  type = string
}

variable "location" {
  type    = string
  default = "us-central1"
}

variable "reader_members" {
  type        = list(string)
  description = "IAM members granted artifactregistry.reader on the repository (e.g. GKE node SAs from other projects)"
  default     = []
}

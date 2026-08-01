variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

variable "dns_name" {
  type        = string
  description = "Apex DNS zone with trailing dot (e.g. branlamie.com.). Host records are api[-env].<zone>."
}

variable "gateway_ip" {
  type        = string
  default     = null
  description = "Used when host_records is null: A records for default hosts point here (VM / LB IP)."
}

variable "create_subdomain_records" {
  type        = bool
  default     = true
  description = "Whether to create default api/auth/app/providers records when host_records is null."
}

variable "host_records" {
  type = map(object({
    name    = string
    type    = string
    rrdatas = list(string)
  }))
  default     = null
  description = "Explicit DNS records. When set, gateway_ip defaults are ignored. Use CNAME to ghs.googlehosted.com for Cloud Run domain mappings."
}

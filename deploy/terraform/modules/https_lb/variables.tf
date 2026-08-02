variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "domains" {
  type        = list(string)
  description = "Domains for the Google-managed SSL certificate"
}

variable "services" {
  type = map(object({
    cloud_run_service_name = string
    hostnames              = list(string)
  }))
  description = "Map of service key → Cloud Run service name + hostnames for URL map routing"
}

variable "default_service" {
  type        = string
  description = "Key in var.services to use as the default backend (catch-all)"
}

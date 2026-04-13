variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_self_link" {
  type = string
}

variable "subnet_self_link" {
  type = string
}

variable "pod_range_name" {
  type = string
}

variable "service_range_name" {
  type = string
}

variable "master_authorized_cidr" {
  type    = string
  default = "0.0.0.0/0"
}

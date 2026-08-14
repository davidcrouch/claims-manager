terraform {
  required_version = ">= 1.3.0"

  backend "gcs" {
    bucket = "claims-manager-terraform-state"
    prefix = "staging"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  labels = {
    product = "claims-manager"
    env     = var.environment
  }
}

module "networking" {
  source = "../../modules/networking"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  # Active subnet. Orphan claims-manager-gke-staging may remain in GCP until
  # serverless address reservations on it are released.
  subnet_ip_cidr_range = "10.2.0.0/20"
  secondary_ip_cidr_a  = "10.18.0.0/16"
  secondary_ip_cidr_b  = "10.19.0.0/22"
}

module "cloudsql" {
  source = "../../modules/cloudsql"

  project_id               = var.project_id
  region                   = var.region
  environment              = var.environment
  tier                     = var.cloudsql_tier
  availability_type        = "ZONAL"
  backup_retention_days    = 7
  private_network          = module.networking.vpc_self_link
  create_provider_app_user = true
}

module "memorystore" {
  source = "../../modules/memorystore"

  project_id         = var.project_id
  region             = var.region
  environment        = var.environment
  tier               = "BASIC"
  memory_size_gb     = 1
  authorized_network = module.networking.vpc_self_link
}

module "gcs" {
  source = "../../modules/gcs"

  project_id                 = var.project_id
  region                     = var.region
  environment                = var.environment
  hmac_service_account_email = module.iam.service_account_emails["frontend"]
  create_hmac_key            = false
  create_documents_bucket    = true
  documents_cors_origins     = ["https://app-staging.branlamie.com", "http://localhost:5002"]
}

data "google_project" "this" {
  project_id = var.project_id
}

module "artifact_registry" {
  source = "../../modules/artifact-registry"

  project_id = var.infra_project_id
  location   = var.region
  reader_members = [
    "serviceAccount:${data.google_project.this.number}-compute@developer.gserviceaccount.com",
  ]
}

module "iam" {
  source = "../../modules/iam"

  project_id                   = var.project_id
  environment                  = var.environment
  enable_gke_workload_identity = false
}

module "secrets" {
  source = "../../modules/secrets"

  project_id  = var.project_id
  environment = var.environment
}

module "dns" {
  source = "../../modules/dns"

  project_id               = var.project_id
  environment              = var.environment
  dns_name                 = var.dns_name
  gateway_ip               = null
  host_records             = null
  create_subdomain_records = false
}

module "pubsub" {
  source = "../../modules/pubsub-claims"

  project_id     = var.project_id
  project_number = data.google_project.this.number
  env            = var.environment
  labels         = local.labels
}

module "https_lb" {
  source = "../../modules/https_lb"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment

  domains = [
    local.cloud_run_hosts.app,
    local.cloud_run_hosts.auth,
    local.cloud_run_hosts.providers,
    local.cloud_run_hosts.api,
  ]

  services = {
    frontend = {
      cloud_run_service_name = "frontend"
      hostnames              = [local.cloud_run_hosts.app]
    }
    auth = {
      cloud_run_service_name = "auth-server"
      hostnames              = [local.cloud_run_hosts.auth]
    }
    provider = {
      cloud_run_service_name = "provider-server"
      hostnames              = [local.cloud_run_hosts.providers]
    }
    api = {
      cloud_run_service_name = "api-server"
      hostnames              = [local.cloud_run_hosts.api]
    }
  }

  default_service = "frontend"
}

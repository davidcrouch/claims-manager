terraform {
  required_version = ">= 1.3.0"

  backend "gcs" {
    bucket = "claims-manager-terraform-state"
    prefix = "production"
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

module "networking" {
  source = "../../modules/networking"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment
}

module "gke" {
  source = "../../modules/gke"

  project_id         = var.project_id
  region             = var.region
  environment        = var.environment
  vpc_self_link      = module.networking.vpc_self_link
  subnet_self_link   = module.networking.subnet_self_link
  pod_range_name     = module.networking.pod_range_name
  service_range_name = module.networking.service_range_name

  depends_on = [module.networking]
}

module "cloudsql" {
  source = "../../modules/cloudsql"

  project_id            = var.project_id
  region                = var.region
  environment           = var.environment
  tier                  = var.cloudsql_tier
  availability_type     = "REGIONAL"
  backup_retention_days = 30
  private_network       = module.networking.vpc_self_link
}

module "memorystore" {
  source = "../../modules/memorystore"

  project_id         = var.project_id
  region             = var.region
  environment        = var.environment
  tier               = "STANDARD_HA"
  memory_size_gb     = 3
  authorized_network = module.networking.vpc_self_link
}

module "gcs" {
  source = "../../modules/gcs"

  project_id                 = var.project_id
  region                     = var.region
  environment                = var.environment
  hmac_service_account_email = module.iam.service_account_emails["frontend"]
  create_hmac_key            = false
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

  project_id  = var.project_id
  environment = var.environment

  depends_on = [module.gke]
}

module "secrets" {
  source = "../../modules/secrets"

  project_id  = var.project_id
  environment = var.environment
}

module "dns" {
  source = "../../modules/dns"

  project_id  = var.project_id
  environment = var.environment
  dns_name    = var.dns_name
  gateway_ip  = var.gateway_ip
}

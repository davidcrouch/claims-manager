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

module "networking" {
  source = "../../modules/networking"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment
}

# ── Staging runs on a single e2-standard-2 VM via docker compose.
# Postgres / Redis are managed (CloudSQL + Memorystore) so the VM only
# hosts the application containers and Caddy for TLS. See
# modules/staging_vm for the MIG + disk + snapshot + firewall topology.
module "staging_vm" {
  source = "../../modules/staging_vm"

  project_id        = var.project_id
  infra_project_id  = var.infra_project_id
  region            = var.region
  zone              = var.staging_vm_zone
  environment       = var.environment
  vpc_self_link     = module.networking.vpc_self_link
  subnet_self_link  = module.networking.subnet_self_link
  data_disk_size_gb = var.staging_vm_data_disk_size_gb
  admin_cidr        = var.staging_vm_admin_cidr
  domain            = trimsuffix(var.dns_name, ".")
  caddy_admin_email = var.caddy_admin_email
}

module "cloudsql" {
  source = "../../modules/cloudsql"

  project_id            = var.project_id
  region                = var.region
  environment           = var.environment
  tier                  = var.cloudsql_tier
  availability_type     = "ZONAL"
  backup_retention_days = 7
  private_network       = module.networking.vpc_self_link
}

# Minimum Memorystore capacity (M1). Staging stays on BASIC to save spend;
# production uses STANDARD_HA.
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
    "serviceAccount:${module.staging_vm.service_account_email}",
  ]
}

module "iam" {
  source = "../../modules/iam"

  project_id  = var.project_id
  environment = var.environment

  # Roles required by the cd-staging workflow (gcloud compute ssh --tunnel-through-iap).
  # Scoped to staging because production still deploys via GKE and does not need them.
  extra_ci_deployer_roles = [
    "roles/iap.tunnelResourceAccessor",
    "roles/compute.instanceAdmin.v1",
    "roles/compute.osAdminLogin",
  ]

  # Staging runs on a VM + docker compose, not GKE, so the
  # <project>.svc.id.goog identity pool does not exist. Skip the
  # K8s-SA -> Google-SA bindings. The Google SAs (api-server-sa,
  # auth-server-sa, frontend-sa, external-secrets-sa) are still
  # created so they can be referenced by other modules (e.g. GCS HMAC
  # key for frontend-sa), they just don't bind to any K8s SAs.
  enable_gke_workload_identity = false
}

# ci-deployer must be allowed to actAs the VM service account so `gcloud
# compute ssh` can mint an OS Login SSH key against it. The real
# ci-deployer lives in the infra project (see
# deploy/terraform/bootstrap/infra) - module.iam.ci_deployer_email would
# point at an orphan SA in the staging project that the CI workflows do
# not use.
resource "google_service_account_iam_member" "ci_deployer_actas_vm" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${module.staging_vm.service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.ci_deployer_infra_email}"
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
  # Point A records at the staging VM's static IP so CI-free subdomain traffic
  # (api/auth/app) reaches Caddy immediately after terraform apply.
  gateway_ip = module.staging_vm.public_ip
}

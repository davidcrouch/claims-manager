# Cloud Run compute path (see deploy/CLOUD_RUN.md).
# When enable_cloud_run=true, services are provisioned against the existing
# VPC / Cloud SQL / Memorystore / secrets. DNS cutover is controlled separately
# by dns_edge so the Compose VM can keep serving until you flip the switch.

locals {
  artifact_host = "${var.region}-docker.pkg.dev/${var.infra_project_id}/claims-manager"
  image_tag     = var.cloud_run_image_tag
  # Placeholder so first terraform apply succeeds before Artifact Registry
  # images exist. CD replaces with real service images; module ignores image drift.
  bootstrap_image = "us-docker.pkg.dev/cloudrun/container/hello"

  cloud_run_domain_suffix = trimsuffix(var.dns_name, ".")
  cloud_run_hosts = {
    api       = "api-${var.environment}.${local.cloud_run_domain_suffix}"
    auth      = "auth-${var.environment}.${local.cloud_run_domain_suffix}"
    app       = "app-${var.environment}.${local.cloud_run_domain_suffix}"
    providers = "providers-${var.environment}.${local.cloud_run_domain_suffix}"
  }

  # CNAME targets for Cloud Run domain mappings.
  cloud_run_dns_records = {
    api = {
      name    = "api-${var.environment}"
      type    = "CNAME"
      rrdatas = ["ghs.googlehosted.com."]
    }
    auth = {
      name    = "auth-${var.environment}"
      type    = "CNAME"
      rrdatas = ["ghs.googlehosted.com."]
    }
    app = {
      name    = "app-${var.environment}"
      type    = "CNAME"
      rrdatas = ["ghs.googlehosted.com."]
    }
    providers = {
      name    = "providers-${var.environment}"
      type    = "CNAME"
      rrdatas = ["ghs.googlehosted.com."]
    }
  }
}

resource "google_project_service" "run" {
  count   = var.enable_cloud_run ? 1 : 0
  project = var.project_id
  service = "run.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "compute_for_run" {
  count   = var.enable_cloud_run ? 1 : 0
  project = var.project_id
  service = "compute.googleapis.com"

  disable_on_destroy = false
}

# Artifact Registry readers for Cloud Run runtime SAs.
resource "google_artifact_registry_repository_iam_member" "cloud_run_readers" {
  for_each = var.enable_cloud_run ? toset([
    "api-server",
    "auth-server",
    "frontend",
    "provider-server",
  ]) : toset([])

  project    = var.infra_project_id
  location   = var.region
  repository = "claims-manager"
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${module.iam.service_account_emails[each.key]}"
}

# ci-deployer must actAs each Cloud Run runtime SA to deploy revisions.
resource "google_service_account_iam_member" "ci_deployer_actas_run" {
  for_each = var.enable_cloud_run ? toset([
    "api-server",
    "auth-server",
    "frontend",
    "provider-server",
  ]) : toset([])

  service_account_id = "projects/${var.project_id}/serviceAccounts/${module.iam.service_account_emails[each.key]}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.ci_deployer_infra_email}"
}

module "cloud_run_provider" {
  count  = var.enable_cloud_run ? 1 : 0
  source = "../../modules/cloud_run_service"

  project_id            = var.project_id
  region                = var.region
  name                  = "provider-server"
  image                 = var.cloud_run_use_bootstrap_image ? local.bootstrap_image : "${local.artifact_host}/provider-server:${local.image_tag}"
  service_account_email = module.iam.service_account_emails["provider-server"]
  container_port        = 8080
  cpu                   = "1"
  memory                = "512Mi"
  min_instances         = 0
  max_instances         = 1
  container_concurrency = 40
  health_path           = var.cloud_run_use_bootstrap_image ? "/" : "/api/v1/health"
  enable_probes         = !var.cloud_run_use_bootstrap_image
  ingress               = "INGRESS_TRAFFIC_ALL"
  # Org policy iam.allowedPolicyMemberDomains blocks allUsers binding.
  # Public invocation handled via org constraint exemption post-apply.
  allow_unauthenticated = false
  vpc_network           = module.networking.vpc_self_link
  vpc_subnet            = module.networking.subnet_self_link
  domain                = var.dns_edge == "cloudrun" ? local.cloud_run_hosts.providers : null

  env_vars = {
    NODE_ENV                = "production"
    WEBHOOK_PROCESSING_MODE = "more0"
    MORE0_ENABLED           = "true"
    MORE0_GATEWAY_URL       = var.more0_gateway_url
  }

  secret_env_vars = [
    { name = "DATABASE_URL", secret = "database-url-provider" },
    { name = "CREDENTIALS_ENCRYPTION_KEY", secret = "credentials-encryption-key" },
    { name = "MORE0_API_KEY", secret = "more0-api-key" },
  ]

  depends_on = [
    google_project_service.run,
    module.secrets,
  ]
}

module "cloud_run_api" {
  count  = var.enable_cloud_run ? 1 : 0
  source = "../../modules/cloud_run_service"

  project_id            = var.project_id
  region                = var.region
  name                  = "api-server"
  image                 = var.cloud_run_use_bootstrap_image ? local.bootstrap_image : "${local.artifact_host}/api-server:${local.image_tag}"
  service_account_email = module.iam.service_account_emails["api-server"]
  container_port        = 3001
  cpu                   = "2"
  memory                = "2Gi"
  min_instances         = var.cloud_run_api_min_instances
  max_instances         = 2
  container_concurrency = 20
  timeout               = "900s"
  health_path           = var.cloud_run_use_bootstrap_image ? "/" : "/api/v1/health"
  enable_probes         = !var.cloud_run_use_bootstrap_image
  # Private by default: only IAM invokers (frontend / auth / provider workers).
  ingress               = "INGRESS_TRAFFIC_INTERNAL_ONLY"
  allow_unauthenticated = false
  invoker_members = [
    "serviceAccount:${module.iam.service_account_emails["frontend"]}",
    "serviceAccount:${module.iam.service_account_emails["auth-server"]}",
    "serviceAccount:${module.iam.service_account_emails["provider-server"]}",
  ]
  vpc_network = module.networking.vpc_self_link
  vpc_subnet  = module.networking.subnet_self_link
  # Domain mapping only makes sense with allUsers or LB; keep null while private.
  domain = null

  env_vars = {
    NODE_ENV = "production"
  }

  secret_env_vars = [
    { name = "DATABASE_URL", secret = "database-url-api" },
    { name = "CREDENTIALS_ENCRYPTION_KEY", secret = "credentials-encryption-key" },
    { name = "INTERNAL_API_TOKEN", secret = "internal-api-token" },
    { name = "MORE0_API_KEY", secret = "more0-api-key" },
    { name = "MORE0_TOOL_SECRET", secret = "more0-tool-secret" },
  ]

  depends_on = [
    google_project_service.run,
    module.secrets,
  ]
}

module "cloud_run_auth" {
  count  = var.enable_cloud_run ? 1 : 0
  source = "../../modules/cloud_run_service"

  project_id            = var.project_id
  region                = var.region
  name                  = "auth-server"
  image                 = var.cloud_run_use_bootstrap_image ? local.bootstrap_image : "${local.artifact_host}/auth-server:${local.image_tag}"
  service_account_email = module.iam.service_account_emails["auth-server"]
  container_port        = 4000
  cpu                   = "1"
  memory                = "768Mi"
  min_instances         = 0
  max_instances         = 1
  health_path           = var.cloud_run_use_bootstrap_image ? "/" : "/health"
  enable_probes         = !var.cloud_run_use_bootstrap_image
  ingress               = "INGRESS_TRAFFIC_ALL"
  allow_unauthenticated = false
  vpc_network           = module.networking.vpc_self_link
  vpc_subnet            = module.networking.subnet_self_link
  domain                = var.dns_edge == "cloudrun" ? local.cloud_run_hosts.auth : null

  env_vars = {
    NODE_ENV     = "production"
    SERVICE_NAME = "auth-server"
  }

  secret_env_vars = [
    { name = "DATABASE_URL", secret = "database-url-auth" },
    { name = "REDIS_URL", secret = "redis-url" },
    { name = "INTERNAL_API_TOKEN", secret = "internal-api-token" },
  ]

  depends_on = [
    google_project_service.run,
    module.secrets,
  ]
}

module "cloud_run_frontend" {
  count  = var.enable_cloud_run ? 1 : 0
  source = "../../modules/cloud_run_service"

  project_id            = var.project_id
  region                = var.region
  name                  = "frontend"
  image                 = var.cloud_run_use_bootstrap_image ? local.bootstrap_image : "${local.artifact_host}/frontend:${local.image_tag}"
  service_account_email = module.iam.service_account_emails["frontend"]
  container_port        = 3000
  cpu                   = "1"
  memory                = "768Mi"
  min_instances         = 0
  max_instances         = 1
  health_path           = "/"
  enable_probes         = !var.cloud_run_use_bootstrap_image
  ingress               = "INGRESS_TRAFFIC_ALL"
  allow_unauthenticated = false
  vpc_network           = module.networking.vpc_self_link
  vpc_subnet            = module.networking.subnet_self_link
  domain                = var.dns_edge == "cloudrun" ? local.cloud_run_hosts.app : null

  env_vars = {
    NODE_ENV = "production"
    # Server-side BFF calls private api via run URI + identity (set at deploy).
    NEXT_PUBLIC_API_URL = var.dns_edge == "cloudrun" ? "https://${local.cloud_run_hosts.api}" : ""
    AUTH_SERVER_URL     = var.dns_edge == "cloudrun" ? "https://${local.cloud_run_hosts.auth}" : ""
  }

  secret_env_vars = [
    { name = "OIDC_COOKIE_SECRET", secret = "frontend-oidc-cookie-secret" },
  ]

  depends_on = [
    google_project_service.run,
    module.secrets,
  ]
}

# One-shot migrate Job (api image, migrate command).
resource "google_cloud_run_v2_job" "migrate_api" {
  count    = var.enable_cloud_run ? 1 : 0
  project  = var.project_id
  name     = "migrate-api"
  location = var.region

  template {
    template {
      service_account = module.iam.service_account_emails["api-server"]
      timeout         = "900s"
      max_retries     = 1

      vpc_access {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = regex("projects/.+$", module.networking.vpc_self_link)
          subnetwork = regex("projects/.+$", module.networking.subnet_self_link)
        }
      }

      containers {
        image   = var.cloud_run_use_bootstrap_image ? local.bootstrap_image : "${local.artifact_host}/api-server:${local.image_tag}"
        command = ["node", "dist/database/run-migrations.js"]

        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = "database-url-api"
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [google_project_service.run]
}

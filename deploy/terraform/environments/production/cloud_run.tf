# Cloud Run compute path — same sizing as staging except frontend (2 vCPU).
# Custom hostnames via Cloudflare → *.run.app (no domain mappings in this region).

locals {
  artifact_host   = "${var.region}-docker.pkg.dev/${var.infra_project_id}/claims-manager"
  image_tag       = var.cloud_run_image_tag
  bootstrap_image = "us-docker.pkg.dev/cloudrun/container/hello"

  run_host         = "${data.google_project.this.number}.${var.region}.run.app"
  auth_run_url     = "https://auth-server-${local.run_host}"
  frontend_run_url = "https://frontend-${local.run_host}"
  api_run_url      = "https://api-server-${local.run_host}"

  # Production hostnames have no env suffix (app.example.com vs app-staging.example.com).
  cloud_run_domain_suffix = trimsuffix(var.dns_name, ".")
  cloud_run_hosts = {
    api       = "api.${local.cloud_run_domain_suffix}"
    auth      = "auth.${local.cloud_run_domain_suffix}"
    app       = "app.${local.cloud_run_domain_suffix}"
    providers = "providers.${local.cloud_run_domain_suffix}"
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

resource "google_project_service" "aiplatform" {
  count   = var.enable_cloud_run ? 1 : 0
  project = var.project_id
  service = "aiplatform.googleapis.com"

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
  allow_unauthenticated = true
  vpc_network = module.networking.vpc_self_link
  vpc_subnet  = module.networking.subnet_self_link

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

  env_vars = {
    NODE_ENV               = "production"
    GCP_PROJECT_ID         = var.project_id
    VERTEX_AI_PROJECT      = var.project_id
    VERTEX_AI_LOCATION     = "us-central1"
    VERTEX_EMBEDDING_MODEL = "text-embedding-005"
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
    google_project_service.aiplatform,
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
  allow_unauthenticated = true
  vpc_network = module.networking.vpc_self_link
  vpc_subnet  = module.networking.subnet_self_link

  env_vars = {
    NODE_ENV             = "production"
    SERVICE_NAME         = "auth-server"
    SERVICE_VERSION      = "0.3.1"
    OIDC_ISSUER          = var.use_public_hostnames ? "https://${local.cloud_run_hosts.auth}" : local.auth_run_url
    BASE_URL             = var.use_public_hostnames ? "https://${local.cloud_run_hosts.auth}" : local.auth_run_url
    OIDC_CLIENT_ID       = "claims-manager-ui"
    OIDC_CLIENT_CALLBACK_URI = var.use_public_hostnames ? "https://${local.cloud_run_hosts.app}/api/auth/callback" : "${local.frontend_run_url}/api/auth/callback"
    OIDC_POST_LOGIN_URI  = var.use_public_hostnames ? "https://${local.cloud_run_hosts.app}/dashboard" : "${local.frontend_run_url}/dashboard"
    OIDC_POST_LOGOUT_URI = var.use_public_hostnames ? "https://${local.cloud_run_hosts.app}" : local.frontend_run_url
    CORS_ORIGINS         = var.use_public_hostnames ? "https://${local.cloud_run_hosts.app}" : local.frontend_run_url
    JWT_EXPECTED_AUDIENCE = "claims-manager-ui"
    JWT_PUBLIC_KEY_E     = "AQAB"
    REDIS_PROVIDER       = "self-hosted"
    REDIS_HOST           = module.memorystore.host
    REDIS_PORT           = tostring(module.memorystore.port)
  }

  secret_env_vars = [
    { name = "DATABASE_URL", secret = "database-url-auth" },
    { name = "INTERNAL_API_TOKEN", secret = "internal-api-token" },
    { name = "JWT_SECRET", secret = "auth-jwt-secret" },
    { name = "OIDC_CLIENT_SECRET", secret = "auth-oidc-client-secret" },
    { name = "OIDC_COOKIES_KEYS", secret = "auth-oidc-cookies-keys" },
    { name = "DYNAMIC_REGISTRATION_SECRET", secret = "auth-dcr-secret" },
    { name = "DCR_IAT_SIGNING_KEY", secret = "auth-dcr-iat-key" },
    { name = "JWT_PUBLIC_KEY_N", secret = "auth-jwks-rsa-n" },
    { name = "JWT_PRIVATE_KEY_D", secret = "auth-jwks-rsa-d" },
    { name = "JWT_PRIVATE_KEY_P", secret = "auth-jwks-rsa-p" },
    { name = "JWT_PRIVATE_KEY_Q", secret = "auth-jwks-rsa-q" },
    { name = "JWT_PRIVATE_KEY_DP", secret = "auth-jwks-rsa-dp" },
    { name = "JWT_PRIVATE_KEY_DQ", secret = "auth-jwks-rsa-dq" },
    { name = "JWT_PRIVATE_KEY_QI", secret = "auth-jwks-rsa-qi" },
    { name = "JWT_EC_PRIVATE_KEY_D", secret = "auth-jwks-ec-d" },
    { name = "JWT_EC_PUBLIC_KEY_X", secret = "auth-jwks-ec-x" },
    { name = "JWT_EC_PUBLIC_KEY_Y", secret = "auth-jwks-ec-y" },
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
  cpu                   = "2"
  memory                = "1Gi"
  min_instances         = 0
  max_instances         = 1
  health_path           = "/"
  enable_probes         = !var.cloud_run_use_bootstrap_image
  ingress               = "INGRESS_TRAFFIC_ALL"
  allow_unauthenticated = true
  vpc_network = module.networking.vpc_self_link
  vpc_subnet  = module.networking.subnet_self_link

  env_vars = {
    NODE_ENV = "production"
    # Wire to public hostnames (Cloudflare) or direct *.run.app URLs.
    AUTH_SERVER_URL = var.use_public_hostnames ? "https://${local.cloud_run_hosts.auth}" : local.auth_run_url
    OIDC_ISSUER     = var.use_public_hostnames ? "https://${local.cloud_run_hosts.auth}" : local.auth_run_url
    OIDC_CLIENT_ID  = "claims-manager-ui"
    OIDC_REDIRECT_URI = (
      var.use_public_hostnames
      ? "https://${local.cloud_run_hosts.app}/api/auth/callback"
      : "${local.frontend_run_url}/api/auth/callback"
    )
    OIDC_POST_LOGIN_URI = (
      var.use_public_hostnames
      ? "https://${local.cloud_run_hosts.app}/dashboard"
      : "${local.frontend_run_url}/dashboard"
    )
    OIDC_POST_LOGOUT_URI = (
      var.use_public_hostnames
      ? "https://${local.cloud_run_hosts.app}"
      : local.frontend_run_url
    )
    # Private api stays on run URI (internal ingress); public api hostname is optional.
    NEXT_PUBLIC_API_URL = local.api_run_url
  }

  secret_env_vars = [
    { name = "OIDC_COOKIE_SECRET", secret = "frontend-oidc-cookie-secret" },
    # Same confidential-client secret as auth-server (Basic auth on /token).
    { name = "OIDC_CLIENT_SECRET", secret = "auth-oidc-client-secret" },
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

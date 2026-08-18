# Cloud Run compute path — same sizing as staging except frontend (2 vCPU).
# Custom hostnames via Cloudflare → *.run.app (no domain mappings in this region).

locals {
  artifact_host   = "${var.region}-docker.pkg.dev/${var.infra_project_id}/claims-manager"
  image_tag       = var.cloud_run_image_tag
  bootstrap_image = "us-docker.pkg.dev/cloudrun/container/hello"

  run_host             = "${data.google_project.this.number}.${var.region}.run.app"
  auth_run_url         = "https://auth-server-${local.run_host}"
  frontend_run_url     = "https://frontend-${local.run_host}"
  api_run_url          = "https://api-server-${local.run_host}"
  claims_mcp_run_url   = "https://claims-mcp-${local.run_host}"
  ms_graph_mcp_run_url = "https://ms-graph-mcp-${local.run_host}"

  # Production hostnames have no env suffix (app.example.com vs app-staging.example.com).
  cloud_run_domain_suffix = trimsuffix(var.dns_name, ".")
  cloud_run_hosts = {
    auth      = "auth.${local.cloud_run_domain_suffix}"
    app       = "app.${local.cloud_run_domain_suffix}"
    providers = "providers.${local.cloud_run_domain_suffix}"
  }

  # Absolute URI for OIDC resource indicators / JWT aud (RFC 8707). Not the client_id.
  oidc_audience = "http://more0.ai"
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
    "claims-mcp",
    "ms-graph-mcp",
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
    "claims-mcp",
    "ms-graph-mcp",
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
  # Not on the public LB. IAM-private (same pattern as MCP services):
  # callers hit the .run.app URL with a Cloud Run invoker identity token.
  # INGRESS_TRAFFIC_INTERNAL_ONLY blocks Cloud Run→Cloud Run over *.run.app
  # (egress is private-ranges-only, so those calls leave the VPC).
  ingress               = "INGRESS_TRAFFIC_ALL"
  allow_unauthenticated = false
  invoker_members = [
    "serviceAccount:${module.iam.service_account_emails["frontend"]}",
    "serviceAccount:${module.iam.service_account_emails["auth-server"]}",
    "serviceAccount:${module.iam.service_account_emails["provider-server"]}",
    "serviceAccount:${module.iam.service_account_emails["claims-mcp"]}",
  ]
  vpc_network = module.networking.vpc_self_link
  vpc_subnet  = module.networking.subnet_self_link

  env_vars = {
    NODE_ENV               = "production"
    GCP_PROJECT_ID         = var.project_id
    VERTEX_AI_PROJECT      = var.project_id
    VERTEX_AI_LOCATION     = "us-central1"
    VERTEX_EMBEDDING_MODEL = "text-embedding-005"
    SEED_NEW_TENANTS       = "true"
    # Documents / provisioning template uploads (CI syncs data/templates → platform/templates/)
    GCS_DOCUMENTS_BUCKET   = module.gcs.documents_bucket_name
    GCS_UPLOAD_CORS_ORIGIN = (
      var.use_public_hostnames
      ? "https://${local.cloud_run_hosts.app}"
      : local.frontend_run_url
    )
    # MCP integrations seeded into new orgs (path must include /mcp)
    CLAIMS_MCP_URL   = "${local.claims_mcp_run_url}/mcp"
    MS_GRAPH_MCP_URL = "${local.ms_graph_mcp_run_url}/mcp"
    MCP_OAUTH_CALLBACK_BASE_URL = (
      var.use_public_hostnames
      ? "https://${local.cloud_run_hosts.app}"
      : local.frontend_run_url
    )
    # JWT validation against auth-server (public hostname when LB is on).
    AUTH_ISSUER_URL = (
      var.use_public_hostnames
      ? "https://${local.cloud_run_hosts.auth}"
      : local.auth_run_url
    )
    AUTH_SERVER_URL = (
      var.use_public_hostnames
      ? "https://${local.cloud_run_hosts.auth}"
      : local.auth_run_url
    )
    AUTH_JWKS_URI = (
      var.use_public_hostnames
      ? "https://${local.cloud_run_hosts.auth}/jwks"
      : "${local.auth_run_url}/jwks"
    )
    AUTH_AUDIENCE = local.oidc_audience
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
    google_project_iam_member.ci_deployer_run_admin,
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
    JWT_EXPECTED_AUDIENCE  = local.oidc_audience
    OIDC_ALLOWED_RESOURCES = local.oidc_audience
    JWT_PUBLIC_KEY_E     = "AQAB"
    REDIS_PROVIDER       = "self-hosted"
    REDIS_HOST           = module.memorystore.host
    REDIS_PORT           = tostring(module.memorystore.port)
    # New-org catalog seed (auth → api /internal/seed-tenant).
    SEED_NEW_TENANTS     = "true"
    API_INTERNAL_URL     = local.api_run_url
    EMAIL_PROVIDER       = "resend"
    EMAIL_FROM           = "noreply@branlamie.com"
  }

  secret_env_vars = [
    { name = "DATABASE_URL", secret = "database-url-auth" },
    { name = "INTERNAL_API_TOKEN", secret = "internal-api-token" },
    { name = "JWT_SECRET", secret = "auth-jwt-secret" },
    { name = "REDIS_ENCRYPTION_KEY", secret = "auth-redis-encryption-key" },
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
    { name = "RESEND_API_KEY", secret = "resend-api-key" },
  ]

  depends_on = [
    google_project_service.run,
    module.secrets,
    google_secret_manager_secret_version.auth_redis_encryption_key,
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
    OIDC_AUDIENCE   = local.oidc_audience
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
    # Server-only (not inlined by Next). Prefer this over NEXT_PUBLIC_API_URL.
    API_URL             = local.api_run_url
    # Kept for any client-side reads; may be empty if built without build-arg.
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

module "cloud_run_claims_mcp" {
  count  = var.enable_cloud_run ? 1 : 0
  source = "../../modules/cloud_run_service"

  project_id            = var.project_id
  region                = var.region
  name                  = "claims-mcp"
  image                 = var.cloud_run_use_bootstrap_image ? local.bootstrap_image : "${local.artifact_host}/claims-mcp:${local.image_tag}"
  service_account_email = module.iam.service_account_emails["claims-mcp"]
  container_port        = 4601
  cpu                   = "1"
  memory                = "512Mi"
  min_instances         = 0
  max_instances         = 2
  container_concurrency = 40
  health_path           = var.cloud_run_use_bootstrap_image ? "/" : "/healthz"
  enable_probes         = !var.cloud_run_use_bootstrap_image
  # IAM-private; same Direct VPC reachability rationale as api-server.
  ingress               = "INGRESS_TRAFFIC_ALL"
  allow_unauthenticated = false
  invoker_members = [
    "serviceAccount:${module.iam.service_account_emails["frontend"]}",
    "serviceAccount:${module.iam.service_account_emails["api-server"]}",
  ]
  vpc_network = module.networking.vpc_self_link
  vpc_subnet  = module.networking.subnet_self_link

  env_vars = {
    NODE_ENV       = "production"
    CLAIMS_API_URL = local.api_run_url
  }

  secret_env_vars = []

  depends_on = [
    google_project_service.run,
  ]
}

module "cloud_run_ms_graph_mcp" {
  count  = var.enable_cloud_run ? 1 : 0
  source = "../../modules/cloud_run_service"

  project_id            = var.project_id
  region                = var.region
  name                  = "ms-graph-mcp"
  image                 = var.cloud_run_use_bootstrap_image ? local.bootstrap_image : "${local.artifact_host}/ms-graph-mcp:${local.image_tag}"
  service_account_email = module.iam.service_account_emails["ms-graph-mcp"]
  container_port        = 8080
  cpu                   = "1"
  memory                = "512Mi"
  min_instances         = 0
  max_instances         = 2
  container_concurrency = 40
  health_path           = var.cloud_run_use_bootstrap_image ? "/" : "/healthz"
  enable_probes         = !var.cloud_run_use_bootstrap_image
  # IAM-private; same Direct VPC reachability rationale as api-server.
  ingress               = "INGRESS_TRAFFIC_ALL"
  allow_unauthenticated = false
  invoker_members = [
    "serviceAccount:${module.iam.service_account_emails["frontend"]}",
    "serviceAccount:${module.iam.service_account_emails["api-server"]}",
  ]
  vpc_network = module.networking.vpc_self_link
  vpc_subnet  = module.networking.subnet_self_link

  env_vars = {
    NODE_ENV           = "production"
    GRAPH_API_BASE_URL = "https://graph.microsoft.com/v1.0"
  }

  secret_env_vars = []

  depends_on = [
    google_project_service.run,
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

# Idempotent lookups + catalogue group labels for every tenant. Run after migrate-api.
resource "google_cloud_run_v2_job" "seed_api_lookups" {
  count    = var.enable_cloud_run ? 1 : 0
  project  = var.project_id
  name     = "seed-api-lookups"
  location = var.region

  template {
    template {
      service_account = module.iam.service_account_emails["api-server"]
      timeout         = "300s"
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
        command = ["node", "dist/database/run-seed-lookups.js"]

        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
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

# Catalogue seed (auth-server image). Run after migrate-api — API owns RBAC DDL.
resource "google_cloud_run_v2_job" "seed_auth_rbac" {
  count    = var.enable_cloud_run ? 1 : 0
  project  = var.project_id
  name     = "seed-auth-rbac"
  location = var.region

  template {
    template {
      service_account = module.iam.service_account_emails["auth-server"]
      timeout         = "300s"
      max_retries     = 1

      vpc_access {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = regex("projects/.+$", module.networking.vpc_self_link)
          subnetwork = regex("projects/.+$", module.networking.subnet_self_link)
        }
      }

      containers {
        image   = var.cloud_run_use_bootstrap_image ? local.bootstrap_image : "${local.artifact_host}/auth-server:${local.image_tag}"
        command = ["node", "dist/scripts/seed-rbac.js"]

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = "database-url-auth"
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [google_project_service.run]
}

terraform {
  required_version = ">= 1.3.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

locals {
  secret_names = [
    "database-url-api",
    "database-url-auth",
    "redis-url",
    "nats-url",
    "credentials-encryption-key",
    "auth-jwt-secret",
    "auth-oidc-client-secret",
    "auth-dcr-secret",
    "auth-dcr-iat-key",
    "auth-oidc-cookies-keys",
    "auth-google-client-id",
    "auth-google-client-secret",
    "auth-jwks-rsa-n",
    "auth-jwks-rsa-d",
    "auth-jwks-rsa-p",
    "auth-jwks-rsa-q",
    "auth-jwks-rsa-dp",
    "auth-jwks-rsa-dq",
    "auth-jwks-rsa-qi",
    "auth-jwks-ec-d",
    "auth-jwks-ec-x",
    "auth-jwks-ec-y",
    "oidc-jwks",
    "openai-api-key",
    "gcs-hmac-access-key",
    "gcs-hmac-secret-key",
    "stripe-secret-key",
    "stripe-webhook-secret",
    "stripe-connect-client-id",
    "mz-client-credentials",
    "frontend-oidc-cookie-secret",
  ]
}

resource "google_secret_manager_secret" "this" {
  for_each  = toset(local.secret_names)
  project   = var.project_id
  secret_id = each.value

  replication {
    auto {}
  }

  labels = {
    environment = var.environment
  }
}

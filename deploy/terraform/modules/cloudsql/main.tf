terraform {
  required_version = ">= 1.3.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0"
    }
  }
}

resource "random_password" "sql_admin" {
  length           = 32
  special          = true
  override_special = "-_"
}

locals {
  # Only "claims_manager" is actively used - both the API (claims-manager) and
  # the auth-server connect to it. apps/auth-server/src/db/client.ts asserts
  # the expected db name is "claims_manager" and refuses to start otherwise;
  # deploy/scripts/seed-staging-secrets.ps1 matches by pointing
  # database-url-auth at "claims_manager" as well.
  #
  # The "auth" and "chat" databases are legacy placeholders from an earlier
  # design where each service had its own db. They are kept here (and not
  # deleted) because removing them from this list makes terraform destroy the
  # physical database on next apply. Do NOT reference them from application
  # config.
  database_ids = ["claims_manager", "auth", "chat"]
}

resource "google_sql_database_instance" "this" {
  project             = var.project_id
  name                = "claims-manager-pg-${var.environment}"
  region              = var.region
  database_version    = "POSTGRES_17"
  deletion_protection = true

  settings {
    edition           = "ENTERPRISE"
    tier              = var.tier
    availability_type = var.availability_type

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.private_network
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled    = true
      start_time = "03:00"

      backup_retention_settings {
        retained_backups = var.backup_retention_days
        retention_unit   = "COUNT"
      }
    }

    database_flags {
      name  = "max_locks_per_transaction"
      value = "256"
    }
  }
}

resource "google_sql_database" "databases" {
  for_each = toset(local.database_ids)

  project  = var.project_id
  name     = each.key
  instance = google_sql_database_instance.this.name
}

resource "google_sql_user" "admin" {
  project  = var.project_id
  name     = "claims_manager_admin"
  instance = google_sql_database_instance.this.name
  password = random_password.sql_admin.result
}

terraform {
  required_version = ">= 1.3.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

resource "google_redis_instance" "this" {
  project              = var.project_id
  name                 = "claims-manager-redis-${var.environment}"
  region               = var.region
  tier                 = var.tier
  memory_size_gb       = var.memory_size_gb
  redis_version        = "REDIS_7_0"
  connect_mode         = "PRIVATE_SERVICE_ACCESS"
  authorized_network   = var.authorized_network

  redis_configs = {
    "maxmemory-policy" = "allkeys-lru"
  }
}

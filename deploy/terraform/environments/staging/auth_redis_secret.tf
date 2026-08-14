# Bootstrap a first version for auth-redis-encryption-key so Cloud Run can
# mount REDIS_ENCRYPTION_KEY. Without a version, auth-server fails env
# validation at boot (NODE_ENV=production). ignore_changes keeps a
# manually rotated value from being overwritten on later applies.
resource "random_id" "auth_redis_encryption_key" {
  byte_length = 32
}

resource "google_secret_manager_secret_version" "auth_redis_encryption_key" {
  secret      = "projects/${var.project_id}/secrets/auth-redis-encryption-key"
  secret_data = random_id.auth_redis_encryption_key.hex

  depends_on = [module.secrets]

  lifecycle {
    ignore_changes = [secret_data]
  }
}

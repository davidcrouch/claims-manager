output "bucket_names" {
  value = { for k, b in google_storage_bucket.buckets : k => b.name }
}

output "hmac_access_key" {
  value     = length(google_storage_hmac_key.this) > 0 ? google_storage_hmac_key.this[0].access_id : null
  sensitive = false
}

output "hmac_secret" {
  value     = length(google_storage_hmac_key.this) > 0 ? google_storage_hmac_key.this[0].secret : null
  sensitive = true
}

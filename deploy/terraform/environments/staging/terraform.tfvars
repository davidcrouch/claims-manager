project_id       = "claims-manager-staging-493807"
infra_project_id = "claims-manager-infra-493807"
region           = "australia-southeast1"
environment      = "staging"
# Smallest dedicated shape for cost-sensitive staging (1 vCPU, 3.75 GiB).
cloudsql_tier = "db-custom-1-3840"
dns_name      = "staging.branlamie.com."

staging_vm_zone              = "australia-southeast1-a"
staging_vm_data_disk_size_gb = 20
# 35.235.240.0/20 is the GCP IAP tunnel range - SSH via `gcloud compute ssh --tunnel-through-iap`.
staging_vm_admin_cidr = "35.235.240.0/20"

caddy_admin_email = "ops@branlamie.com"

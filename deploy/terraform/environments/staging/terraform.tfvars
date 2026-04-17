project_id       = "claims-manager-staging"
infra_project_id = "claims-manager-infra"
region           = "australia-southeast1"
environment      = "staging"
# Smallest dedicated shape for cost-sensitive staging (1 vCPU, 3.75 GiB).
cloudsql_tier    = "db-custom-1-3840"
dns_name         = "staging.claims-manager.example.com."

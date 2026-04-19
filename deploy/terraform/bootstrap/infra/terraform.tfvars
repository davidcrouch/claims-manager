infra_project_id   = "claims-manager-infra-493807"
staging_project_id = "claims-manager-staging-493807"
region             = "australia-southeast1"
state_bucket_name  = "claims-manager-terraform-state"

# GitHub repo that is allowed to impersonate ci-deployer via WIF.
# Verified from `git remote -v`. Update if the repo is ever forked/moved
# or mirrored under the branlamie org.
github_owner = "davidcrouch"
github_repo  = "claims-manager"

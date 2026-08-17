# Secret was created outside Terraform (manual / prior bootstrap) before it was
# added to module.secrets. Import once so apply does not 409 on create.
import {
  to = module.secrets.google_secret_manager_secret.this["resend-api-key"]
  id = "projects/claims-manager-staging-493807/secrets/resend-api-key"
}

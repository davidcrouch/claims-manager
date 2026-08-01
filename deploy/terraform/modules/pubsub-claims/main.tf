# Domain Pub/Sub topics for Claims Manager cross-tenant events.
# Creates topics + DLQ topics + DLQ pull subs. Push subscriptions are
# intentionally omitted here — wire them from staging/production (or a
# tunnel-backed local root) once a reachable push endpoint exists.

locals {
  domains = toset([
    "purchase-orders",
    "work-orders",
    "organisations",
    "invoices",
    "bills",
  ])

  # Domains that receive cross-tenant push events today
  push_domains = toset([
    "purchase-orders",
    "work-orders",
    "organisations",
  ])

  labels = merge(var.labels, {
    product = "claims-manager"
    env     = var.env
    layer   = "domain-events"
  })
}

module "topic" {
  for_each = local.domains
  source   = "../pubsub-topic"

  name    = "claims.${each.key}-${var.env}"
  project = var.project_id
  labels  = merge(local.labels, { domain = each.key })
}

module "dlq_topic" {
  for_each = local.push_domains
  source   = "../pubsub-topic"

  name    = "claims.${each.key}-api-sub-${var.env}-dlq"
  project = var.project_id
  labels  = merge(local.labels, { domain = each.key, layer = "dlq" })
}

# Pull-only DLQ triage subscriptions (no push, no retry policy required)
module "dlq_pull" {
  for_each = local.push_domains
  source   = "../pubsub-subscription"

  name    = "claims.${each.key}-api-sub-${var.env}-dlq-pull"
  project = var.project_id
  topic   = module.dlq_topic[each.key].name
}

# Optional: create push subscriptions when a reachable endpoint is provided
module "api_push" {
  for_each = var.push_endpoint == null ? toset([]) : local.push_domains
  source   = "../pubsub-subscription"

  name                            = "claims.${each.key}-api-sub-${var.env}"
  project                         = var.project_id
  topic                           = module.topic[each.key].name
  push_endpoint                   = var.push_endpoint
  push_oidc_service_account_email = var.push_oidc_sa_email
  dead_letter_topic_id            = module.dlq_topic[each.key].id
  dlq_max_attempts                = var.dlq_max_attempts
}

# Pub/Sub service agent must be able to publish into DLQ topics
resource "google_pubsub_topic_iam_member" "dlq_pubsub_publisher" {
  for_each = local.push_domains

  project = var.project_id
  topic   = module.dlq_topic[each.key].name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:service-${var.project_number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

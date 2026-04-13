resource "google_artifact_registry_repository" "this" {
  project         = var.project_id
  location        = var.location
  repository_id   = "claims-manager"
  description     = "Claims Manager Docker images"
  format          = "DOCKER"
}

resource "google_artifact_registry_repository_iam_member" "reader" {
  for_each = toset(var.reader_members)

  project    = var.project_id
  location   = var.location
  repository = google_artifact_registry_repository.this.repository_id
  role       = "roles/artifactregistry.reader"
  member     = each.value
}

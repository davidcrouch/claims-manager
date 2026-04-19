#!/usr/bin/env bash
set -euo pipefail

REGISTRY="australia-southeast1-docker.pkg.dev/claims-manager-infra-493807/claims-manager"
JOBS_NS="jobs"

# Migrations run before full kustomize apply in CI; namespaces must exist first.
ensure_namespaces() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local ns_file="${script_dir}/../k8s/base/namespaces.yaml"
  echo "[deploy.sh] ensure_namespaces: kubectl apply -f ${ns_file}"
  kubectl apply -f "$ns_file"
}

# DB URLs for migrate Jobs live in namespace jobs (not platform); ExternalSecrets sync before Jobs run.
ensure_migrate_secrets_in_jobs() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local project_id="${GCP_PROJECT_ID:-${PROJECT_ID:-}}"
  if [[ -z "$project_id" ]]; then
    echo "[deploy.sh] ERROR: Set PROJECT_ID or GCP_PROJECT_ID (e.g. claims-manager-staging-493807) so migrate can sync secrets into namespace jobs." >&2
    exit 1
  fi

  local es_file="${script_dir}/../k8s/base/jobs/jobs-migrate-secrets.yaml"
  echo "[deploy.sh] ensure_migrate_secrets_in_jobs: kubectl apply (project ${project_id})"
  sed "s|PROJECT_ID|${project_id}|g" "$es_file" | kubectl apply -f -

  local es
  for es in api-server-secrets auth-server-secrets; do
    echo "[deploy.sh] ensure_migrate_secrets_in_jobs: waiting for ExternalSecret jobs/${es}"
    kubectl -n jobs wait --for=condition=Ready --timeout=180s "externalsecret/${es}" || {
      echo "[deploy.sh] ERROR: ExternalSecret jobs/${es} did not become Ready"
      kubectl -n jobs describe "externalsecret/${es}" || true
      exit 1
    }
  done
}

usage() {
  echo "Usage:"
  echo "  $0 migrate <image-tag>    Run all database migration Jobs"
  echo "  $0 all <image-tag>        Run migrations then deploy services (local / advanced use)"
  exit 1
}

wait_for_job() {
  local job_name=$1
  local namespace=${2:-$JOBS_NS}
  local timeout=${3:-300}
  local poll_interval=5
  local elapsed=0

  echo "[deploy.sh] wait_for_job: waiting for job ${namespace}/${job_name} (timeout: ${timeout}s)..."
  while (( elapsed < timeout )); do
    local conditions
    conditions=$(kubectl -n "$namespace" get "job/${job_name}" \
      -o jsonpath='{.status.conditions[?(@.status=="True")].type}' 2>/dev/null) || true

    if [[ "$conditions" == *"Complete"* ]]; then
      echo "[deploy.sh] wait_for_job: job ${job_name} completed successfully"
      return 0
    fi

    if [[ "$conditions" == *"Failed"* ]]; then
      echo "[deploy.sh] wait_for_job: ERROR: job ${job_name} failed"
      local pod
      pod=$(kubectl -n "$namespace" get pods -l "job-name=${job_name}" \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null) || true
      if [[ -n "$pod" ]]; then
        kubectl -n "$namespace" logs "pod/${pod}" --tail=80 || true
      fi
      exit 1
    fi

    sleep "$poll_interval"
    elapsed=$((elapsed + poll_interval))
  done

  echo "[deploy.sh] wait_for_job: ERROR: job ${job_name} timed out after ${timeout}s"
  local pod
  pod=$(kubectl -n "$namespace" get pods -l "job-name=${job_name}" \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null) || true
  if [[ -n "$pod" ]]; then
    echo "[deploy.sh] wait_for_job: pod status:"
    kubectl -n "$namespace" get "pod/${pod}" -o wide || true
    echo "[deploy.sh] wait_for_job: pod logs:"
    kubectl -n "$namespace" logs "pod/${pod}" --tail=80 || true
  else
    echo "[deploy.sh] wait_for_job: no pods found for job ${job_name}"
    kubectl -n "$namespace" describe "job/${job_name}" || true
  fi
  exit 1
}

run_migrations() {
  local image_tag=$1
  echo "[deploy.sh] run_migrations: running database migrations with tag: ${image_tag}"

  ensure_namespaces
  ensure_migrate_secrets_in_jobs

  for migration_file in deploy/k8s/base/jobs/migrate-*.yaml; do
    local basename
    basename=$(basename "$migration_file" .yaml)
    echo "[deploy.sh] run_migrations: applying migration: ${basename}"

    local manifest
    manifest=$(sed "s|IMAGE_TAG|${image_tag}|g" "$migration_file")

    local job_name
    job_name=$(echo "$manifest" | grep -o 'name: [^ ]*' | head -1 | awk '{print $2}')

    kubectl -n "$JOBS_NS" delete "job/${job_name}" --ignore-not-found=true 2>/dev/null || true

    echo "$manifest" | kubectl apply -f -
    echo "[deploy.sh] run_migrations: applied job: ${job_name}"

    wait_for_job "$job_name"

    kubectl -n "$JOBS_NS" delete "job/${job_name}" --ignore-not-found=true
  done

  echo "[deploy.sh] run_migrations: all migrations completed"
}

run_all() {
  local image_tag=$1

  run_migrations "$image_tag"

  echo "[deploy.sh] run_all: deploying services..."
  cd deploy/k8s
  kustomize build overlays/staging | \
    sed "s|IMAGE_TAG|${image_tag}|g" | \
    kubectl apply -f -
  cd ../..

  echo "[deploy.sh] run_all: restarting deployments..."
  for ns in platform gateways workers frontend infra; do
    DEPLOYMENTS=$(kubectl -n "$ns" get deployment -o name 2>/dev/null || true)
    for deploy in $DEPLOYMENTS; do
      echo "[deploy.sh] run_all: restarting ${ns}/${deploy}..."
      kubectl -n "$ns" rollout restart "$deploy"
    done
  done

  echo "[deploy.sh] run_all: waiting for rollouts..."
  ROLLOUT_FAILED=0
  for ns in platform gateways workers frontend infra; do
    DEPLOYMENTS=$(kubectl -n "$ns" get deployment -o name 2>/dev/null || true)
    for deploy in $DEPLOYMENTS; do
      echo "[deploy.sh] run_all: waiting for ${ns}/${deploy}..."
      if ! kubectl -n "$ns" rollout status "$deploy" --timeout=420s; then
        echo "[deploy.sh] run_all: ERROR: ${ns}/${deploy} failed to roll out"
        kubectl -n "$ns" describe "$deploy" || true
        POD=$(kubectl -n "$ns" get pods -l "app=$(echo "$deploy" | sed 's|deployment.apps/||')" \
          --sort-by=.metadata.creationTimestamp -o name 2>/dev/null | tail -1)
        if [[ -n "$POD" ]]; then
          echo "[deploy.sh] run_all: pod status:"
          kubectl -n "$ns" describe "$POD" || true
          echo "[deploy.sh] run_all: pod logs:"
          kubectl -n "$ns" logs "$POD" --tail=40 || true
        fi
        ROLLOUT_FAILED=1
      fi
    done
  done
  if [[ "$ROLLOUT_FAILED" -ne 0 ]]; then
    echo "[deploy.sh] run_all: ERROR: one or more rollouts failed"
    exit 1
  fi

  echo "[deploy.sh] run_all: full deployment completed"
}

[[ $# -lt 2 ]] && usage

COMMAND=$1
IMAGE_TAG=$2

case "$COMMAND" in
  migrate)
    run_migrations "$IMAGE_TAG"
    ;;
  all)
    run_all "$IMAGE_TAG"
    ;;
  *)
    usage
    ;;
esac

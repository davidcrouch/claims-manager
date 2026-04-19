#!/usr/bin/env bash
set -euo pipefail

REGISTRY="australia-southeast1-docker.pkg.dev/claims-manager-infra-493807/claims-manager"

NAMESPACE_MAP=(
  "api-server:platform"
  "auth-server:platform"
  "frontend:frontend"
)

usage() {
  echo "Usage: $0 <service> <previous-tag>"
  echo ""
  echo "Services: api-server, auth-server, frontend"
  echo ""
  echo "Example: $0 api-server main-abc1234"
  exit 1
}

get_namespace() {
  local service=$1
  for entry in "${NAMESPACE_MAP[@]}"; do
    local svc="${entry%%:*}"
    local ns="${entry##*:}"
    if [[ "$svc" == "$service" ]]; then
      echo "$ns"
      return 0
    fi
  done
  echo "[rollback.sh] ERROR: Unknown service: ${service}" >&2
  exit 1
}

[[ $# -lt 2 ]] && usage

SERVICE=$1
TAG=$2
NAMESPACE=$(get_namespace "$SERVICE")

echo "[rollback.sh] Rolling back ${SERVICE} in ${NAMESPACE} to ${REGISTRY}/${SERVICE}:${TAG}"

kubectl -n "$NAMESPACE" set image "deployment/${SERVICE}" \
  "${SERVICE}=${REGISTRY}/${SERVICE}:${TAG}"

echo "[rollback.sh] Waiting for rollout to complete..."
kubectl -n "$NAMESPACE" rollout status "deployment/${SERVICE}" --timeout=120s

echo "[rollback.sh] Rollback of ${SERVICE} to ${TAG} completed successfully"

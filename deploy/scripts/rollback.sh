#!/usr/bin/env bash
set -euo pipefail

REGISTRY="australia-southeast1-docker.pkg.dev/claims-manager-infra-493807/claims-manager"

usage() {
  echo "Usage: $0 <environment> <service> <previous-tag>"
  echo ""
  echo "Environments: staging, production"
  echo "Services: api-server, auth-server, frontend, provider-server, claims-mcp, ms-graph-mcp"
  echo ""
  echo "Examples:"
  echo "  $0 staging api-server main-abc1234"
  echo "  $0 production frontend v1.2.3"
  exit 1
}

[[ $# -lt 3 ]] && usage

ENVIRONMENT=$1
SERVICE=$2
TAG=$3

case "$ENVIRONMENT" in
  staging)    PROJECT="claims-manager-staging-493807" ;;
  production) PROJECT="claims-manager-prod-493807" ;;
  *)
    echo "[rollback.sh] ERROR: Unknown environment '$ENVIRONMENT'" >&2
    usage
    ;;
esac

REGION="australia-southeast1"
IMAGE="${REGISTRY}/${SERVICE}:${TAG}"

# Validate service name
case "$SERVICE" in
  api-server|auth-server|frontend|provider-server|claims-mcp|ms-graph-mcp) ;;
  *)
    echo "[rollback.sh] ERROR: Unknown service '$SERVICE'" >&2
    usage
    ;;
esac

echo "[rollback.sh] Rolling back ${SERVICE} in ${ENVIRONMENT} to ${IMAGE}"

if ! gcloud run services describe "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" > /dev/null 2>&1; then
  echo "[rollback.sh] ERROR: Cloud Run service '$SERVICE' not found in $PROJECT" >&2
  exit 1
fi

gcloud run services update "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --image "$IMAGE"

echo "[rollback.sh] Verifying new revision is serving…"
URL=$(gcloud run services describe "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --format="value(status.url)")

echo "[rollback.sh] Rollback of ${SERVICE} to ${TAG} in ${ENVIRONMENT} completed"
echo "[rollback.sh] Service URL: ${URL}"

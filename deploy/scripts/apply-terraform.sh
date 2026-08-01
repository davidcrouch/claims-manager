#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <environment> [plan|apply|destroy]"
  echo ""
  echo "Environments: dev, staging, production"
  echo "Actions: plan (default), apply, destroy"
  echo ""
  echo "Examples:"
  echo "  $0 dev plan"
  echo "  $0 dev apply"
  echo "  $0 staging plan"
  echo "  $0 staging apply"
  echo "  $0 production plan"
  exit 1
}

[[ $# -lt 1 ]] && usage

ENVIRONMENT=$1
ACTION=${2:-plan}
TF_DIR="deploy/terraform/environments/${ENVIRONMENT}"

if [[ ! -d "$TF_DIR" ]]; then
  echo "[apply-terraform.sh] ERROR: Environment directory not found: ${TF_DIR}" >&2
  exit 1
fi

case "$ENVIRONMENT" in
  dev|staging|production) ;;
  *)
    echo "[apply-terraform.sh] ERROR: Unknown environment '${ENVIRONMENT}'" >&2
    usage
    ;;
esac

echo "[apply-terraform.sh] Running terraform ${ACTION} for ${ENVIRONMENT}"

cd "$TF_DIR"

terraform init -upgrade

case "$ACTION" in
  plan)
    terraform plan -out=tfplan
    echo "[apply-terraform.sh] Plan saved to ${TF_DIR}/tfplan"
    echo "[apply-terraform.sh] Run '$0 ${ENVIRONMENT} apply' to apply"
    ;;
  apply)
    if [[ -f tfplan ]]; then
      terraform apply -auto-approve tfplan
      rm -f tfplan
    else
      echo "[apply-terraform.sh] No saved plan found. Running plan + apply..."
      terraform apply -auto-approve
    fi
    ;;
  destroy)
    if [[ "$ENVIRONMENT" == "production" ]]; then
      echo "[apply-terraform.sh] WARNING: You are about to destroy PRODUCTION infrastructure!"
      read -rp "Type 'destroy-production' to confirm: " confirm
      if [[ "$confirm" != "destroy-production" ]]; then
        echo "[apply-terraform.sh] Aborted."
        exit 1
      fi
    fi
    if [[ "$ENVIRONMENT" == "dev" ]]; then
      echo "[apply-terraform.sh] WARNING: Destroying DEV hybrid project resources (topics/secrets/GCS)."
    fi
    terraform destroy -auto-approve
    ;;
  *)
    usage
    ;;
esac

echo "[apply-terraform.sh] Done"

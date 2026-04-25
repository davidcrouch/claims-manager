#!/usr/bin/env bash
# staging_vm/startup.sh — Container-Optimized OS boot hook for claims-manager staging.
#
# Responsibilities (idempotent, every boot):
#   1. Mount the persistent data disk at /mnt/disks/data.
#   2. Create the directory layout used by docker compose (compose/caddy/docker).
#   3. Render /var/lib/claims-manager/staging.env from Secret Manager.
#   4. Configure Artifact Registry docker login + install compose CLI plugin.
#   5. Start the compose stack shipped by CI at /mnt/disks/data/compose.
#
# CI is responsible for uploading the compose tree (see .github/workflows/cd-staging.yaml).
# If /mnt/disks/data/compose/compose.yaml is absent, this script exits 0 and waits for CI.

set -Eeuo pipefail

log() { echo "[staging_vm/startup.sh] $*"; }

METADATA="http://metadata.google.internal/computeMetadata/v1"
MD_HDR=("-H" "Metadata-Flavor: Google")

md() { curl -fsS "${MD_HDR[@]}" "${METADATA}/$1"; }

DATA_DEVICE=$(md "instance/attributes/data-disk-device" || echo "data")
SECRETS_PROJECT=$(md "instance/attributes/secrets-project-id")
ARTIFACT_HOST=$(md "instance/attributes/artifact-registry-host")
STAGING_DOMAIN=$(md "instance/attributes/staging-domain" || echo "staging.branlamie.com")
CADDY_ADMIN_EMAIL=$(md "instance/attributes/caddy-admin-email" || echo "ops@branlamie.com")

# ── 1. Mount data disk ──────────────────────────────────────────────
DATA_DEV_PATH="/dev/disk/by-id/google-${DATA_DEVICE}"
DATA_MOUNT="/mnt/disks/data"

mkdir -p "${DATA_MOUNT}"

if ! blkid "${DATA_DEV_PATH}" >/dev/null 2>&1; then
  log "formatting fresh data disk ${DATA_DEV_PATH} as ext4"
  mkfs.ext4 -F -E lazy_itable_init=0,lazy_journal_init=0,discard "${DATA_DEV_PATH}"
fi

if ! mountpoint -q "${DATA_MOUNT}"; then
  log "mounting ${DATA_DEV_PATH} at ${DATA_MOUNT}"
  mount -o discard,defaults "${DATA_DEV_PATH}" "${DATA_MOUNT}"
fi

# ── 2. Directory layout on the data disk ────────────────────────────
install -d -m 0755 \
  "${DATA_MOUNT}/compose" \
  "${DATA_MOUNT}/caddy-data" \
  "${DATA_MOUNT}/caddy-config"

install -d -m 0700 /var/lib/claims-manager

# ── 3. Render /var/lib/claims-manager/staging.env from Secret Manager
TOKEN=$(md "instance/service-accounts/default/token" | sed 's/.*"access_token":"\([^"]*\)".*/\1/')

secret_value() {
  local name="$1"
  # Secret Manager returns pretty-printed JSON across multiple lines, so grep the
  # "data" line first, then strip everything but the base64 payload before decoding.
  curl -fsS -H "Authorization: Bearer ${TOKEN}" \
    "https://secretmanager.googleapis.com/v1/projects/${SECRETS_PROJECT}/secrets/${name}/versions/latest:access" \
    | grep '"data"' \
    | sed 's/.*"data": *"\([^"]*\)".*/\1/' \
    | base64 -d
}

render_env() {
  local tmp
  tmp=$(mktemp)
  {
    echo "# Rendered by staging_vm/startup.sh - do not edit by hand."
    echo "APP_ENV=staging"
    echo "NODE_ENV=production"
    echo "LOG_LEVEL=info"

    # Public hostnames (Caddy routes, OIDC redirect builders).
    echo "API_HOST=api.${STAGING_DOMAIN}"
    echo "AUTH_HOST=auth.${STAGING_DOMAIN}"
    echo "APP_HOST=app.${STAGING_DOMAIN}"
    echo "CADDY_ADMIN_EMAIL=${CADDY_ADMIN_EMAIL}"

    # CloudSQL (private IP) + Memorystore (private IP) connections.
    echo "DATABASE_URL_API=$(secret_value database-url-api)"
    echo "DATABASE_URL_AUTH=$(secret_value database-url-auth)"
    local redis_url redis_host redis_port
    redis_url=$(secret_value redis-url)
    # auth-server consumes REDIS_HOST/REDIS_PORT rather than REDIS_URL
    # (see apps/auth-server env.sample). Parse them out of redis-url so
    # only one secret needs maintenance.
    redis_host=$(echo "${redis_url}" | sed -E 's|^rediss?://([^:/]+)(:[0-9]+)?.*|\1|')
    redis_port=$(echo "${redis_url}" | sed -nE 's|^rediss?://[^:]+:([0-9]+).*|\1|p')
    [[ -z "${redis_port}" ]] && redis_port=6379
    echo "REDIS_URL=${redis_url}"
    echo "REDIS_HOST=${redis_host}"
    echo "REDIS_PORT=${redis_port}"

    # API server — credentials-at-rest encryption.
    echo "CREDENTIALS_ENCRYPTION_KEY=$(secret_value credentials-encryption-key)"

    # Auth server — JWT + OIDC cookies + DCR secrets.
    echo "AUTH_JWT_SECRET=$(secret_value auth-jwt-secret)"
    echo "JWT_PUBLIC_KEY_N=$(secret_value auth-jwks-rsa-n)"
    echo "JWT_PRIVATE_KEY_D=$(secret_value auth-jwks-rsa-d)"
    echo "JWT_PRIVATE_KEY_P=$(secret_value auth-jwks-rsa-p)"
    echo "JWT_PRIVATE_KEY_Q=$(secret_value auth-jwks-rsa-q)"
    echo "JWT_PRIVATE_KEY_DP=$(secret_value auth-jwks-rsa-dp)"
    echo "JWT_PRIVATE_KEY_DQ=$(secret_value auth-jwks-rsa-dq)"
    echo "JWT_PRIVATE_KEY_QI=$(secret_value auth-jwks-rsa-qi)"
    echo "JWT_EC_PRIVATE_KEY_D=$(secret_value auth-jwks-ec-d)"
    echo "JWT_EC_PUBLIC_KEY_X=$(secret_value auth-jwks-ec-x)"
    echo "JWT_EC_PUBLIC_KEY_Y=$(secret_value auth-jwks-ec-y)"
    echo "DYNAMIC_REGISTRATION_SECRET=$(secret_value auth-dcr-secret)"
    echo "DCR_IAT_SIGNING_KEY=$(secret_value auth-dcr-iat-key)"
    echo "OIDC_COOKIES_KEYS=$(secret_value auth-oidc-cookies-keys)"
    echo "GOOGLE_CLIENT_ID=$(secret_value auth-google-client-id)"
    echo "GOOGLE_CLIENT_SECRET=$(secret_value auth-google-client-secret)"
    echo "AUTH_OIDC_CLIENT_SECRET=$(secret_value auth-oidc-client-secret)"

    # Frontend — OIDC cookie signing.
    echo "FRONTEND_OIDC_COOKIE_SECRET=$(secret_value frontend-oidc-cookie-secret)"

    # GCS HMAC creds (frontend signed-URL usage).
    echo "GCS_HMAC_ACCESS_KEY=$(secret_value gcs-hmac-access-key)"
    echo "GCS_HMAC_SECRET_KEY=$(secret_value gcs-hmac-secret-key)"

    # Shared secret for api-server /internal/* routes. Consumed by both
    # api-server (validates incoming x-internal-token header) and
    # auth-server (sends the header when calling seed-tenant after
    # signup). See apps/api/src/modules/internal/ and
    # apps/auth-server/src/services/api-seed-client.ts.
    echo "INTERNAL_API_TOKEN=$(secret_value internal-api-token)"
    # Feature flag: enable sample-data seeding for brand-new tenants.
    # Staging = "true"; production keeps this off unless explicitly set.
    echo "SEED_NEW_TENANTS=true"
    # auth-server uses this to reach api-server over the compose internal
    # network. api-server listens on port 3001 inside the container.
    echo "API_INTERNAL_URL=http://api-server:3001"
  } > "${tmp}"

  install -m 0600 "${tmp}" /var/lib/claims-manager/staging.env
  rm -f "${tmp}"
}

render_env
log "rendered /var/lib/claims-manager/staging.env"

# ── 4. Artifact Registry docker login + compose plugin ─────────────
# COS constraints we work around here:
#   * /root is read-only, so ~/.docker/config.json is unusable.
#   * /var is mounted with noexec, so executable CLI plugins cannot live there.
#   * The data disk mount (/mnt/disks/data) is writable AND exec, so both the
#     docker client config and the compose plugin are anchored there via
#     DOCKER_CONFIG.
DOCKER_CFG_DIR="${DATA_MOUNT}/docker"
install -d -m 0755 "${DOCKER_CFG_DIR}"
cat > "${DOCKER_CFG_DIR}/config.json" <<JSON
{
  "credHelpers": {
    "${ARTIFACT_HOST}": "gcr"
  }
}
JSON
chmod 0644 "${DOCKER_CFG_DIR}/config.json"

install -d -m 0755 /etc/profile.d 2>/dev/null || true
cat > /etc/profile.d/claims-manager-docker.sh <<PROFILE
export DOCKER_CONFIG=${DOCKER_CFG_DIR}
PROFILE
chmod 0644 /etc/profile.d/claims-manager-docker.sh 2>/dev/null || true

COMPOSE_VERSION="v2.29.7"
COMPOSE_PLUGIN_DIR="${DOCKER_CFG_DIR}/cli-plugins"
COMPOSE_PLUGIN_BIN="${COMPOSE_PLUGIN_DIR}/docker-compose"
install -d -m 0755 "${COMPOSE_PLUGIN_DIR}"
if [[ ! -x "${COMPOSE_PLUGIN_BIN}" ]] \
    || ! "${COMPOSE_PLUGIN_BIN}" version 2>/dev/null | grep -q "${COMPOSE_VERSION}"; then
  log "installing docker compose plugin ${COMPOSE_VERSION}"
  curl -fsSL \
    "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
    -o "${COMPOSE_PLUGIN_BIN}.tmp"
  chmod 0755 "${COMPOSE_PLUGIN_BIN}.tmp"
  mv "${COMPOSE_PLUGIN_BIN}.tmp" "${COMPOSE_PLUGIN_BIN}"
fi

export DOCKER_CONFIG="${DOCKER_CFG_DIR}"

# ── 5. Start compose stack if CI has shipped it ─────────────────────
COMPOSE_DIR="${DATA_MOUNT}/compose"
if [[ -f "${COMPOSE_DIR}/compose.yaml" ]]; then
  log "starting compose stack in ${COMPOSE_DIR}"
  cd "${COMPOSE_DIR}"

  if [[ -f "${COMPOSE_DIR}/compose.override.yaml" ]]; then
    docker compose -f compose.yaml -f compose.override.yaml --env-file /var/lib/claims-manager/staging.env pull || true
    docker compose -f compose.yaml -f compose.override.yaml --env-file /var/lib/claims-manager/staging.env up -d
  else
    docker compose -f compose.yaml --env-file /var/lib/claims-manager/staging.env pull || true
    docker compose -f compose.yaml --env-file /var/lib/claims-manager/staging.env up -d
  fi
else
  log "no compose.yaml at ${COMPOSE_DIR}; waiting for CI to ship the tree"
fi

log "startup complete"

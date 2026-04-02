#!/bin/bash
# More0AI Infrastructure Initialization Script
#
# Run this after starting infrastructure to ensure all databases and buckets exist.
# Safe to run multiple times - uses IF NOT EXISTS / --ignore-existing.
#
# Usage:
#   ./init.sh                    # Initialize everything
#   ./init.sh --databases        # Only databases
#   ./init.sh --buckets          # Only MinIO buckets

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default credentials (override via environment or .env)
source .env 2>/dev/null || true
DB_USER="${DB_USERNAME:-more0ai}"
DB_PASS="${DB_PASSWORD:-secret}"
MINIO_USER="${MINIO_ROOT_USER:-sail}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-password}"

# Parse arguments
INIT_DATABASES=true
INIT_BUCKETS=true

if [[ "$1" == "--databases" ]]; then
    INIT_BUCKETS=false
elif [[ "$1" == "--buckets" ]]; then
    INIT_DATABASES=false
fi

echo -e "${BLUE}Initializing More0AI Infrastructure...${NC}"
echo ""

# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================
init_databases() {
    echo -e "${YELLOW}Setting up PostgreSQL databases...${NC}"
    
    # List of databases to create
    DATABASES=(
        "workers_comp"
        "workers_comp_testing"
        "pdf_test_gen"
        "pdf_test_gen_testing"
    )
    
    for db in "${DATABASES[@]}"; do
        echo -n "  Creating database '$db'... "
        docker exec more0ai-pgsql psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $db;" 2>/dev/null && \
            echo -e "${GREEN}created${NC}" || \
            echo -e "${YELLOW}exists${NC}"
        
        # Enable vector extension
        docker exec more0ai-pgsql psql -U "$DB_USER" -d "$db" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null
    done
    
    echo -e "${GREEN}✓ Databases ready${NC}"
    echo ""
}

# ============================================================================
# MINIO BUCKET INITIALIZATION
# ============================================================================
init_buckets() {
    echo -e "${YELLOW}Setting up MinIO buckets...${NC}"
    
    # List of buckets to create
    BUCKETS=(
        "workers-comp"
        "pdf-test-gen"
        "more0ai-shared"
    )
    
    for bucket in "${BUCKETS[@]}"; do
        echo -n "  Creating bucket '$bucket'... "
        docker run --rm --network more0ai-infra --entrypoint /bin/sh minio/mc -c \
            "mc alias set minio http://minio:9000 $MINIO_USER $MINIO_PASS >/dev/null 2>&1 && \
             mc mb --ignore-existing minio/$bucket >/dev/null 2>&1 && \
             mc anonymous set download minio/$bucket >/dev/null 2>&1" && \
            echo -e "${GREEN}ready${NC}" || \
            echo -e "${RED}failed${NC}"
    done
    
    # Configure CORS for all buckets
    echo -n "  Configuring CORS... "
    docker run --rm --network more0ai-infra --entrypoint /bin/sh minio/mc -c "
        mc alias set minio http://minio:9000 $MINIO_USER $MINIO_PASS >/dev/null 2>&1
        cat > /tmp/cors.json << 'EOF'
{
  \"CORSRules\": [
    {
      \"AllowedOrigins\": [\"*\"],
      \"AllowedMethods\": [\"GET\", \"PUT\", \"POST\", \"DELETE\", \"HEAD\"],
      \"AllowedHeaders\": [\"*\"],
      \"ExposeHeaders\": [\"ETag\", \"x-amz-meta-*\"],
      \"MaxAgeSeconds\": 3600
    }
  ]
}
EOF
        for bucket in workers-comp pdf-test-gen more0ai-shared; do
            mc cors set minio/\$bucket /tmp/cors.json 2>/dev/null || true
        done
    " && echo -e "${GREEN}done${NC}" || echo -e "${YELLOW}skipped${NC}"
    
    echo -e "${GREEN}✓ Buckets ready${NC}"
    echo ""
}

# ============================================================================
# MAIN
# ============================================================================

# Check if infrastructure is running
if ! docker ps | grep -q more0ai-pgsql; then
    echo -e "${RED}Error: Infrastructure not running. Start it first:${NC}"
    echo "  ./start.sh"
    exit 1
fi

# Run initialization
if $INIT_DATABASES; then
    init_databases
fi

if $INIT_BUCKETS; then
    init_buckets
fi

echo -e "${GREEN}Infrastructure initialization complete!${NC}"
echo ""
echo "Databases:"
docker exec more0ai-pgsql psql -U "$DB_USER" -d postgres -c "\l" 2>/dev/null | grep -E "workers_comp|pdf_test_gen" | awk '{print "  - " $1}'
echo ""
echo "Buckets:"
docker run --rm --network more0ai-infra --entrypoint /bin/sh minio/mc -c \
    "mc alias set minio http://minio:9000 $MINIO_USER $MINIO_PASS >/dev/null 2>&1 && mc ls minio/" 2>/dev/null | awk '{print "  - " $NF}'

#!/bin/bash
# More0AI Infrastructure Startup Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting More0AI Shared Infrastructure...${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env from env.example...${NC}"
    cp env.example .env
fi

# Start services
docker compose up -d

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"

# Wait for PostgreSQL
echo -n "PostgreSQL: "
until docker compose exec -T pgsql pg_isready -q 2>/dev/null; do
    echo -n "."
    sleep 1
done
echo -e "${GREEN}ready${NC}"

# Wait for Redis
echo -n "Redis: "
until docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do
    echo -n "."
    sleep 1
done
echo -e "${GREEN}ready${NC}"

# Wait for MinIO
echo -n "MinIO: "
until docker compose exec -T minio mc ready local 2>/dev/null; do
    echo -n "."
    sleep 1
done
echo -e "${GREEN}ready${NC}"

echo ""

# Run initialization to ensure databases and buckets exist
echo -e "${YELLOW}Running initialization...${NC}"
"$SCRIPT_DIR/init.sh"

echo -e "${GREEN}Infrastructure is ready!${NC}"
echo ""
echo "Services available at:"
echo "  PostgreSQL:  localhost:3210"
echo "  Redis:       localhost:3250"
echo "  MinIO:       localhost:3230 (Console: localhost:3231)"
echo "  Mailpit:     localhost:3241"
echo "  Grafana:     localhost:3276 (admin/admin)"
echo "  Prometheus:  localhost:3275"
echo "  Tempo:       localhost:3273"
echo "  Loki:        localhost:3274"
echo ""
echo "Start your application with:"
echo "  cd ../your-app && docker compose up -d"

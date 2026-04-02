#!/bin/bash
# More0AI Infrastructure Stop Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Stopping More0AI Shared Infrastructure..."
docker compose down

echo "Infrastructure stopped."
echo ""
echo "Note: Data volumes are preserved. To remove all data:"
echo "  docker compose down -v"

# More0AI Shared Infrastructure

This directory contains shared third-party services used by all More0AI applications.

Port block **3200-3299** is allocated to the `capabilities` project. See `.env.ports` and `.cursor/rules/port-allocation.mdc`.

## Services

| Service | Host Port | Container Port | Description |
|---------|-----------|----------------|-------------|
| PostgreSQL (pgvector) | 3210 | 5432 | Database with vector extension |
| Redis | 3250 | 6379 | Cache and queue backend |
| MinIO | 3230, 3231 | 9000, 8900 | S3-compatible object storage |
| Mailpit | 3240, 3241 | 1025, 8025 | Development email server |
| OpenTelemetry Collector | 3270, 3271, 3272 | 4317, 4318, 8889 | Telemetry collection |
| Tempo | 3273 | 3200 | Distributed tracing |
| Loki | 3274 | 3100 | Log aggregation |
| Prometheus | 3275 | 9090 | Metrics |
| Grafana | 3276 | 3000 | Dashboards |

## Quick Start

```bash
# 1. Copy environment file
cp env.example .env

# 2. Start infrastructure (automatically initializes databases and buckets)
./start.sh

# 3. Start your application (from its directory)
cd ../  # or cd to your app directory
docker compose up -d
```

## Initialization

The `init.sh` script ensures all databases and MinIO buckets exist. It's automatically run by `start.sh`, but you can run it manually anytime:

```bash
# Initialize everything
./init.sh

# Initialize only databases
./init.sh --databases

# Initialize only MinIO buckets
./init.sh --buckets
```

This script is safe to run multiple times - it uses `CREATE DATABASE IF NOT EXISTS` and `mc mb --ignore-existing`.

## Databases

The following databases are created automatically:

| Database | Application |
|----------|-------------|
| `capabilities` | Capabilities platform |
| `capabilities_test` | Capabilities (tests) |

### Adding a New Database

Edit `init-scripts/databases/01-create-databases.sql`:

```sql
CREATE DATABASE IF NOT EXISTS your_new_app;
GRANT ALL PRIVILEGES ON DATABASE your_new_app TO more0ai;

\c your_new_app
CREATE EXTENSION IF NOT EXISTS vector;
```

Then recreate the PostgreSQL container:

```bash
docker compose down pgsql
docker volume rm more0ai-pgsql-data
docker compose up -d pgsql
```

## MinIO Buckets

The following buckets are created automatically:

| Bucket | Application |
|--------|-------------|
| `workers-comp` | Workers Comp AI Paralegal |
| `pdf-test-gen` | PDF Test Generator |
| `more0ai-shared` | Shared resources |

### MinIO Console

Access the MinIO console at: http://localhost:3231

Default credentials:
- Username: `sail`
- Password: `password`

## Observability

### Grafana

Access Grafana at: http://localhost:3276

Default credentials:
- Username: `admin`
- Password: `admin`

Pre-configured dashboards:
- AI Agents
- Document Processing
- Job Performance
- Queue Operations
- Tools
- Workflows

### Prometheus

Access Prometheus at: http://localhost:3275

### Tempo (Traces)

Access Tempo at: http://localhost:3273

Traces are viewable in Grafana via the Tempo datasource.

### Loki (Logs)

Access Loki at: http://localhost:3274

Logs are viewable in Grafana via the Loki datasource.

## Application Configuration

### Connecting Applications

Applications connect to infrastructure via the `more0ai-infra` external network.

Example application `compose.yaml`:

```yaml
services:
  laravel.test:
    image: your-app/app
    environment:
      DB_HOST: pgsql
      DB_DATABASE: your_database
      REDIS_HOST: redis
      AWS_ENDPOINT: http://minio:9000
      MAIL_HOST: mailpit
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4317
    networks:
      - more0ai-infra

networks:
  more0ai-infra:
    external: true
```

### Environment Variables for Applications

Add these to your application's `.env`:

```bash
# Database (host ports for native dev)
DB_CONNECTION=pgsql
DB_HOST=localhost
DB_PORT=3210
DB_DATABASE=your_database
DB_USERNAME=more0ai
DB_PASSWORD=secret

# Redis
REDIS_HOST=localhost
REDIS_PORT=3250

# MinIO
AWS_ACCESS_KEY_ID=sail
AWS_SECRET_ACCESS_KEY=password
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=your-bucket
AWS_ENDPOINT=http://localhost:3230
AWS_USE_PATH_STYLE_ENDPOINT=true

# Email
MAIL_MAILER=smtp
MAIL_HOST=localhost
MAIL_PORT=3240

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3270
```

**Inside Docker**, use container ports and service names instead (5432, 6379, 9000, etc.).

## Commands

### Start all services
```bash
docker compose up -d
```

### Stop all services
```bash
docker compose down
```

### View logs
```bash
docker compose logs -f [service-name]
```

### Reset a specific service
```bash
docker compose down [service-name]
docker volume rm more0ai-[service]-data
docker compose up -d [service-name]
```

### Reset everything
```bash
docker compose down -v
docker compose up -d
```

## Troubleshooting

### PostgreSQL won't start
Check if the port is already in use:
```bash
lsof -i :3210
```

### Network not found
Ensure infrastructure is running before starting applications:
```bash
cd infrastructure
docker compose up -d
docker network ls | grep more0ai-infra
```

### MinIO buckets not created
The `minio-init` container runs once. To recreate buckets:
```bash
docker compose restart minio-init
```

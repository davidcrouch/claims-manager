-- Capabilities Infrastructure - Database Initialization
-- This script creates databases used by the capabilities project.
-- The default database (capabilities) is created by POSTGRES_DB env var;
-- this script creates the test database and enables extensions.

-- Create databases (PostgreSQL doesn't have IF NOT EXISTS for CREATE DATABASE)
SELECT 'CREATE DATABASE capabilities' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'capabilities')\gexec
SELECT 'CREATE DATABASE capabilities_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'capabilities_test')\gexec

-- Grant permissions (user 'more0ai' is created by POSTGRES_USER env var)
GRANT ALL PRIVILEGES ON DATABASE capabilities TO more0ai;
GRANT ALL PRIVILEGES ON DATABASE capabilities_test TO more0ai;

-- Enable extensions
\c capabilities
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c capabilities_test
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

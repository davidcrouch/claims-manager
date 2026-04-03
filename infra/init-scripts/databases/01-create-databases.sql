-- Claims Manager Infrastructure - Database Initialization
-- This script creates databases used by the claims-manager project.
-- The default database (more0ai) is created by POSTGRES_DB env var;
-- this script creates the claims_manager databases and enables extensions.

-- Create databases (PostgreSQL doesn't have IF NOT EXISTS for CREATE DATABASE)
SELECT 'CREATE DATABASE claims_manager' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'claims_manager')\gexec
SELECT 'CREATE DATABASE claims_manager_api' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'claims_manager_api')\gexec
SELECT 'CREATE DATABASE claims_manager_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'claims_manager_test')\gexec

-- Grant permissions (user 'more0ai' is created by POSTGRES_USER env var)
GRANT ALL PRIVILEGES ON DATABASE claims_manager TO more0ai;
GRANT ALL PRIVILEGES ON DATABASE claims_manager_api TO more0ai;
GRANT ALL PRIVILEGES ON DATABASE claims_manager_test TO more0ai;

-- Enable extensions
\c claims_manager
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c claims_manager_api
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c claims_manager_test
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

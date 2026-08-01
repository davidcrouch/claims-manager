-- Least-privilege grants for provider_app on claims_manager ingest tables.
-- Run as claims_manager_admin after terraform creates the provider_app user:
--   psql "$DATABASE_URL_ADMIN" -f deploy/scripts/grant-provider-app.sql
--
-- provider-server: HMAC verify → write inbound_webhook_events → enqueue More0.

GRANT CONNECT ON DATABASE claims_manager TO provider_app;
GRANT USAGE ON SCHEMA public TO provider_app;

GRANT SELECT, INSERT, UPDATE ON TABLE inbound_webhook_events TO provider_app;
GRANT SELECT, INSERT, UPDATE ON TABLE external_processing_log TO provider_app;
GRANT SELECT ON TABLE integration_connections TO provider_app;
GRANT SELECT ON TABLE organizations TO provider_app;

-- Sequences used by defaultRandom / serial if any (uuid defaults are fine).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO provider_app;

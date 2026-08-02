-- Add provisioning_status to organizations for first-login provisioning flow.
-- New orgs default to 'pending'; existing orgs are marked 'complete'.

ALTER TABLE organizations
  ADD COLUMN provisioning_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN provisioning_started_at timestamptz,
  ADD COLUMN provisioning_completed_at timestamptz;

-- All existing orgs have already been provisioned via seeds
UPDATE organizations SET provisioning_status = 'complete', provisioning_completed_at = NOW();

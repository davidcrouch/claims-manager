/**
 * E2E Test: Trigger a Builder Assessment job and monitor the workflow.
 */
import pg from 'pg';

const TENANT_ID = 'b71a5841-bd46-4622-aa7c-92b209243cc6';
const BA_LOOKUP_ID = '33e224b1-0f8f-4fab-88f1-5baf9a4a56a8';
const CM_API = 'http://localhost:5001/api/v1';
const AUTH_URL = 'http://localhost:3285/token';
const ME_DB = 'postgresql://more0ai:password@localhost:3210/more0_ensure';
const CM_DB = 'postgresql://more0ai:password@localhost:3210/claims_manager';
const CLAIM_ID = 'e579fd19-5d98-4016-a321-5c16953e8bb3';

// ── 1. Get token with correct audience ─────────────────────
console.log('=== 1. Acquiring auth token ===');
const tokenRes = await fetch(AUTH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'grant_type=client_credentials&client_id=more0-ensure-service&client_secret=dev-more0-ensure-secret&resource=http://more0.ai',
});
const tokenBody = await tokenRes.json();
const TOKEN = tokenBody.access_token;
if (!TOKEN) { console.error('Failed to get token:', tokenBody); process.exit(1); }
console.log('  Token acquired (aud=http://more0.ai)');

// ── 2. Count workflow runs BEFORE ──────────────────────────
const me = new pg.Client(ME_DB);
await me.connect();
const beforeRuns = await me.query(
  "SELECT COUNT(*) as cnt FROM workflow_runs WHERE workflow_name = 'workflow.job.assessment'"
);
console.log(`\n=== 2. Workflow runs before: ${beforeRuns.rows[0].cnt} ===`);

// ── 3. Create Builder Assessment Job ───────────────────────
console.log('\n=== 3. Creating Builder Assessment job ===');
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${TOKEN}`,
  'x-tenant-id': TENANT_ID,
};

const jobPayload = {
  claimId: CLAIM_ID,
  jobTypeLookupId: BA_LOOKUP_ID,
  customData: {
    requestDate: new Date().toISOString(),
    collectExcess: false,
    makeSafeRequired: false,
    approvalLimitApplicable: false,
    isSpecificSpecialistRequired: false,
  },
};

const createRes = await fetch(`${CM_API}/jobs?provider=direct`, {
  method: 'POST',
  headers,
  body: JSON.stringify(jobPayload),
});

if (!createRes.ok) {
  const errText = await createRes.text();
  console.error(`  Failed to create job: HTTP ${createRes.status}`, errText);
  await me.end();
  process.exit(1);
}

const job = await createRes.json();
console.log(`  Job created: id=${job.id}`);
console.log(`  Status: ${job.status?.name ?? 'unknown'}`);
console.log(`  JobType: ${job.jobType?.name ?? 'unknown'}`);

// ── 4. Wait and check for workflow run ─────────────────────
console.log('\n=== 4. Waiting 5s for workflow invocation... ===');
await new Promise(r => setTimeout(r, 5000));

const afterRuns = await me.query(
  "SELECT id, workflow_name, entity_id, status, current_state, error, tick_count, context, created_at FROM workflow_runs WHERE workflow_name = 'workflow.job.assessment' ORDER BY created_at DESC LIMIT 5"
);
console.log(`  Total assessment runs: ${afterRuns.rows.length}`);

let foundNew = false;
for (const run of afterRuns.rows) {
  const isNew = run.entity_id === job.id;
  if (isNew) foundNew = true;
  console.log(`\n  ${isNew ? '>>> NEW' : '    old'} run: id=${run.id}`);
  console.log(`    entity_id: ${run.entity_id}`);
  console.log(`    status: ${run.status}`);
  console.log(`    current_state: ${run.current_state}`);
  console.log(`    tick_count: ${run.tick_count}`);
  console.log(`    created: ${run.created_at}`);
  if (run.error) console.log(`    ERROR: ${run.error}`);
  if (isNew && run.context) {
    const ctx = typeof run.context === 'string' ? JSON.parse(run.context) : run.context;
    console.log(`    context keys: ${Object.keys(ctx).join(', ')}`);
    console.log(`    claimId: ${ctx.claimId ?? 'NOT SET'}`);
    console.log(`    lookups: ${JSON.stringify(ctx.lookups ?? 'NOT SET')}`);
    console.log(`    phase: ${ctx.phase ?? 'NOT SET'}`);
  }
}
if (!foundNew) {
  console.log('\n  *** No new workflow run found for this job! ***');
}

// ── 5. Check tasks created in claims-manager ───────────────
const cm = new pg.Client(CM_DB);
await cm.connect();

const tasks = await cm.query(
  "SELECT id, name, status, created_at FROM tasks WHERE tenant_id = $1 AND job_id = $2 ORDER BY created_at",
  [TENANT_ID, job.id]
);
console.log(`\n=== 5. Tasks created for job: ${tasks.rows.length} ===`);
for (const t of tasks.rows) {
  console.log(`  ${t.name} | status=${t.status} | id=${t.id}`);
}

// ── 6. Check the job's updated customData ──────────────────
const updatedJob = await cm.query(
  "SELECT custom_data FROM jobs WHERE id = $1",
  [job.id]
);
if (updatedJob.rows.length > 0) {
  console.log(`\n=== 6. Job customData ===`);
  console.log(JSON.stringify(updatedJob.rows[0].custom_data, null, 2));
}

// ── 7. Check checkpoints ──────────────────────────────────
if (foundNew) {
  const newRun = afterRuns.rows.find(r => r.entity_id === job.id);
  if (newRun) {
    const cps = await me.query(
      "SELECT state_name, tick_count, created_at FROM checkpoints WHERE run_id = $1 ORDER BY tick_count",
      [newRun.id]
    );
    console.log(`\n=== 7. Checkpoints: ${cps.rows.length} ===`);
    for (const cp of cps.rows) {
      console.log(`  tick=${cp.tick_count} state=${cp.state_name} at=${cp.created_at}`);
    }
  }
}

await cm.end();
await me.end();
console.log('\n=== E2E trigger complete ===');

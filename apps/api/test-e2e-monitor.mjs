/**
 * Monitor: Check latest workflow run + job + tasks state.
 * Usage: node test-e2e-monitor.mjs [jobId]
 *   If no jobId, finds the most recent Builder Assessment workflow run.
 */
import pg from 'pg';

const TENANT_ID = 'b71a5841-bd46-4622-aa7c-92b209243cc6';
const ME_DB = 'postgresql://more0ai:password@localhost:3210/more0_ensure';
const CM_DB = 'postgresql://more0ai:password@localhost:3210/claims_manager';

const requestedJobId = process.argv[2] || null;

const me = new pg.Client(ME_DB);
await me.connect();
const cm = new pg.Client(CM_DB);
await cm.connect();

// 1. Find the most recent assessment workflow run
let run;
if (requestedJobId) {
  const r = await me.query(
    "SELECT id, workflow_name, entity_id, status, current_state, error, tick_count, context, created_at FROM workflow_runs WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1",
    [requestedJobId]
  );
  run = r.rows[0];
} else {
  const r = await me.query(
    "SELECT id, workflow_name, entity_id, status, current_state, error, tick_count, context, created_at FROM workflow_runs WHERE workflow_name = 'workflow.job.assessment' ORDER BY created_at DESC LIMIT 1"
  );
  run = r.rows[0];
}

if (!run) {
  console.log('No workflow run found.');
  await me.end();
  await cm.end();
  process.exit(0);
}

const jobId = run.entity_id;
const ctx = typeof run.context === 'string' ? JSON.parse(run.context) : (run.context ?? {});

console.log('=== Workflow Run ===');
console.log(`  id:            ${run.id}`);
console.log(`  workflow:      ${run.workflow_name}`);
console.log(`  job (entity):  ${jobId}`);
console.log(`  status:        ${run.status}`);
console.log(`  current_state: ${run.current_state}`);
console.log(`  tick_count:    ${run.tick_count}`);
console.log(`  created:       ${run.created_at}`);
if (run.error) console.log(`  ERROR:         ${run.error}`);
console.log(`  context keys:  ${Object.keys(ctx).join(', ')}`);
if (ctx.claimId) console.log(`  claimId:       ${ctx.claimId}`);
if (ctx.lookups) console.log(`  lookups:       ${JSON.stringify(ctx.lookups)}`);
if (ctx.phase) console.log(`  phase:         ${ctx.phase}`);
if (ctx.callToScheduleTaskId) console.log(`  callToScheduleTaskId: ${ctx.callToScheduleTaskId}`);
if (ctx.callToScheduleTask) console.log(`  callToScheduleTask:   ${JSON.stringify(ctx.callToScheduleTask)}`);

// 2. Tasks for this job
const tasks = await cm.query(
  "SELECT id, name, status, created_at FROM tasks WHERE tenant_id = $1 AND job_id = $2 ORDER BY created_at",
  [TENANT_ID, jobId]
);
console.log(`\n=== Tasks (${tasks.rows.length}) ===`);
for (const t of tasks.rows) {
  console.log(`  ${t.name} | status=${t.status} | id=${t.id} | created=${t.created_at}`);
}

// 3. Job customData
const job = await cm.query(
  "SELECT custom_data, status_lookup_id FROM jobs WHERE id = $1",
  [jobId]
);
if (job.rows.length > 0) {
  console.log('\n=== Job customData ===');
  console.log(JSON.stringify(job.rows[0].custom_data, null, 2));
  if (job.rows[0].status_lookup_id) {
    const st = await cm.query("SELECT name FROM lookup_values WHERE id = $1", [job.rows[0].status_lookup_id]);
    console.log(`  status: ${st.rows[0]?.name ?? 'unknown'}`);
  }
}

// 4. Scheduled triggers for this run
const triggers = await me.query(
  "SELECT id, trigger_at, event_type, status, created_at FROM scheduled_triggers WHERE run_id = $1 ORDER BY trigger_at",
  [run.id]
);
if (triggers.rows.length > 0) {
  console.log(`\n=== Scheduled Triggers (${triggers.rows.length}) ===`);
  for (const t of triggers.rows) {
    console.log(`  ${t.event_type ?? 'timeout'} | triggerAt=${t.trigger_at} | status=${t.status}`);
  }
}

// 5. Checkpoints (if available)
try {
  const cps = await me.query(
    "SELECT state_name, tick_count, created_at FROM checkpoints WHERE run_id = $1 ORDER BY tick_count",
    [run.id]
  );
  if (cps.rows.length > 0) {
    console.log(`\n=== Checkpoints (${cps.rows.length}) ===`);
    for (const cp of cps.rows) {
      console.log(`  tick=${cp.tick_count} state=${cp.state_name} at=${cp.created_at}`);
    }
  }
} catch { /* checkpoints table may not exist yet */ }

await cm.end();
await me.end();

import pg from 'pg';

const JOB_ID = 'ee79062c-9b72-4e47-a193-19617d0fc2e6';
const RUN_ID = '9908feb5-785f-4f23-95b6-0295e774c089';
const TENANT_ID = 'b71a5841-bd46-4622-aa7c-92b209243cc6';
const ME_DB = 'postgresql://more0ai:password@localhost:3210/more0_ensure';
const CM_DB = 'postgresql://more0ai:password@localhost:3210/claims_manager';

const me = new pg.Client(ME_DB);
await me.connect();

// 1. Check workflow run status
const run = await me.query(
  "SELECT id, status, current_state, error, tick_count, context FROM workflow_runs WHERE id = $1",
  [RUN_ID]
);
if (run.rows.length > 0) {
  const r = run.rows[0];
  console.log('=== Workflow Run ===');
  console.log(`  status: ${r.status}`);
  console.log(`  current_state: ${r.current_state}`);
  console.log(`  tick_count: ${r.tick_count}`);
  if (r.error) console.log(`  ERROR: ${r.error}`);
  const ctx = typeof r.context === 'string' ? JSON.parse(r.context) : r.context;
  console.log(`  context keys: ${Object.keys(ctx).join(', ')}`);
  if (ctx.callToScheduleTaskId) console.log(`  callToScheduleTaskId: ${ctx.callToScheduleTaskId}`);
}

// 2. Check tasks
const cm = new pg.Client(CM_DB);
await cm.connect();

const tasks = await cm.query(
  "SELECT id, name, status, created_at FROM tasks WHERE tenant_id = $1 AND job_id = $2 ORDER BY created_at",
  [TENANT_ID, JOB_ID]
);
console.log(`\n=== Tasks for job: ${tasks.rows.length} ===`);
for (const t of tasks.rows) {
  console.log(`  ${t.name} | status=${t.status} | id=${t.id}`);
}

// 3. Check job customData
const job = await cm.query(
  "SELECT custom_data FROM jobs WHERE id = $1",
  [JOB_ID]
);
if (job.rows.length > 0) {
  console.log('\n=== Job customData ===');
  console.log(JSON.stringify(job.rows[0].custom_data, null, 2));
}

await cm.end();
await me.end();

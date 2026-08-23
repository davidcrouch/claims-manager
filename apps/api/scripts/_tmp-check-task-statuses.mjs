import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const r1 = await c.query(`SELECT count(*) as cnt FROM tasks WHERE job_id IS NOT NULL AND status = 'Open'`);
console.log('Open tasks WITH job_id:', r1.rows[0].cnt);

const r2 = await c.query(`SELECT count(*) as cnt FROM tasks WHERE job_id IS NULL AND status = 'Open'`);
console.log('Open tasks WITHOUT job_id:', r2.rows[0].cnt);

const r3 = await c.query(`
  SELECT t.job_id, t.status, t.name, t.claim_id
  FROM tasks t
  WHERE t.job_id IS NOT NULL AND t.status = 'Open'
  LIMIT 5
`);
console.log('\nSample Open tasks with job_id:');
console.table(r3.rows);

const r4 = await c.query(`
  SELECT t.status, t.claim_id IS NOT NULL as has_claim, t.job_id IS NOT NULL as has_job, count(*) as cnt
  FROM tasks t
  GROUP BY t.status, t.claim_id IS NOT NULL, t.job_id IS NOT NULL
  ORDER BY t.status
`);
console.log('\nTasks by status, claim, job:');
console.table(r4.rows);

await c.end();

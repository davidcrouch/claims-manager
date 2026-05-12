import { Injectable, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/drizzle.module';
import type { DrizzleDB } from '../../database/drizzle.module';
import { TenantContext } from '../../tenant/tenant-context';

interface AgingBucket {
  label: string;
  count: number;
  totalAmount: number;
}

export interface FinanceSectionSummary {
  totalOutstanding: number;
  totalOverdue: number;
  totalPaid: number;
  buckets: AgingBucket[];
}

@Injectable()
export class FinanceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly tenantContext: TenantContext,
  ) {}

  async getArSummary(): Promise<FinanceSectionSummary> {
    const tenantId = this.tenantContext.getTenantId();

    const bucketsResult = await this.db.execute(sql`
      SELECT
        CASE
          WHEN i.issue_date >= NOW() - INTERVAL '30 days' THEN 'Current'
          WHEN i.issue_date >= NOW() - INTERVAL '60 days' THEN '1-30 days'
          WHEN i.issue_date >= NOW() - INTERVAL '90 days' THEN '31-60 days'
          WHEN i.issue_date >= NOW() - INTERVAL '120 days' THEN '61-90 days'
          ELSE '90+ days'
        END AS bucket,
        COUNT(*)::int AS count,
        COALESCE(SUM(i.total_amount::numeric), 0)::numeric AS total_amount
      FROM invoices i
      LEFT JOIN lookup_values ls ON i.status_lookup_id = ls.id
      WHERE i.tenant_id = ${tenantId}
        AND i.is_deleted = false
        AND (ls.name IS NULL OR ls.name NOT IN ('Paid', 'Cancelled'))
      GROUP BY bucket
      ORDER BY bucket
    `);

    const buckets: AgingBucket[] = (bucketsResult.rows as any[]).map((r) => ({
      label: r.bucket,
      count: Number(r.count),
      totalAmount: Number(r.total_amount),
    }));

    const totalOutstanding = buckets.reduce((s, b) => s + b.totalAmount, 0);
    const overdueBuckets = buckets.filter((b) => b.label !== 'Current');
    const totalOverdue = overdueBuckets.reduce((s, b) => s + b.totalAmount, 0);

    const paidResult = await this.db.execute(sql`
      SELECT COALESCE(SUM(i.total_amount::numeric), 0)::numeric AS total
      FROM invoices i
      LEFT JOIN lookup_values ls ON i.status_lookup_id = ls.id
      WHERE i.tenant_id = ${tenantId}
        AND i.is_deleted = false
        AND ls.name = 'Paid'
    `);
    const totalPaid = Number((paidResult.rows as any[])[0]?.total ?? 0);

    return { totalOutstanding, totalOverdue, totalPaid, buckets };
  }

  async getApSummary(): Promise<FinanceSectionSummary> {
    const tenantId = this.tenantContext.getTenantId();

    const bucketsResult = await this.db.execute(sql`
      SELECT
        CASE
          WHEN b.due_date IS NULL OR b.due_date >= NOW() THEN 'Current'
          WHEN b.due_date >= NOW() - INTERVAL '30 days' THEN '1-30 days'
          WHEN b.due_date >= NOW() - INTERVAL '60 days' THEN '31-60 days'
          WHEN b.due_date >= NOW() - INTERVAL '90 days' THEN '61-90 days'
          ELSE '90+ days'
        END AS bucket,
        COUNT(*)::int AS count,
        COALESCE(SUM(b.total_amount::numeric), 0)::numeric AS total_amount
      FROM bills b
      LEFT JOIN lookup_values ps ON b.payment_status_lookup_id = ps.id
      WHERE b.tenant_id = ${tenantId}
        AND b.is_deleted = false
        AND (ps.name IS NULL OR ps.name NOT IN ('Paid', 'Cancelled'))
      GROUP BY bucket
      ORDER BY bucket
    `);

    const buckets: AgingBucket[] = (bucketsResult.rows as any[]).map((r) => ({
      label: r.bucket,
      count: Number(r.count),
      totalAmount: Number(r.total_amount),
    }));

    const totalOutstanding = buckets.reduce((s, b) => s + b.totalAmount, 0);
    const overdueBuckets = buckets.filter((b) => b.label !== 'Current');
    const totalOverdue = overdueBuckets.reduce((s, b) => s + b.totalAmount, 0);

    const paidResult = await this.db.execute(sql`
      SELECT COALESCE(SUM(b.total_amount::numeric), 0)::numeric AS total
      FROM bills b
      LEFT JOIN lookup_values ps ON b.payment_status_lookup_id = ps.id
      WHERE b.tenant_id = ${tenantId}
        AND b.is_deleted = false
        AND ps.name = 'Paid'
    `);
    const totalPaid = Number((paidResult.rows as any[])[0]?.total ?? 0);

    return { totalOutstanding, totalOverdue, totalPaid, buckets };
  }

  async getSummary() {
    const [ar, ap] = await Promise.all([
      this.getArSummary(),
      this.getApSummary(),
    ]);
    return { ar, ap };
  }
}

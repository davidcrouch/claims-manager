import { Controller, Get } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { DRIZZLE } from '../database/drizzle.module';
import type { DrizzleDB } from '../database/drizzle.module';
import { sql } from 'drizzle-orm';

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @Get()
  @Public()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  async ready(): Promise<{ status: string; checks: Record<string, string> }> {
    const checks: Record<string, string> = {};

    try {
      await this.db.execute(sql`SELECT 1`);
      checks.database = 'connected';
    } catch {
      checks.database = 'disconnected';
    }

    const allOk = Object.values(checks).every(
      (v) => v !== 'disconnected' && v !== 'unreachable',
    );

    return {
      status: allOk ? 'ok' : 'degraded',
      checks,
    };
  }
}

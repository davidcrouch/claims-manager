import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('inbox')
  @RequirePermission(P.reports.read)
  async getInbox(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getInbox({ userId: user?.sub, email: user?.email });
  }

  @Get('stats')
  @RequirePermission(P.reports.read)
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('recent-activity')
  @RequirePermission(P.reports.read)
  async getRecentActivity(@Query('limit') limit?: string) {
    return this.dashboardService.getRecentActivity({
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}

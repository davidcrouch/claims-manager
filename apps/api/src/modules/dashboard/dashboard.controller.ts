import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('recent-activity')
  async getRecentActivity(@Query('limit') limit?: string) {
    return this.dashboardService.getRecentActivity({
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }
}

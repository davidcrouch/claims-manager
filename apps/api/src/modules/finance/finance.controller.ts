import { Controller, Get } from '@nestjs/common';
import { FinanceService } from './finance.service';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('ar')
  async getAr() {
    return this.financeService.getArSummary();
  }

  @Get('ap')
  async getAp() {
    return this.financeService.getApSummary();
  }

  @Get('summary')
  async getSummary() {
    return this.financeService.getSummary();
  }
}

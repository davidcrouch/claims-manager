import { Controller, Get } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('ar')
  @RequirePermission(P.finance.read)
  async getAr() {
    return this.financeService.getArSummary();
  }

  @Get('ap')
  @RequirePermission(P.finance.read)
  async getAp() {
    return this.financeService.getApSummary();
  }

  @Get('summary')
  @RequirePermission(P.finance.read)
  async getSummary() {
    return this.financeService.getSummary();
  }
}

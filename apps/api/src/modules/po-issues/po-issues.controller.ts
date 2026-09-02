import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import { PoIssuesService } from './po-issues.service';
import type { CreatePoIssueRequestDto, RetryPoIssueRequestDto } from './po-issues.types';

@Controller('purchase-orders/:poId/issue-requests')
export class PoIssuesController {
  constructor(private readonly poIssuesService: PoIssuesService) {}

  @Get()
  @RequirePermission(P.procurement.read)
  async list(@Param('poId') poId: string) {
    return this.poIssuesService.listByPurchaseOrder(poId);
  }

  @Get(':id')
  @RequirePermission(P.procurement.read)
  async getDetail(@Param('poId') poId: string, @Param('id') id: string) {
    return this.poIssuesService.getDetail(poId, id);
  }

  @Post()
  @RequirePermission(P.procurement.manage)
  async create(
    @Param('poId') poId: string,
    @Body() body: CreatePoIssueRequestDto,
    @CurrentUser() user: { sub?: string; email?: string },
  ) {
    return this.poIssuesService.create(poId, body, user?.sub, user?.email);
  }

  @Post(':id/retry')
  @RequirePermission(P.procurement.manage)
  async retry(
    @Param('poId') poId: string,
    @Param('id') id: string,
    @Body() body: RetryPoIssueRequestDto,
  ) {
    return this.poIssuesService.retry(poId, id, body);
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import { RfqRequestsService } from './rfq-requests.service';
import type { CreateSendRequestDto, RetrySendRequestDto } from './rfq-requests.types';

@Controller('rfqs/:rfqId/send-requests')
export class RfqRequestsController {
  constructor(private readonly rfqRequestsService: RfqRequestsService) {}

  @Get()
  @RequirePermission(P.procurement.read)
  async list(@Param('rfqId') rfqId: string) {
    return this.rfqRequestsService.listByRfq(rfqId);
  }

  @Get(':id')
  @RequirePermission(P.procurement.read)
  async getDetail(@Param('rfqId') rfqId: string, @Param('id') id: string) {
    return this.rfqRequestsService.getDetail(rfqId, id);
  }

  @Post()
  @RequirePermission(P.procurement.manage)
  async create(
    @Param('rfqId') rfqId: string,
    @Body() body: CreateSendRequestDto,
    @CurrentUser() user: { sub?: string; email?: string },
  ) {
    return this.rfqRequestsService.create(rfqId, body, user?.sub, user?.email);
  }

  @Post(':id/retry')
  @RequirePermission(P.procurement.manage)
  async retry(
    @Param('rfqId') rfqId: string,
    @Param('id') id: string,
    @Body() body: RetrySendRequestDto,
  ) {
    return this.rfqRequestsService.retry(rfqId, id, body);
  }
}

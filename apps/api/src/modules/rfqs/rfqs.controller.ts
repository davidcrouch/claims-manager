import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RfqsService } from './rfqs.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('rfqs')
export class RfqsController {
  constructor(private readonly rfqsService: RfqsService) {}

  @Get()
  @RequirePermission(P.procurement.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('jobIds') jobIds?: string,
    @Query('quoteId') quoteId?: string,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    const jobIdList = jobIds
      ? jobIds.split(',').map((id) => id.trim()).filter((id) => id.length > 0)
      : undefined;
    return this.rfqsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      jobIds: jobIdList && jobIdList.length > 0 ? jobIdList : undefined,
      quoteId,
      status,
      vendorId,
      search,
      sort,
    });
  }

  @Get('job/:jobId')
  @RequirePermission(P.procurement.read)
  async findByJob(@Param('jobId') jobId: string) {
    return this.rfqsService.findByJob({ jobId });
  }

  @Get('quote/:quoteId')
  @RequirePermission(P.procurement.read)
  async findByQuote(@Param('quoteId') quoteId: string) {
    return this.rfqsService.findByQuote({ quoteId });
  }

  @Get(':id/line-items')
  @RequirePermission(P.procurement.read)
  async getLineItems(@Param('id') id: string) {
    return this.rfqsService.getRfqLineItems({ rfqId: id });
  }

  @Post(':id/line-items')
  @RequirePermission(P.procurement.manage)
  async replaceLineItems(
    @Param('id') id: string,
    @Body() body: { selectedItemIds?: string[] },
  ) {
    return this.rfqsService.replaceScopeItems({
      rfqId: id,
      selectedItemIds: Array.isArray(body?.selectedItemIds) ? body.selectedItemIds : [],
    });
  }

  @Patch(':id/line-notes')
  @RequirePermission(P.procurement.manage)
  async updateLineNote(
    @Param('id') id: string,
    @Body()
    body: {
      targetType?: 'group' | 'combo' | 'item';
      targetId?: string;
      note?: string | null;
    },
  ) {
    return this.rfqsService.updateLineNote({
      rfqId: id,
      targetType: body?.targetType as 'group' | 'combo' | 'item',
      targetId: body?.targetId ?? '',
      note: body?.note ?? null,
    });
  }

  @Get(':id')
  @RequirePermission(P.procurement.read)
  async findOne(@Param('id') id: string) {
    return this.rfqsService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.procurement.manage)
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.rfqsService.create({ body, userId });
  }

  @Post(':id')
  @RequirePermission(P.procurement.manage)
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.rfqsService.update({ id, body, userId });
  }
}

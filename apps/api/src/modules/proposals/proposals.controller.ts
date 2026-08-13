import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ProposalsService } from './proposals.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get()
  @RequirePermission(P.procurement.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('rfqId') rfqId?: string,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.proposalsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      rfqId,
      status,
      vendorId,
      sort,
    });
  }

  @Get('job/:jobId')
  @RequirePermission(P.procurement.read)
  async findByJob(@Param('jobId') jobId: string) {
    return this.proposalsService.findByJob({ jobId });
  }

  @Get('rfq/:rfqId')
  @RequirePermission(P.procurement.read)
  async findByRfq(@Param('rfqId') rfqId: string) {
    return this.proposalsService.findByRfq({ rfqId });
  }

  @Get('vendor/:vendorId')
  @RequirePermission(P.procurement.read)
  async findByVendor(@Param('vendorId') vendorId: string) {
    return this.proposalsService.findByVendor({ vendorId });
  }

  @Get(':id/line-items')
  @RequirePermission(P.procurement.read)
  async getLineItems(@Param('id') id: string) {
    return this.proposalsService.getProposalLineItems({ proposalId: id });
  }

  @Get(':id')
  @RequirePermission(P.procurement.read)
  async findOne(@Param('id') id: string) {
    return this.proposalsService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.procurement.manage)
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.proposalsService.create({ body, userId });
  }

  @Post(':id/accept')
  @RequirePermission(P.procurement.manage)
  async accept(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.proposalsService.accept({ id, userId });
  }

  @Post(':id/decline')
  @RequirePermission(P.procurement.manage)
  async decline(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser('sub') userId: string,
  ) {
    return this.proposalsService.decline({ id, reason: body?.reason, userId });
  }

  @Post(':id')
  @RequirePermission(P.procurement.manage)
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.proposalsService.update({ id, body, userId });
  }
}

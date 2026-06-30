import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProposalsService } from './proposals.service';

@Controller('proposals')
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('rfqId') rfqId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.proposalsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      rfqId,
      vendorId,
      sort,
    });
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.proposalsService.findByJob({ jobId });
  }

  @Get('rfq/:rfqId')
  async findByRfq(@Param('rfqId') rfqId: string) {
    return this.proposalsService.findByRfq({ rfqId });
  }

  @Get('vendor/:vendorId')
  async findByVendor(@Param('vendorId') vendorId: string) {
    return this.proposalsService.findByVendor({ vendorId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.proposalsService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.proposalsService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.proposalsService.update({ id, body });
  }
}

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RfqsService } from './rfqs.service';

@Controller('rfqs')
export class RfqsController {
  constructor(private readonly rfqsService: RfqsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('quoteId') quoteId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.rfqsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      quoteId,
      vendorId,
      sort,
    });
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.rfqsService.findByJob({ jobId });
  }

  @Get('quote/:quoteId')
  async findByQuote(@Param('quoteId') quoteId: string) {
    return this.rfqsService.findByQuote({ quoteId });
  }

  @Get(':id/line-items')
  async getLineItems(@Param('id') id: string) {
    return this.rfqsService.getRfqLineItems({ rfqId: id });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.rfqsService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.rfqsService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.rfqsService.update({ id, body });
  }
}

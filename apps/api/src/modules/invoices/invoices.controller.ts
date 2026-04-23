import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('statusId') statusId?: string,
  ) {
    return this.invoicesService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      purchaseOrderId,
      statusId,
    });
  }

  @Get('purchase-order/:purchaseOrderId')
  async findByPurchaseOrder(@Param('purchaseOrderId') purchaseOrderId: string) {
    return this.invoicesService.findByPurchaseOrder({ purchaseOrderId });
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.invoicesService.findByJob({ jobId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.invoicesService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.invoicesService.update({ id, body });
  }
}

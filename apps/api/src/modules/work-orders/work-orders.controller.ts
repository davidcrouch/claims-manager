import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
  ) {
    return this.workOrdersService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      purchaseOrderId,
    });
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.workOrdersService.findByJob({ jobId });
  }

  @Get('purchase-order/:purchaseOrderId')
  async findByPurchaseOrder(@Param('purchaseOrderId') purchaseOrderId: string) {
    return this.workOrdersService.findByPurchaseOrder({ purchaseOrderId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.workOrdersService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.workOrdersService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.workOrdersService.update({ id, body });
  }
}

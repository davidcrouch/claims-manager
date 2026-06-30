import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BillsService } from './bills.service';

@Controller('bills')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.billsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      purchaseOrderId,
      vendorId,
      invoiceId,
      sort,
    });
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.billsService.findByJob({ jobId });
  }

  @Get('purchase-order/:purchaseOrderId')
  async findByPurchaseOrder(@Param('purchaseOrderId') purchaseOrderId: string) {
    return this.billsService.findByPurchaseOrder({ purchaseOrderId });
  }

  @Get('vendor/:vendorId')
  async findByVendor(@Param('vendorId') vendorId: string) {
    return this.billsService.findByVendor({ vendorId });
  }

  @Get('invoice/:invoiceId')
  async findByInvoice(@Param('invoiceId') invoiceId: string) {
    return this.billsService.findByInvoice({ invoiceId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.billsService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.billsService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.billsService.update({ id, body });
  }
}

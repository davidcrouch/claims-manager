import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { BillsService } from './bills.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('bills')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Get()
  @RequirePermission(P.procurement.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.billsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      purchaseOrderId,
      status,
      vendorId,
      invoiceId,
      sort,
    });
  }

  @Get('job/:jobId')
  @RequirePermission(P.procurement.read)
  async findByJob(@Param('jobId') jobId: string) {
    return this.billsService.findByJob({ jobId });
  }

  @Get('purchase-order/:purchaseOrderId')
  @RequirePermission(P.procurement.read)
  async findByPurchaseOrder(@Param('purchaseOrderId') purchaseOrderId: string) {
    return this.billsService.findByPurchaseOrder({ purchaseOrderId });
  }

  @Get('vendor/:vendorId')
  @RequirePermission(P.procurement.read)
  async findByVendor(@Param('vendorId') vendorId: string) {
    return this.billsService.findByVendor({ vendorId });
  }

  @Get('invoice/:invoiceId')
  @RequirePermission(P.procurement.read)
  async findByInvoice(@Param('invoiceId') invoiceId: string) {
    return this.billsService.findByInvoice({ invoiceId });
  }

  @Get(':id')
  @RequirePermission(P.procurement.read)
  async findOne(@Param('id') id: string) {
    return this.billsService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.procurement.manage)
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.billsService.create({ body, userId });
  }

  @Post(':id')
  @RequirePermission(P.procurement.manage)
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.billsService.update({ id, body, userId });
  }
}

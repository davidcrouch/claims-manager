import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { InvoicesService } from './invoices.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @RequirePermission(P.invoices.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('jobId') jobId?: string,
    @Query('status') status?: string,
    @Query('statusId') statusId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.invoicesService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      purchaseOrderId,
      jobId,
      status,
      statusId,
      sort,
    });
  }

  @Get('purchase-order/:purchaseOrderId')
  @RequirePermission(P.invoices.read)
  async findByPurchaseOrder(@Param('purchaseOrderId') purchaseOrderId: string) {
    return this.invoicesService.findByPurchaseOrder({ purchaseOrderId });
  }

  @Get('job/:jobId')
  @RequirePermission(P.invoices.read)
  async findByJob(@Param('jobId') jobId: string) {
    return this.invoicesService.findByJob({ jobId });
  }

  @Get(':id')
  @RequirePermission(P.invoices.read)
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.invoices.create)
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.invoicesService.create({ body, userId });
  }

  @Post(':id/publish')
  @RequirePermission(P.invoices.update)
  async publish(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.invoicesService.publish({ id, userId });
  }

  @Post(':id')
  @RequirePermission(P.invoices.update)
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.invoicesService.update({ id, body, userId });
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
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
    @Query('workOrderId') workOrderId?: string,
    @Query('jobId') jobId?: string,
    @Query('jobIds') jobIds?: string,
    @Query('status') status?: string,
    @Query('statusId') statusId?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    const jobIdList = jobIds
      ? jobIds.split(',').map((id) => id.trim()).filter((id) => id.length > 0)
      : undefined;
    return this.invoicesService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      purchaseOrderId,
      workOrderId,
      jobId,
      jobIds: jobIdList && jobIdList.length > 0 ? jobIdList : undefined,
      status,
      statusId,
      search,
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
  @RequirePermission(P.invoices.publish)
  async publish(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.invoicesService.publish({ id, userId });
  }

  @Post(':id/approve')
  @RequirePermission(P.invoices.approve)
  async approve(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.invoicesService.approve({ id, userId });
  }

  @Post(':id/return-to-draft')
  @RequirePermission(P.invoices.update)
  async returnToDraft(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.invoicesService.returnToDraft({ id, userId });
  }

  @Post(':id/received-payment')
  @RequirePermission(P.invoices.update)
  async receivePayment(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.invoicesService.receivePayment({
      id,
      amount: body?.amount,
      userId,
    });
  }

  @Post(':id/payments/:paymentId')
  @RequirePermission(P.invoices.update)
  async updatePayment(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.invoicesService.updatePayment({
      id,
      paymentId,
      amount: body?.amount,
      userId,
    });
  }

  @Delete(':id/payments/:paymentId')
  @RequirePermission(P.invoices.update)
  async deletePayment(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.invoicesService.deletePayment({ id, paymentId, userId });
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

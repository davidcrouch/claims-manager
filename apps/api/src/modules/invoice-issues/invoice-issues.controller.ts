import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import { InvoiceIssuesService } from './invoice-issues.service';
import type {
  CreateInvoiceSendRequestDto,
  RetryInvoiceSendRequestDto,
} from './invoice-issues.types';

@Controller('invoices/:invoiceId/send-requests')
export class InvoiceIssuesController {
  constructor(private readonly invoiceIssuesService: InvoiceIssuesService) {}

  @Get()
  @RequirePermission(P.invoices.read)
  async list(@Param('invoiceId') invoiceId: string) {
    return this.invoiceIssuesService.listByInvoice(invoiceId);
  }

  @Get(':id')
  @RequirePermission(P.invoices.read)
  async getDetail(
    @Param('invoiceId') invoiceId: string,
    @Param('id') id: string,
  ) {
    return this.invoiceIssuesService.getDetail(invoiceId, id);
  }

  @Post()
  @RequirePermission(P.invoices.publish)
  async create(
    @Param('invoiceId') invoiceId: string,
    @Body() body: CreateInvoiceSendRequestDto,
    @CurrentUser() user: { sub?: string; email?: string },
  ) {
    return this.invoiceIssuesService.create(
      invoiceId,
      body,
      user?.sub,
      user?.email,
    );
  }

  @Post(':id/retry')
  @RequirePermission(P.invoices.publish)
  async retry(
    @Param('invoiceId') invoiceId: string,
    @Param('id') id: string,
    @Body() body: RetryInvoiceSendRequestDto,
  ) {
    return this.invoiceIssuesService.retry(invoiceId, id, body);
  }
}

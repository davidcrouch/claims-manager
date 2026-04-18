import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { TenantContext } from '../../tenant/tenant-context';

@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly providersService: ProvidersService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  async findAll() {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.listTenantConnections({ tenantId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findConnectionById({ id, tenantId });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateConnectionDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.updateConnectionById({ id, tenantId, dto });
  }

  @Get(':id/webhook-events')
  async findWebhookEvents(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findWebhookEventsByConnection({
      connectionId: id,
      tenantId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { TenantContext } from '../../tenant/tenant-context';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly providersService: ProvidersService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  @RequirePermission(P.integrations.read)
  async findAll() {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findAll(tenantId);
  }

  @Get(':code')
  @RequirePermission(P.integrations.read)
  async findOne(@Param('code') code: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findOne({ code, tenantId });
  }

  @Get(':code/connections')
  @RequirePermission(P.integrations.read)
  async findConnections(@Param('code') code: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findConnections({
      providerCode: code,
      tenantId,
    });
  }

  @Post(':code/connections')
  @RequirePermission(P.integrations.manage)
  async createConnection(
    @Param('code') code: string,
    @Body() dto: CreateConnectionDto,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.createConnection({
      providerCode: code,
      tenantId,
      dto,
    });
  }

  @Put(':code/connections/:connId')
  @RequirePermission(P.integrations.manage)
  async updateConnection(
    @Param('code') code: string,
    @Param('connId') connId: string,
    @Body() dto: UpdateConnectionDto,
  ) {
    return this.providersService.updateConnection({
      providerCode: code,
      connectionId: connId,
      dto,
    });
  }

  @Get(':code/webhook-events')
  @RequirePermission(P.integrations.read)
  async findWebhookEvents(
    @Param('code') code: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findWebhookEvents({
      providerCode: code,
      tenantId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}

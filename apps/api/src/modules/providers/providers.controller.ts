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

@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly providersService: ProvidersService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  async findAll() {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findAll(tenantId);
  }

  @Get(':code')
  async findOne(@Param('code') code: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findOne({ code, tenantId });
  }

  @Get(':code/connections')
  async findConnections(@Param('code') code: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findConnections({
      providerCode: code,
      tenantId,
    });
  }

  @Post(':code/connections')
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

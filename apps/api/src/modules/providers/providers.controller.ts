import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto, UpdateConnectionDto } from './dto/update-provider.dto';
import { CreateConnectionDto } from './dto/create-provider.dto';
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

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.providersService.findOne({ id });
  }

  @Post()
  async create(@Body() dto: CreateProviderDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.create(dto, tenantId);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.providersService.update({ id, dto });
  }

  @Delete(':id')
  async deactivate(@Param('id') id: string) {
    return this.providersService.deactivate({ id });
  }

  @Get(':id/connections')
  async findConnections(@Param('id') id: string) {
    return this.providersService.findConnections({ providerId: id });
  }

  @Post(':id/connections')
  async createConnection(
    @Param('id') id: string,
    @Body() dto: CreateConnectionDto,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.createConnection({
      providerId: id,
      tenantId,
      dto,
    });
  }

  @Put(':id/connections/:connId')
  async updateConnection(
    @Param('id') id: string,
    @Param('connId') connId: string,
    @Body() dto: UpdateConnectionDto,
  ) {
    return this.providersService.updateConnection({
      providerId: id,
      connectionId: connId,
      dto,
    });
  }

  @Get(':id/webhook-events')
  async findWebhookEvents(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findWebhookEvents({
      providerId: id,
      tenantId,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}

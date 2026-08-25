import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { TenantContext } from '../../tenant/tenant-context';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import { ConnectionIdentifiersRepository } from '../../database/repositories';

@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly providersService: ProvidersService,
    private readonly tenantContext: TenantContext,
    private readonly identifiersRepo: ConnectionIdentifiersRepository,
  ) {}

  @Get()
  @RequirePermission(P.integrations.read)
  async findAll(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('sort') sort?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const isActiveParam =
      isActive === 'true' || isActive === '1'
        ? true
        : isActive === 'false' || isActive === '0'
          ? false
          : undefined;
    return this.providersService.listTenantConnections({
      tenantId,
      search,
      isActive: isActiveParam,
      sort,
    });
  }

  @Get(':id')
  @RequirePermission(P.integrations.read)
  async findOne(@Param('id') id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findConnectionById({ id, tenantId });
  }

  @Put(':id')
  @RequirePermission(P.integrations.manage)
  async update(@Param('id') id: string, @Body() dto: UpdateConnectionDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.updateConnectionById({ id, tenantId, dto });
  }

  @Get(':id/webhook-events/filter-options')
  @RequirePermission(P.integrations.read)
  async findWebhookEventFilterOptions(@Param('id') id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findWebhookEventFilterOptionsByConnection({
      connectionId: id,
      tenantId,
    });
  }

  @Get(':id/webhook-events')
  @RequirePermission(P.integrations.read)
  async findWebhookEvents(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('eventType') eventType?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.findWebhookEventsByConnection({
      connectionId: id,
      tenantId,
      status,
      eventType,
      search,
      sort,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id/docs-url')
  @RequirePermission(P.integrations.read)
  async getDocsUrl(@Param('id') id: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.providersService.getDocsUrl({ id, tenantId });
  }

  @Get(':id/identifiers')
  @RequirePermission(P.integrations.read)
  async listIdentifiers(@Param('id') id: string) {
    const tenantId = this.tenantContext.getTenantId();
    await this.providersService.findConnectionById({ id, tenantId });
    return this.identifiersRepo.findByConnectionId({ connectionId: id });
  }

  @Post(':id/identifiers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(P.integrations.manage)
  async addIdentifier(
    @Param('id') id: string,
    @Body() body: { identifierType: string; identifierValue: string },
  ) {
    const tenantId = this.tenantContext.getTenantId();
    await this.providersService.findConnectionById({ id, tenantId });
    return this.identifiersRepo.create({
      data: {
        connectionId: id,
        identifierType: body.identifierType,
        identifierValue: body.identifierValue,
      },
    });
  }

  @Delete(':id/identifiers/:identifierId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(P.integrations.manage)
  async removeIdentifier(
    @Param('id') id: string,
    @Param('identifierId') identifierId: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    await this.providersService.findConnectionById({ id, tenantId });
    const deleted = await this.identifiersRepo.delete({ id: identifierId });
    if (!deleted) {
      throw new NotFoundException('Identifier not found');
    }
  }
}

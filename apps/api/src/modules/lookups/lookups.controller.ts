import { Controller, Get, Param, Post, Body, Query } from '@nestjs/common';
import { LookupsService } from './lookups.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get()
  @RequirePermission(P.lookups.read)
  async findByDomain(
    @Query('domain') domain: string,
    @Query('providerCode') providerCode?: string,
  ) {
    return this.lookupsService.findByDomain({
      domain: domain || '',
      providerCode: providerCode || undefined,
    });
  }

  @Post('ensure')
  @RequirePermission(P.lookups.manage)
  async ensure(@Body() body: { domain: string; name: string }) {
    return this.lookupsService.ensureByName({
      domain: body.domain,
      name: body.name,
    });
  }

  @Get(':id')
  @RequirePermission(P.lookups.read)
  async findOne(@Param('id') id: string) {
    return this.lookupsService.findOne({ id });
  }
}

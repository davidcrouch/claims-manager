import { Controller, Get, Param, Query } from '@nestjs/common';
import { LookupsService } from './lookups.service';

@Controller('lookups')
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get()
  async findByDomain(@Query('domain') domain: string) {
    return this.lookupsService.findByDomain({ domain: domain || '' });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.lookupsService.findOne({ id });
  }
}

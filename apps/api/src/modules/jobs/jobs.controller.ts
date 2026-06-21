import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('claimId') claimId?: string,
  ) {
    return this.jobsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      claimId,
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobsService.findOne({ id });
  }

  @Post()
  async create(
    @Body() body: Record<string, unknown>,
    @Query('provider') providerOverride?: string,
  ) {
    return this.jobsService.create({ body, providerOverride });
  }

  @Post(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @Query('provider') providerOverride?: string,
  ) {
    return this.jobsService.update({ id, body, providerOverride });
  }
}

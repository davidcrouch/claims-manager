import {
  Body,
  Controller,
  Get,
  Param,
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
  async findOne(@Param('id') id: string) {
    return this.jobsService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.jobsService.create({ body });
  }

  @Post(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.jobsService.update({ id, body });
  }
}

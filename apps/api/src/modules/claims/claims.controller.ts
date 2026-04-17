import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ClaimsService } from './claims.service';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('status') status?: string,
  ) {
    return this.claimsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      sort,
      status,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.claimsService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.claimsService.create({ body });
  }

  @Post(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.claimsService.update({ id, body });
  }
}

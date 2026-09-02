import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  @RequirePermission(P.claims.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('status') status?: string,
    @Query('account') account?: string,
    @Query('jobType') jobType?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
  ) {
    return this.claimsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      sort,
      status,
      account,
      jobType,
      assignedToUserId,
    });
  }

  @Get(':id')
  @RequirePermission(P.claims.read)
  async findOne(@Param('id') id: string) {
    return this.claimsService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.claims.create)
  async create(@Body() body: Record<string, unknown>) {
    return this.claimsService.create({ body });
  }

  @Post(':id')
  @RequirePermission(P.claims.update)
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.claimsService.update({ id, body });
  }
}

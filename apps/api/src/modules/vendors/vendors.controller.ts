import { Controller, Get, Param, Query } from '@nestjs/common';
import { VendorsService } from './vendors.service';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.vendorsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
  }

  @Get('allocation')
  async getAllocation(
    @Query('jobType') jobType: string,
    @Query('account') account: string,
    @Query('postcode') postcode: string,
    @Query('lossType') lossType?: string,
    @Query('totalLoss') totalLoss?: string,
  ) {
    return this.vendorsService.getAllocation({
      jobType,
      account,
      postcode,
      lossType,
      totalLoss: totalLoss === 'true',
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.vendorsService.findOne({ id });
  }
}

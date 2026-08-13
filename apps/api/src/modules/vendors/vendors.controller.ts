import { Controller, Get, Param, Patch, Query, Body } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @RequirePermission(P.vendors.read)
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

  @Get('on-platform')
  @RequirePermission(P.vendors.read)
  async findOnPlatformVendors(@Query('limit') limit?: string) {
    return this.vendorsService.findOnPlatformVendors({
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('allocation')
  @RequirePermission(P.vendors.read)
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
  @RequirePermission(P.vendors.read)
  async findOne(@Param('id') id: string) {
    return this.vendorsService.findOne({ id });
  }

  @Patch(':id/link-organisation')
  @RequirePermission(P.vendors.manage)
  async linkOrganisation(
    @Param('id') id: string,
    @Body() body: { organisationId: string },
  ) {
    return this.vendorsService.linkOrganisation({
      id,
      organisationId: body.organisationId,
    });
  }
}

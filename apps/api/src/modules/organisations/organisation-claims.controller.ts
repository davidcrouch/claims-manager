import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrganisationsService } from './organisations.service';
import { TenantContext } from '../../tenant/tenant-context';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

@Controller('organisation-claims')
export class OrganisationClaimsController {
  constructor(
    private readonly organisationsService: OrganisationsService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  async list() {
    const tenantId = this.tenantContext.getTenantId();
    return this.organisationsService.listClaims({ tenantId });
  }

  @Post(':id/approve')
  async approve(
    @Param('id') claimId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organisationsService.approveClaim({
      claimId,
      reviewedByUserId: user.sub,
    });
  }

  @Post(':id/reject')
  async reject(
    @Param('id') claimId: string,
    @Body() body: { notes?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organisationsService.rejectClaim({
      claimId,
      reviewedByUserId: user.sub,
      notes: body.notes,
    });
  }
}

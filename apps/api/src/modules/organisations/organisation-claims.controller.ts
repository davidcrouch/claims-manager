import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrganisationsService } from './organisations.service';
import { TenantContext } from '../../tenant/tenant-context';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('organisation-claims')
export class OrganisationClaimsController {
  constructor(
    private readonly organisationsService: OrganisationsService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get()
  @RequirePermission(P.claims.read)
  async list() {
    const tenantId = this.tenantContext.getTenantId();
    return this.organisationsService.listClaims({ tenantId });
  }

  @Post(':id/approve')
  @RequirePermission(P.claims.update)
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
  @RequirePermission(P.claims.update)
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

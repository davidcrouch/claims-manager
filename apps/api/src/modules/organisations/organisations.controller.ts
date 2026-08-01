import { Controller, Get, Param, Post } from '@nestjs/common';
import { OrganisationsService } from './organisations.service';
import { TenantContext } from '../../tenant/tenant-context';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

@Controller('organisations')
export class OrganisationsController {
  constructor(
    private readonly organisationsService: OrganisationsService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get('ghosts')
  async listGhosts() {
    const tenantId = this.tenantContext.getTenantId();
    return this.organisationsService.listGhosts({ tenantId });
  }

  @Post('ghosts/:id/claim')
  async claimGhost(
    @Param('id') ghostOrgId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.organisationsService.initiateClaim({
      ghostOrganisationId: ghostOrgId,
      claimingTenantId: tenantId,
      initiatedByUserId: user.sub,
    });
  }
}

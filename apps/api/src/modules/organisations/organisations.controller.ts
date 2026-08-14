import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { OrganisationsService } from './organisations.service';
import { TenantContext } from '../../tenant/tenant-context';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';

@Controller('organisations')
export class OrganisationsController {
  constructor(
    private readonly organisationsService: OrganisationsService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Get('me')
  async getMe() {
    const tenantId = this.tenantContext.getTenantId();
    return this.organisationsService.getMe(tenantId);
  }

  @Patch('me')
  @RequirePermission(P.org.settings.manage)
  async updateMe(
    @Body() dto: UpdateOrganisationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.organisationsService.updateMe({
      tenantId,
      userId: user.sub,
      dto,
    });
  }

  @Get('ghosts')
  @RequirePermission(P.org.settings.manage)
  async listGhosts() {
    const tenantId = this.tenantContext.getTenantId();
    return this.organisationsService.listGhosts({ tenantId });
  }

  @Post('ghosts/:id/claim')
  @RequirePermission(P.org.settings.manage)
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

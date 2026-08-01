import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { DomainModule } from '../domain/domain.module';
import { OrganisationsController } from './organisations.controller';
import { OrganisationClaimsController } from './organisation-claims.controller';
import { OrganisationsService } from './organisations.service';

@Module({
  imports: [TenantModule, DomainModule],
  controllers: [OrganisationsController, OrganisationClaimsController],
  providers: [OrganisationsService],
  exports: [OrganisationsService],
})
export class OrganisationsModule {}

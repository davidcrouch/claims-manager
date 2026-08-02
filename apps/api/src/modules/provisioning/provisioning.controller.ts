import { Controller, Get, Post, HttpCode } from '@nestjs/common';
import { ProvisioningService } from './provisioning.service';
import type { ProvisioningStatusResponse } from './provisioning.types';

@Controller('provisioning')
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Get('status')
  async getStatus(): Promise<ProvisioningStatusResponse> {
    return this.provisioningService.getStatus();
  }

  @Post('start')
  @HttpCode(200)
  async start(): Promise<ProvisioningStatusResponse> {
    return this.provisioningService.startProvisioning();
  }
}

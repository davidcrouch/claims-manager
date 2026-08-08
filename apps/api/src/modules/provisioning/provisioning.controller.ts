import { Body, Controller, Get, Post, HttpCode } from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { ProvisioningService } from './provisioning.service';
import type { ProvisioningStatusResponse } from './provisioning.types';

class StartProvisioningDto {
  @IsOptional()
  @IsUUID()
  companyFilesystemTemplateId?: string;

  @IsOptional()
  @IsUUID()
  defaultProjectFilesystemTemplateId?: string;
}

@Controller('provisioning')
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Get('status')
  async getStatus(): Promise<ProvisioningStatusResponse> {
    return this.provisioningService.getStatus();
  }

  @Post('start')
  @HttpCode(200)
  async start(@Body() body: StartProvisioningDto = {}): Promise<ProvisioningStatusResponse> {
    return this.provisioningService.startProvisioning({
      companyFilesystemTemplateId: body.companyFilesystemTemplateId,
      defaultProjectFilesystemTemplateId: body.defaultProjectFilesystemTemplateId,
    });
  }
}

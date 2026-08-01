import { Controller, Get, Render, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class HomeController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('home')
  root(@Req() req: Request) {
    const apiPrefix = this.configService.get<string>('app.apiPrefix') || 'api/v1';
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    return {
      title: 'EnsureOS API',
      health: {
        status: 'ok',
        uptime: process.uptime(),
        environment: this.configService.get<string>('app.nodeEnv') || 'development',
        version: process.env.npm_package_version || '0.0.1',
        service: 'api',
      },
      endpoints: {
        health: `${baseUrl}/${apiPrefix}/health`,
        ready: `${baseUrl}/${apiPrefix}/health/ready`,
        docs: `${baseUrl}/api/docs`,
        apiBase: `${baseUrl}/${apiPrefix}`,
      },
    };
  }
}

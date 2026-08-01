import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

/** Cloud Run / load balancer probes often hit `/` before `/api/v1/health`. */
@Controller()
export class RootController {
  @Get()
  @Public()
  root() {
    return { status: 'ok', service: 'provider-server' };
  }
}

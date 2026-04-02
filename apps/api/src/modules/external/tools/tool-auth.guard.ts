import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ToolAuthGuard implements CanActivate {
  private readonly toolSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.toolSecret = this.configService.get<string>('more0.toolSecret', '');
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.toolSecret) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const headerSecret = request.headers['x-tool-secret'];

    if (!headerSecret || headerSecret !== this.toolSecret) {
      throw new UnauthorizedException('Invalid tool secret');
    }

    return true;
  }
}

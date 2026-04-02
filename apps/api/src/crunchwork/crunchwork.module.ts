import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CrunchworkAuthService } from './crunchwork-auth.service';
import { CrunchworkService } from './crunchwork.service';

@Module({
  imports: [
    HttpModule.register({ timeout: 30000 }),
  ],
  providers: [CrunchworkAuthService, CrunchworkService],
  exports: [CrunchworkService],
})
export class CrunchworkModule {}

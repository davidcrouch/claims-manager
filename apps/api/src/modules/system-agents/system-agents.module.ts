import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SystemAgentRunner } from './system-agent-runner';
import './agents/doc-classifier';

@Module({
  imports: [ConfigModule],
  providers: [SystemAgentRunner],
  exports: [SystemAgentRunner],
})
export class SystemAgentsModule {}

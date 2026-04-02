import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import more0Config from '../config/more0.config';
import { More0Service } from './more0.service';

@Module({
  imports: [ConfigModule.forFeature(more0Config)],
  providers: [More0Service],
  exports: [More0Service],
})
export class More0Module {}

import { Module } from '@nestjs/common';
import { More0Service } from './more0.service';

@Module({
  providers: [More0Service],
  exports: [More0Service],
})
export class More0Module {}

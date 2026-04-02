import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = ReturnType<typeof createDrizzle>;
export type DrizzleTx = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0];
export type DrizzleDbOrTx = DrizzleDB | DrizzleTx;

function createDrizzle(databaseUrl: string) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  return drizzle({ client: pool, schema });
}

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('database.databaseUrl');
        if (!url) {
          throw new Error('database.databaseUrl is required');
        }
        return createDrizzle(url);
      },
      inject: [ConfigService],
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}

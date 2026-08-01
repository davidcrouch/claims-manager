import { NestFactory } from '@nestjs/core';
import { BadRequestException, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { v4 as uuid } from 'uuid';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Provider ingest only — keep payloads modest vs api-server uploads.
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  const configService = app.get(ConfigService);

  app.use(
    (
      req: { headers: Record<string, string> },
      res: { setHeader: (k: string, v: string) => void },
      next: () => void,
    ) => {
      const requestId = req.headers['x-request-id'] ?? uuid();
      req.headers['x-request-id'] = requestId;
      res.setHeader('x-request-id', requestId);
      next();
    },
  );
  app.use(helmet());
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((err) =>
          Object.values(err.constraints || {}).join(', '),
        );
        return new BadRequestException({
          message: 'Validation failed',
          details: messages,
        });
      },
    }),
  );

  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api/v1';
  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'api/webhook', method: RequestMethod.ALL },
    ],
  });

  const port = configService.get<number>('app.port') || 8080;
  await app.listen(port);
  console.log(`provider-server.bootstrap — listening on :${port} prefix=${apiPrefix}`);
}

bootstrap();

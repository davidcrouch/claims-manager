import { NestFactory } from '@nestjs/core';
import { BadRequestException, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  const configService = app.get(ConfigService);

  app.useStaticAssets(join(process.cwd(), 'public'));
  app.setBaseViewsDir(join(process.cwd(), 'views'));
  app.setViewEngine('ejs');

  app.use((req: { headers: Record<string, string> }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const requestId = req.headers['x-request-id'] ?? uuid();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'https:'],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
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

  const config = new DocumentBuilder()
    .setTitle('EnsureOS API')
    .setDescription('BFF API for EnsureOS')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('app.port') ?? 3001;
  await app.listen(port);

  console.log(`[main.bootstrap] Application listening on port ${port}`);
  console.log(`[main.bootstrap] Home page at /`);
  console.log(`[main.bootstrap] Swagger UI at /api/docs`);
  console.log(`[main.bootstrap] API prefix: /${apiPrefix}`);
}

bootstrap();

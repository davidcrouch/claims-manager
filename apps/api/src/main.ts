import { NestFactory } from '@nestjs/core';
import { BadRequestException, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { v4 as uuid } from 'uuid';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService);

  app.use((req: { headers: Record<string, string> }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    const requestId = req.headers['x-request-id'] ?? uuid();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });
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
    exclude: [{ path: 'api/webhook', method: RequestMethod.ALL }],
  });

  const config = new DocumentBuilder()
    .setTitle('Claims Manager API')
    .setDescription('BFF API for Claims Manager')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('app.port') ?? 3001;
  await app.listen(port);

  console.log(`[main.bootstrap] Application listening on port ${port}`);
  console.log(`[main.bootstrap] Swagger UI at /api/docs`);
  console.log(`[main.bootstrap] API prefix: /${apiPrefix}`);
}

bootstrap();

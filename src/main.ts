import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { envOr } from './common/env.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // App chạy local: chấp nhận mọi cổng localhost, vì Vite tự nhảy cổng khi 5173 bận.
  // Đặt WEB_ORIGIN trong .env nếu muốn khoá cứng về đúng một origin.
  app.enableCors({
    origin: envOr('WEB_ORIGIN', /^http:\/\/(localhost|127\.0\.0\.1):\d+$/),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { API_PREFIX } from './common/constants/constants.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // The dashboard runs on another origin (Vite on :5173 in dev), so the browser
  // needs CORS. credentials: true lets it send the httpOnly auth cookies; that
  // also means the origin must be an exact list, never "*".
  const origins = app
    .get(ConfigService)
    .getOrThrow<string>('CORS_ORIGIN')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.enableShutdownHooks();
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  // Everything under /api; the cookie paths in constants.config.ts follow it.
  app.setGlobalPrefix(API_PREFIX);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

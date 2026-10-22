import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { API_PREFIX } from './common/constants/constants.config';

/**
 * Live deploy logs (Socket.io) live under the api prefix too, so behind
 * Traefik /api reaches them and the browser sends the /api-scoped access
 * cookie with the handshake. CORS follows the same origin list as HTTP.
 */
class WardenIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }
  createIOServer(port: number, options?: Partial<ServerOptions>) {
    return super.createIOServer(port, {
      ...options,
      path: `/${API_PREFIX}/socket.io`,
      cors: { origin: this.origins, credentials: true },
    } as ServerOptions);
  }
}

async function bootstrap() {
  // rawBody: GitHub webhooks are checked against the exact bytes they signed.
  const app = await NestFactory.create(AppModule, { rawBody: true });

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
  app.useWebSocketAdapter(new WardenIoAdapter(app, origins));
  app.enableShutdownHooks();
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  // Everything under /api; the cookie paths in constants.config.ts follow it.
  app.setGlobalPrefix(API_PREFIX);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { ProxyConfigController } from './proxy.controller';
import { ProxyConfigService } from './proxy.service';

/** The Traefik config editor (server page → Proxy). */
@Module({ imports: [SessionModule], controllers: [ProxyConfigController], providers: [ProxyConfigService] })
export class ProxyConfigModule {}

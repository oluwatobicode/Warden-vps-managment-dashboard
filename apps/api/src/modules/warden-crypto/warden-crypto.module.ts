import { Global, Module } from '@nestjs/common';
import { KEY_PROVIDER } from '../../common/constants/warden-crypto.constants';
import { ConfigService } from '@nestjs/config';
import { EnvKeyProvider, KeyProvider } from 'warden-crypto';
import { OrgKeyService } from './org-key.service';

@Global()
@Module({
  providers: [
    {
      provide: KEY_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): KeyProvider =>
        new EnvKeyProvider({ masterKeyHex: config.getOrThrow('MASTER_KEY') }),
    },
    OrgKeyService,
  ],
  exports: [KEY_PROVIDER, OrgKeyService],
})
export class WardenCryptoModule {}

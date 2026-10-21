import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
import { DatabaseBackupController } from './database-backup.controller';
import { DatabaseBackupService } from './database-backup.service';
import { BackupStorageController } from './backup-storage.controller';
import { BackupStorageService } from './backup-storage.service';
import { backupQueueProvider, databaseQueueProvider } from './database.queue';

/** Databases as a service, their backups, and where the backups are stored. */
@Module({
  imports: [SessionModule],
  controllers: [
    DatabaseController,
    DatabaseBackupController,
    BackupStorageController,
  ],
  providers: [
    DatabaseService,
    DatabaseBackupService,
    BackupStorageService,
    databaseQueueProvider,
    backupQueueProvider,
  ],
})
export class DatabaseModule {}

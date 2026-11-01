import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { DatabaseDataController } from './database-data.controller';
import { DatabaseDataService } from './database-data.service';

/** The data browser: tables, rows, SQL and Redis commands, edits. */
@Module({
  imports: [SessionModule],
  controllers: [DatabaseDataController],
  providers: [DatabaseDataService],
})
export class DatabaseDataModule {}

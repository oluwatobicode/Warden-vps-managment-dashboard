import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session/session.module';
import { CanvasController } from './canvas.controller';
import { CanvasService } from './canvas.service';

@Module({
  imports: [SessionModule],
  controllers: [CanvasController],
  providers: [CanvasService],
})
export class CanvasModule {}

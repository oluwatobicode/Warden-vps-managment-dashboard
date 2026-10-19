import { Body, Controller, HttpCode, Put, UseGuards } from '@nestjs/common';
import {
  SaveCanvasPositionsSchema,
  type SaveCanvasPositionsInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CANVAS_MESSAGES } from '../../common/constants/messages.config';
import { CanvasService } from './canvas.service';

@Controller('canvas-positions')
@UseGuards(SessionGuard, RolesGuard)
export class CanvasController {
  constructor(private readonly canvas: CanvasService) {}

  @Put()
  @HttpCode(200)
  async save(
    @CurrentOrg() orgId: string,
    @Body(new ZodValidationPipe(SaveCanvasPositionsSchema))
    body: SaveCanvasPositionsInput,
  ) {
    await this.canvas.save(orgId, body);
    return { message: CANVAS_MESSAGES.saved };
  }
}

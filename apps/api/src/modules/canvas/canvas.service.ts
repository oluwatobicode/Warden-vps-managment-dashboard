import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SaveCanvasPositionsInput } from 'shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CANVAS_MESSAGES,
  ENVIRONMENT_MESSAGES,
} from '../../common/constants/messages.config';

@Injectable()
export class CanvasService {
  constructor(private readonly prisma: PrismaService) {}

  async save(orgId: string, input: SaveCanvasPositionsInput): Promise<void> {
    const db = this.prisma.client;
    const env = await db.environment.findFirst({
      where: { id: input.environmentId, organizationId: orgId },
      select: { id: true },
    });
    if (!env) throw new NotFoundException(ENVIRONMENT_MESSAGES.not_found);

    const ids = input.positions.map((p) => p.serviceId);
    const found = await db.service.count({
      where: { id: { in: ids }, environmentId: env.id, organizationId: orgId },
    });
    if (found !== ids.length) {
      throw new BadRequestException(CANVAS_MESSAGES.wrong_services);
    }

    await db.$transaction(
      input.positions.map((p) =>
        db.service.update({
          where: { id: p.serviceId },
          data: { canvasX: Math.round(p.x), canvasY: Math.round(p.y) },
        }),
      ),
    );
  }
}

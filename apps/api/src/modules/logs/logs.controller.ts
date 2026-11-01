import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ListLogsQuerySchema, type ListLogsQuery } from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { LogsService } from './logs.service';

/**
 * App logs: Developer and up (decided 2026-10-28), because logs often hold
 * things that shouldn't be shown to everyone. Session only: API tokens can't
 * read them. Live lines come over Socket.io (LogsGateway).
 */
@Controller('logs')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query(new ZodValidationPipe(ListLogsQuerySchema)) query: ListLogsQuery) {
    return this.logs.list(orgId, query);
  }

  @Get(':id/context')
  context(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.logs.context(orgId, id);
  }
}

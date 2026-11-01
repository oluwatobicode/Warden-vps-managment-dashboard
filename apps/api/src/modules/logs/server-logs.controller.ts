import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ListServerLogsQuerySchema, type ListServerLogsQuery } from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ServerLogsService } from './server-logs.service';

/** A server's own logs (server page → Logs). Developer and up, like app logs. Live lines come over LogsGateway. */
@Controller('server-logs')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
export class ServerLogsController {
  constructor(private readonly logs: ServerLogsService) {}

  @Get()
  list(@CurrentOrg() orgId: string, @Query(new ZodValidationPipe(ListServerLogsQuerySchema)) query: ListServerLogsQuery) {
    return this.logs.list(orgId, query);
  }

  @Get('sources')
  sources(@CurrentOrg() orgId: string, @Query('serverId', UuidPipe) serverId: string) {
    return this.logs.sources(orgId, serverId);
  }

  @Get(':id/context')
  context(@CurrentOrg() orgId: string, @Param('id') id: string) {
    return this.logs.context(orgId, id);
  }
}

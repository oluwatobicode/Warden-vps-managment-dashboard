import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { MonitoringService } from './monitoring.service';

/** GET /server-containers?serverId= : the Containers tab. Every role can view. */
@Controller('server-containers')
@UseGuards(SessionGuard, RolesGuard)
export class ServerContainersController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Get()
  list(
    @CurrentOrg() orgId: string,
    @Query('serverId', UuidPipe) serverId: string,
  ) {
    return this.monitoring.containers(orgId, serverId);
  }
}

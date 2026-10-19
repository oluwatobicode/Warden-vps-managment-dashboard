import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { DashboardService } from './dashboard.service';

/** GET /dashboard : the Home page's cards and recent deployments. Every role. */
@Controller('dashboard')
@UseGuards(SessionGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentOrg() orgId: string) {
    return this.dashboard.get(orgId);
  }
}

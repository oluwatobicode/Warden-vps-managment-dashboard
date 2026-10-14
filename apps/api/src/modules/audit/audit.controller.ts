import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  type ListAuditLogsQuery,
  ListAuditLogsQuerySchema,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @CurrentOrg() orgId: string,
    @Query(new ZodValidationPipe(ListAuditLogsQuerySchema))
    query: ListAuditLogsQuery,
  ) {
    return this.audit.list(orgId, query);
  }
}

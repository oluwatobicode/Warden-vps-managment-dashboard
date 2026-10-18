import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  type ListProjectActivityQuery,
  ListProjectActivityQuerySchema,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditService } from './audit.service';

/**
 * GET /project-activity?projectId= : a project's Activity tab, for EVERY role
 * (decided 2026-10-18). Its own controller on purpose: /audit-logs stays
 * Admin-only, and this route can only return one project's rows because
 * projectId is required by the schema.
 */
@Controller('project-activity')
@UseGuards(SessionGuard, RolesGuard)
export class ProjectActivityController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @CurrentOrg() orgId: string,
    @Query(new ZodValidationPipe(ListProjectActivityQuerySchema))
    query: ListProjectActivityQuery,
  ) {
    return this.audit.listForProject(orgId, query.projectId, query);
  }
}

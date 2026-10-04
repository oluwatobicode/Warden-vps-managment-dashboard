import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateServiceSchema,
  UpdateServiceSchema,
  type CreateServiceInput,
  type UpdateServiceInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ServiceService } from './service.service';

// Developers own their services (role table in claude.md), so this is the
// first controller where DEVELOPER has write access. VIEWER still reads only.
@Controller('services')
@UseGuards(SessionGuard, RolesGuard)
export class ServiceController {
  constructor(private readonly services: ServiceService) {}

  @Get()
  list(
    @CurrentOrg() orgId: string,
    @Query('environmentId', UuidPipe) environmentId: string,
  ) {
    return this.services.listServices(orgId, environmentId);
  }

  @Get(':id')
  get(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    return this.services.getService(orgId, id);
  }

  @Post()
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  create(
    @CurrentOrg() orgId: string,
    @Body(new ZodValidationPipe(CreateServiceSchema)) body: CreateServiceInput,
  ) {
    return this.services.createService(orgId, body);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  update(
    @CurrentOrg() orgId: string,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodValidationPipe(UpdateServiceSchema)) body: UpdateServiceInput,
  ) {
    return this.services.updateService(orgId, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
  @HttpCode(204)
  async remove(@CurrentOrg() orgId: string, @Param('id', UuidPipe) id: string) {
    await this.services.deleteService(orgId, id);
  }
}

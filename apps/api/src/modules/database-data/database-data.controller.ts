import { Body, Controller, Get, HttpCode, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  DataRowsQuerySchema,
  DataTablesQuerySchema,
  DeleteRedisKeysSchema,
  DeleteRowsSchema,
  InsertRowSchema,
  RedisCommandSchema,
  RedisKeyQuerySchema,
  RedisKeysQuerySchema,
  RunQuerySchema,
  SetRedisStringSchema,
  UpdateRowSchema,
  type DataRowsQuery,
  type DeleteRedisKeysInput,
  type DeleteRowsInput,
  type InsertRowInput,
  type RedisCommandInput,
  type RedisKeysQuery,
  type RunQueryInput,
  type SetRedisStringInput,
  type UpdateRowInput,
} from 'shared-types';
import { SessionGuard } from '../../common/guards/session.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { Actor } from '../../common/types/actor';
import { DatabaseDataService } from './database-data.service';

/**
 * The data browser (decided 2026-11-01): Developer and up may read AND edit
 * (Tobi's call, matching "Developers have full rights on databases").
 * Session only: API tokens can't reach a database's data.
 */
@Controller('database-data')
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN', 'DEV_OPS', 'DEVELOPER')
export class DatabaseDataController {
  constructor(private readonly data: DatabaseDataService) {}

  @Get('tables')
  tables(@CurrentOrg() orgId: string, @Query(new ZodValidationPipe(DataTablesQuerySchema)) q: { serviceId: string }) {
    return this.data.tables(orgId, q.serviceId);
  }

  @Get('rows')
  rows(@CurrentOrg() orgId: string, @Query(new ZodValidationPipe(DataRowsQuerySchema)) q: DataRowsQuery) {
    return this.data.rows(orgId, q);
  }

  @Post('query')
  @HttpCode(200)
  run(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(RunQuerySchema)) body: RunQueryInput) {
    return this.data.run(actor, body);
  }

  @Patch('rows')
  update(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(UpdateRowSchema)) body: UpdateRowInput) {
    return this.data.update(actor, body);
  }

  @Post('rows')
  insert(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(InsertRowSchema)) body: InsertRowInput) {
    return this.data.insert(actor, body);
  }

  /** A POST, not DELETE: it carries the keys and the typed table name. */
  @Post('rows/delete')
  @HttpCode(200)
  remove(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(DeleteRowsSchema)) body: DeleteRowsInput) {
    return this.data.remove(actor, body);
  }

  @Get('keys')
  keys(@CurrentOrg() orgId: string, @Query(new ZodValidationPipe(RedisKeysQuerySchema)) q: RedisKeysQuery) {
    return this.data.keys(orgId, q);
  }

  @Get('key')
  key(@CurrentOrg() orgId: string, @Query(new ZodValidationPipe(RedisKeyQuerySchema)) q: { serviceId: string; key: string }) {
    return this.data.value(orgId, q.serviceId, q.key);
  }

  @Post('command')
  @HttpCode(200)
  command(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(RedisCommandSchema)) body: RedisCommandInput) {
    return this.data.command(actor, body);
  }

  @Put('key')
  setString(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(SetRedisStringSchema)) body: SetRedisStringInput) {
    return this.data.setString(actor, body);
  }

  @Post('keys/delete')
  @HttpCode(200)
  removeKeys(@CurrentActor() actor: Actor, @Body(new ZodValidationPipe(DeleteRedisKeysSchema)) body: DeleteRedisKeysInput) {
    return this.data.removeKeys(actor, body);
  }
}

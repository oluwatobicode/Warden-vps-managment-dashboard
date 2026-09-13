import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma, type PrismaClient } from 'db';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient = prisma;

  onModuleInit() {
    return this.client.$connect();
  }
  onModuleDestroy() {
    return this.client.$disconnect();
  }
}

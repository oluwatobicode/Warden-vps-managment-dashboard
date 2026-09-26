import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { SessionGuard } from './common/guards/session.guard';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { CurrentOrg } from './common/decorators/current-org.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

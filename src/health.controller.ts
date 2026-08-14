import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { PrismaService } from './prisma/prisma.service';

/** Dùng cho healthcheck của Docker — chạm DB thật để biết app sẵn sàng nhận request. */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.category.count();
    return { status: 'ok' };
  }
}

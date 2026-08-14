import { Module } from '@nestjs/common';
import { DebtService } from './debt.service';
import { DebtController } from './debt.controller';
import { DebtRepository } from './debt.repository';

@Module({
  controllers: [DebtController],
  providers: [DebtService, DebtRepository],
  exports: [DebtRepository],
})
export class DebtModule {}

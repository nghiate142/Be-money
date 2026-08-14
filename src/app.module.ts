import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
import { CategoryModule } from './category/category.module';
import { ProjectModule } from './project/project.module';
import { TransactionModule } from './transaction/transaction.module';
import { DebtModule } from './debt/debt.module';
import { ReportModule } from './report/report.module';
import { PersonModule } from './person/person.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CategoryModule,
    ProjectModule,
    TransactionModule,
    DebtModule,
    ReportModule,
    PersonModule,
    ExchangeRateModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}

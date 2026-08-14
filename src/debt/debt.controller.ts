import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { DebtService } from './debt.service';
import { CreateDebtDto } from './dto/create-debt.dto';
import { UpdateDebtDto } from './dto/update-debt.dto';
import { QueryDebtDto } from './dto/query-debt.dto';
import { CreateDebtPaymentDto } from './dto/create-debt-payment.dto';

@Controller('debts')
export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  @Post()
  create(@Body() dto: CreateDebtDto) {
    return this.debtService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryDebtDto) {
    return this.debtService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.debtService.findOne(id);
  }

  /** Lịch trả nợ dự kiến + đối chiếu với số đã trả. */
  @Get(':id/schedule')
  schedule(@Param('id', ParseIntPipe) id: number) {
    return this.debtService.schedule(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDebtDto) {
    return this.debtService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.debtService.remove(id);
  }

  @Post(':id/payments')
  addPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDebtPaymentDto,
  ) {
    return this.debtService.addPayment(id, dto);
  }

  @Delete(':id/payments/:paymentId')
  removePayment(
    @Param('id', ParseIntPipe) id: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.debtService.removePayment(id, paymentId);
  }
}

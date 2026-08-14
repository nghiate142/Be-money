import { Controller, Get, Header, Query } from '@nestjs/common';
import { ReportService } from './report.service';
import { TransactionService } from '../transaction/transaction.service';
import { QueryTransactionDto } from '../transaction/dto/query-transaction.dto';

/** Escape theo RFC 4180 + BOM để Excel đọc đúng tiếng Việt. */
function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '﻿';
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) =>
    v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  return (
    '﻿' +
    [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join(
      '\r\n',
    )
  );
}

@Controller('reports')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly transactions: TransactionService,
  ) {}

  @Get('overview')
  overview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportService.overview(from, to);
  }

  @Get('by-category')
  byCategory(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportService.byCategory(from, to);
  }

  @Get('by-project')
  byProject(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportService.byProject(from, to);
  }

  @Get('loans')
  loans() {
    return this.reportService.loans();
  }

  @Get('by-person')
  byPerson() {
    return this.reportService.byPerson();
  }

  @Get('monthly')
  monthly(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportService.monthly(from, to);
  }

  /** Nhận đúng bộ lọc của /transactions. */
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="transactions.csv"')
  async export(@Query() query: QueryTransactionDto) {
    const rows = await this.transactions.export(query);
    return toCsv(
      rows.map((t) => ({
        id: t.id,
        date: t.date.toISOString().slice(0, 10),
        kind: t.kind,
        nature: t.nature,
        amount: t.amount,
        category: t.category?.name,
        project: t.project?.name ?? '(cá nhân)',
        note: t.note ?? '',
      })),
    );
  }
}

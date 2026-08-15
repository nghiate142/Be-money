import { Controller, Get, Header, Query } from '@nestjs/common';
import { ReportService } from './report.service';
import { TransactionService } from '../transaction/transaction.service';
import { QueryTransactionDto } from '../transaction/dto/query-transaction.dto';
import { QueryReportDto } from './dto/query-report.dto';

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
  overview(@Query() q: QueryReportDto) {
    return this.reportService.overview(q);
  }

  @Get('by-category')
  byCategory(@Query() q: QueryReportDto) {
    return this.reportService.byCategory(q);
  }

  @Get('by-project')
  byProject(@Query() q: QueryReportDto) {
    return this.reportService.byProject(q);
  }

  @Get('loans')
  loans() {
    return this.reportService.loans();
  }

  @Get('by-person')
  byPerson(@Query() q: QueryReportDto) {
    return this.reportService.byPerson(q);
  }

  @Get('monthly')
  monthly(@Query() q: QueryReportDto) {
    return this.reportService.monthly(q);
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
        person: t.person?.name ?? '',
        note: t.note ?? '',
      })),
    );
  }
}

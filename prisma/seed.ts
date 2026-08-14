import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});

/** Danh mục hệ thống — code dùng để tự sinh giao dịch từ khoản nợ, không cho sửa/xoá. */
const SYSTEM = [
  { code: 'DEBT_BORROW', name: 'Vay nợ', kind: 'income' },
  { code: 'DEBT_REPAY', name: 'Trả nợ gốc', kind: 'expense' },
  { code: 'DEBT_INTEREST', name: 'Lãi vay', kind: 'expense' },
  { code: 'DEBT_LEND', name: 'Cho vay', kind: 'expense' },
  { code: 'DEBT_COLLECT', name: 'Thu hồi nợ', kind: 'income' },
];

const NORMAL = [
  { name: 'Lương', kind: 'income' },
  { name: 'Doanh thu dự án', kind: 'income' },
  { name: 'Thu khác', kind: 'income' },
  { name: 'Ăn uống', kind: 'expense' },
  { name: 'Đi lại', kind: 'expense' },
  { name: 'Thiết bị', kind: 'expense' },
  { name: 'Thuê ngoài', kind: 'expense' },
  { name: 'Hoá đơn', kind: 'expense' },
  { name: 'Chi khác', kind: 'expense' },
];

/** VND là tiền gốc của sổ; các loại khác quy đổi về VND khi ghi. */
const CURRENCIES = [
  { code: 'VND', name: 'Việt Nam Đồng', decimals: 0 },
  { code: 'USD', name: 'Đô la Mỹ', decimals: 2 },
  { code: 'EUR', name: 'Euro', decimals: 2 },
  { code: 'JPY', name: 'Yên Nhật', decimals: 0 },
];

async function main() {
  for (const c of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { name: c.name, decimals: c.decimals },
      create: c,
    });
  }
  for (const c of SYSTEM) {
    await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name, kind: c.kind },
      create: c,
    });
  }
  for (const c of NORMAL) {
    await prisma.category.upsert({
      where: { name_kind: { name: c.name, kind: c.kind } },
      update: {},
      create: c,
    });
  }
  console.log(
    `Đã seed ${CURRENCIES.length} loại tiền, ${SYSTEM.length} danh mục hệ thống ` +
      `và ${NORMAL.length} danh mục thường.`,
  );
}

main().finally(() => prisma.$disconnect());

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** VND là tiền gốc của sổ; các loại khác quy đổi về VND khi ghi. */
const CURRENCIES = [
  { code: 'VND', name: 'Việt Nam Đồng', decimals: 0 },
  { code: 'USD', name: 'Đô la Mỹ', decimals: 2 },
  { code: 'EUR', name: 'Euro', decimals: 2 },
  { code: 'JPY', name: 'Yên Nhật', decimals: 0 },
];

/** Code cố định — repository tra theo code khi tự sinh giao dịch từ khoản nợ. */
const SYSTEM_CATEGORIES = [
  { code: 'DEBT_BORROW', name: 'Vay nợ', kind: 'income' },
  { code: 'DEBT_REPAY', name: 'Trả nợ gốc', kind: 'expense' },
  { code: 'DEBT_INTEREST', name: 'Lãi vay', kind: 'expense' },
  { code: 'DEBT_LEND', name: 'Cho vay', kind: 'expense' },
  { code: 'DEBT_COLLECT', name: 'Thu hồi nợ', kind: 'income' },
];

/** Chỉ tạo ở lần chạy đầu; sau đó tôn trọng việc người dùng sửa/xoá. */
const STARTER_CATEGORIES = [
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

/**
 * Dữ liệu nền chạy mỗi lần khởi động, idempotent.
 * App phụ thuộc vào các danh mục hệ thống, nên không để bước này thành
 * thao tác tay dễ quên khi deploy.
 */
@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const c of CURRENCIES) {
      await this.prisma.currency.upsert({
        where: { code: c.code },
        update: { name: c.name, decimals: c.decimals },
        create: c,
      });
    }

    for (const c of SYSTEM_CATEGORIES) {
      await this.prisma.category.upsert({
        where: { code: c.code },
        update: { name: c.name, kind: c.kind },
        create: c,
      });
    }

    // Danh mục gợi ý chỉ tạo khi sổ còn trắng — xoá rồi thì không mọc lại.
    const userCategories = await this.prisma.category.count({
      where: { code: null },
    });
    if (userCategories === 0) {
      await this.prisma.category.createMany({ data: STARTER_CATEGORIES });
      this.logger.log(`Đã tạo ${STARTER_CATEGORIES.length} danh mục gợi ý ban đầu.`);
    }
  }
}

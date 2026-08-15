import Anthropic from '@anthropic-ai/sdk';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ảnh hoá đơn / màn hình biến động số dư -> gợi ý các trường của form giao dịch.
 * Chỉ GỢI Ý: kết quả đổ vào form cho người dùng sửa rồi mới lưu, không tự ghi sổ.
 */
export type ScanResult = {
  date: string | null;
  kind: 'income' | 'expense';
  currency: string;
  /** Theo đơn vị lớn: 120.50 USD, 3000000 VND. */
  amount: number;
  fee: number;
  categoryId: number | null;
  personId: number | null;
  note: string;
  /** Model tự đánh giá độ chắc chắn, để cảnh báo người dùng xem kỹ. */
  confidence: 'high' | 'medium' | 'low';
  warning: string | null;
};

const SCHEMA = {
  type: 'object',
  properties: {
    date: { type: ['string', 'null'], description: 'Ngày giao dịch, dạng YYYY-MM-DD' },
    kind: {
      type: 'string',
      enum: ['income', 'expense'],
      description: 'income = tiền vào (nhận tiền, ghi có, dấu +), expense = tiền ra',
    },
    currency: { type: 'string', description: 'Mã tiền tệ 3 ký tự, mặc định VND' },
    amount: {
      type: 'number',
      description: 'Số tiền theo đơn vị lớn (USD 120.50, VND 3000000), luôn dương',
    },
    fee: { type: 'number', description: 'Phí giao dịch tính bằng VND, 0 nếu không thấy' },
    categoryId: { type: ['integer', 'null'], description: 'Id danh mục phù hợp nhất' },
    personId: { type: ['integer', 'null'], description: 'Id người gửi/nhận nếu khớp tên' },
    note: { type: 'string', description: 'Nội dung chuyển khoản hoặc tên hàng, ngắn gọn' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    warning: {
      type: ['string', 'null'],
      description:
        'Cảnh báo ngắn nếu ảnh mờ, có nhiều giao dịch, hoặc nghi là chuyển tiền giữa tài khoản của chính chủ / vay trả nợ',
    },
  },
  required: [
    'date',
    'kind',
    'currency',
    'amount',
    'fee',
    'categoryId',
    'personId',
    'note',
    'confidence',
    'warning',
  ],
  additionalProperties: false,
} as const;

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);
  // Haiku 4.5 đủ cho ảnh hoá đơn / biến động số dư và rẻ nhất (~80đ/ảnh).
  // Ảnh mờ hoặc hoá đơn nhiều dòng thì đổi ANTHROPIC_MODEL=claude-sonnet-5.
  private readonly model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5';

  constructor(private readonly prisma: PrismaService) {}

  async scan(file: { buffer: Buffer; mimetype: string; size: number }): Promise<ScanResult> {
    if (!process.env.ANTHROPIC_API_KEY)
      throw new ServiceUnavailableException(
        'Chưa cấu hình ANTHROPIC_API_KEY nên không đọc được ảnh',
      );
    if (!MEDIA_TYPES.includes(file.mimetype as MediaType))
      throw new BadRequestException('Chỉ nhận ảnh JPEG, PNG, GIF hoặc WebP');

    const [categories, people] = await Promise.all([
      // Danh mục hệ thống (code khác null) chỉ dùng cho giao dịch sinh từ nợ.
      this.prisma.category.findMany({
        where: { code: null },
        select: { id: true, name: true, kind: true },
      }),
      this.prisma.person.findMany({ select: { id: true, name: true } }),
    ]);

    const client = new Anthropic();
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: this.prompt(categories, people),
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: file.mimetype as MediaType,
                  data: file.buffer.toString('base64'),
                },
              },
              { type: 'text', text: 'Đọc ảnh này và trả về thông tin giao dịch.' },
            ],
          },
        ],
      });
    } catch (e) {
      this.logger.error(`Gọi Claude thất bại: ${(e as Error).message}`);
      // Sai key / hết credit là lỗi cấu hình, không phải lỗi tạm thời —
      // nói thẳng ra, nếu không người dùng cứ bấm lại mà không biết vì sao.
      if (e instanceof Anthropic.APIError && e.status && e.status < 500)
        throw new ServiceUnavailableException(
          `Không gọi được Claude: ${this.reason(e)}`,
        );
      throw new ServiceUnavailableException('Không đọc được ảnh, thử lại hoặc nhập tay');
    }

    if (response.stop_reason === 'refusal')
      throw new BadRequestException('Ảnh này không đọc được, nhập tay giúp mình');

    const text = response.content.find((b) => b.type === 'text')?.text;
    if (!text) throw new ServiceUnavailableException('Không đọc được ảnh, nhập tay giúp mình');

    return this.normalize(JSON.parse(text) as ScanResult, categories, people);
  }

  private reason(e: InstanceType<typeof Anthropic.APIError>) {
    if (e.status === 401) return 'ANTHROPIC_API_KEY sai hoặc đã bị thu hồi';
    if (e.status === 429) return 'đang bị giới hạn tốc độ, thử lại sau ít phút';
    const message = (e.error as { error?: { message?: string } })?.error?.message;
    return message ?? e.message;
  }

  private prompt(
    categories: { id: number; name: string; kind: string }[],
    people: { id: number; name: string }[],
  ) {
    return [
      'Bạn đọc ảnh hoá đơn hoặc ảnh chụp màn hình giao dịch ngân hàng / ví điện tử Việt Nam',
      'và bóc ra thông tin để ghi vào sổ thu chi.',
      '',
      'Xác định chiều tiền theo thứ tự ưu tiên: dấu và màu của số tiền (+ xanh = tiền vào,',
      '− đỏ = tiền ra), rồi tới từ khoá ("nhận tiền từ", "ghi có" = vào; "chuyển tiền tới",',
      '"ghi nợ", "thanh toán" = ra). Không suy đoán từ tên người.',
      '',
      'Chỉ chọn categoryId trong danh sách dưới đây và phải đúng chiều tiền (kind).',
      'Không chắc thì để null — thà bỏ trống còn hơn đoán sai.',
      `Danh mục: ${categories.map((c) => `${c.id}=${c.name} (${c.kind})`).join('; ') || '(chưa có)'}`,
      `Người: ${people.map((p) => `${p.id}=${p.name}`).join('; ') || '(chưa có)'}`,
      '',
      'Đặt warning khi: ảnh mờ/thiếu số tiền, ảnh chứa nhiều giao dịch (chỉ lấy giao dịch',
      'đầu tiên và nói rõ), hoặc nghi đây là chuyển tiền giữa hai tài khoản của cùng một',
      'người, hay là khoản vay / trả nợ (những khoản này phải ghi ở tab Nợ, không ghi ở đây).',
    ].join('\n');
  }

  /** Không tin số model trả về: kẹp về khoảng hợp lệ và bỏ id không tồn tại. */
  private normalize(
    r: ScanResult,
    categories: { id: number; kind: string }[],
    people: { id: number }[],
  ): ScanResult {
    const kind = r.kind === 'income' ? 'income' : 'expense';
    const category = categories.find((c) => c.id === r.categoryId && c.kind === kind);
    return {
      date: /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') ? r.date : null,
      kind,
      currency: /^[A-Za-z]{3}$/.test(r.currency ?? '') ? r.currency.toUpperCase() : 'VND',
      amount: Number.isFinite(r.amount) ? Math.abs(r.amount) : 0,
      fee: Number.isFinite(r.fee) && r.fee > 0 ? Math.round(r.fee) : 0,
      categoryId: category?.id ?? null,
      personId: people.some((p) => p.id === r.personId) ? r.personId : null,
      note: typeof r.note === 'string' ? r.note.slice(0, 1000) : '',
      confidence: ['high', 'medium', 'low'].includes(r.confidence) ? r.confidence : 'low',
      warning: r.warning || null,
    };
  }
}

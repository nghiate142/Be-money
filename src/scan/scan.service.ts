import { GoogleGenAI, Type } from '@google/genai';
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
 *
 * Dùng Gemini vì có hạn mức miễn phí, chỉ cần tài khoản Google, không cần thẻ.
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

/** Schema của Gemini: dùng `nullable` chứ không phải union type như JSON Schema. */
const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    date: { type: Type.STRING, nullable: true, description: 'Ngày giao dịch YYYY-MM-DD' },
    kind: {
      type: Type.STRING,
      enum: ['income', 'expense'],
      description: 'income = tiền vào (nhận tiền, ghi có, dấu +), expense = tiền ra',
    },
    currency: { type: Type.STRING, description: 'Mã tiền tệ 3 ký tự, mặc định VND' },
    amount: {
      type: Type.NUMBER,
      description: 'Số tiền theo đơn vị lớn (USD 120.50, VND 3000000), luôn dương',
    },
    fee: { type: Type.NUMBER, description: 'Phí giao dịch tính bằng VND, 0 nếu không thấy' },
    categoryId: { type: Type.INTEGER, nullable: true, description: 'Id danh mục phù hợp' },
    personId: { type: Type.INTEGER, nullable: true, description: 'Id người gửi/nhận' },
    note: { type: Type.STRING, description: 'Nội dung chuyển khoản hoặc tên hàng, ngắn gọn' },
    confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    warning: {
      type: Type.STRING,
      nullable: true,
      description: 'Cảnh báo ngắn khi ảnh mờ, nhiều giao dịch, nghi chuyển nội bộ hoặc vay nợ',
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
};

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);
  // Flash nằm trong hạn mức miễn phí và đủ cho ảnh hoá đơn / biến động số dư.
  private readonly model = process.env.GEMINI_MODEL ?? 'gemini-flash-latest';

  constructor(private readonly prisma: PrismaService) {}

  async scan(file: { buffer: Buffer; mimetype: string }): Promise<ScanResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
      throw new ServiceUnavailableException(
        'Chưa cấu hình GEMINI_API_KEY nên không đọc được ảnh',
      );
    if (!MEDIA_TYPES.includes(file.mimetype))
      throw new BadRequestException('Chỉ nhận ảnh JPEG, PNG, GIF hoặc WebP');

    const [categories, people] = await Promise.all([
      // Danh mục hệ thống (code khác null) chỉ dùng cho giao dịch sinh từ nợ.
      this.prisma.category.findMany({
        where: { code: null },
        select: { id: true, name: true, kind: true },
      }),
      this.prisma.person.findMany({ select: { id: true, name: true } }),
    ]);

    let text: string | undefined;
    try {
      const response = await new GoogleGenAI({ apiKey }).models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: file.mimetype,
                  data: file.buffer.toString('base64'),
                },
              },
              { text: 'Đọc ảnh này và trả về thông tin giao dịch.' },
            ],
          },
        ],
        config: {
          systemInstruction: this.prompt(categories, people),
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      });
      text = response.text;
    } catch (e) {
      // Sai key / hết hạn mức là lỗi cấu hình, không phải lỗi tạm thời — nói
      // thẳng ra, nếu không người dùng cứ bấm lại mà không biết vì sao.
      const message = (e as Error).message;
      this.logger.error(`Gọi Gemini thất bại: ${message}`);
      throw new ServiceUnavailableException(`Không đọc được ảnh: ${this.reason(message)}`);
    }

    if (!text) throw new ServiceUnavailableException('Không đọc được ảnh, nhập tay giúp mình');

    return this.normalize(JSON.parse(text) as ScanResult, categories, people);
  }

  private reason(message: string) {
    if (/API key|API_KEY_INVALID|401|403/i.test(message))
      return 'GEMINI_API_KEY sai hoặc đã bị thu hồi';
    if (/quota|RESOURCE_EXHAUSTED|429/i.test(message))
      return 'hết hạn mức miễn phí trong ngày, thử lại sau';
    return 'thử lại hoặc nhập tay';
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
      '− đỏ = tiền ra), rồi tới từ khoá ("nhận tiền đến", "nhận tiền từ", "ghi có" = vào;',
      '"chuyển tiền tới", "ghi nợ", "thanh toán" = ra). Không suy đoán từ tên người.',
      '',
      'Chỉ chọn categoryId trong danh sách dưới đây và phải đúng chiều tiền (kind).',
      'Không khớp danh mục cụ thể nào thì lấy danh mục chung nhất đúng chiều tiền',
      '(tên có chữ "khác"); không có danh mục chung thì để null.',
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

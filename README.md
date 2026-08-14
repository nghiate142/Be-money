# Sổ thu chi — Backend

API cho ứng dụng thống kê thu chi cá nhân: tiền vào/ra, tách theo công việc, quản lý nợ
và các khoản vay ngân hàng. Một tài khoản duy nhất, dữ liệu nằm trong một file SQLite.

**NestJS 11 · Prisma 7 · SQLite · JWT**

Frontend: [Fe-money](https://github.com/nghiate142/Fe-money)

Nghiệp vụ chi tiết: [docs/nghiep-vu.md](docs/nghiep-vu.md)

---

## Chạy lần đầu

```bash
npm install
cp .env.example .env
```

Sinh `JWT_SECRET` ngẫu nhiên rồi dán vào `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Đặt mật khẩu (script tự ghi hash vào `.env`):

```bash
npm run set-password -- "mật khẩu của bạn"
```

Tạo database và dữ liệu khởi tạo:

```bash
npx prisma migrate deploy && npx prisma generate && npm run seed
```

Chạy:

```bash
npm run dev
```

## Chạy trên server

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
npm run start:prod
```

Bắt buộc trong `.env` trên server:

| Biến | Ghi chú |
|---|---|
| `JWT_SECRET` | Chuỗi ngẫu nhiên dài, **không** dùng lại giá trị mẫu |
| `APP_PASSWORD_HASH` | Sinh bằng `npm run set-password` |
| `WEB_ORIGIN` | Đúng origin của frontend, vd `https://money.example.com`. Bỏ trống chỉ dùng khi chạy local |

`src/generated/` không nằm trong repo — luôn chạy `npx prisma generate` trước khi build.

Nên chạy sau reverse proxy có HTTPS (nginx/Caddy). App không tự phục vụ TLS.

## Sao lưu

Toàn bộ dữ liệu nằm trong `dev.db`. Copy file đó là xong:

```powershell
.\backup.ps1
```

## Mô hình dữ liệu

| Bảng | Ý nghĩa |
|---|---|
| `Category` | Loại tiền (`code` khác null = danh mục hệ thống, không sửa/xoá) |
| `Project` | Công việc: Job A, Job B… |
| `Person` | Người / ngân hàng / công ty tài chính liên quan tới nợ |
| `Transaction` | Mọi chuyển động tiền, gồm cả tiền vay và tiền trả nợ |
| `Debt` | Khoản nợ: ai, chiều nợ, gốc, ngày chuyển tiền, hạn trả, điều khoản vay |
| `DebtPayment` | Từng lần trả, tách rõ tiền gốc và tiền lãi |
| `Currency` / `ExchangeRate` | Loại tiền và tỷ giá theo ngày (cache từ API) |

### Ba bản chất giao dịch (`nature`)

| `nature` | Ví dụ | Vào số dư | Vào lãi/lỗ |
|---|---|:--:|:--:|
| `operating` | Doanh thu, vật tư, ăn uống | ✅ | ✅ |
| `financing` | Vay, trả gốc, cho vay, thu hồi | ✅ | ❌ |
| `interest` | Lãi vay | ✅ | ✅ |

Vay 10tr **không phải** doanh thu — nó chỉ đổi hình thái tài sản. Vì vậy lãi/lỗ công việc
bỏ hết `financing`, còn số dư thì tính tất.

Mọi sự kiện của khoản nợ **tự sinh giao dịch tiền**, trừ khi tắt cờ `affectsBalance`
(dùng cho khoản vay cũ mà tiền đã tiêu hết trước khi bắt đầu dùng app).

Tiền lưu bằng số nguyên VND. `remaining` và trạng thái nợ **không lưu trong DB**, luôn
tính lại để không bao giờ lệch với số tiền.

### Vay ngân hàng / công ty tài chính

| Cách tính lãi | Công thức |
|---|---|
| `declining` | Lãi kỳ = dư nợ còn lại × lãi suất tháng, gốc chia đều |
| `flat` | Lãi kỳ = gốc ban đầu × lãi suất tháng (không đổi) |
| `annuity` | Tổng trả mỗi kỳ bằng nhau (EMI) |
| `fixed` | Số tiền lãi cố định mỗi tháng |
| `contract` | Chép thẳng số tiền mỗi kỳ trong hợp đồng, lãi = tiền trả − gốc |

Lịch trả **chỉ để đối chiếu** — app không tự tạo giao dịch, tiền chỉ vào sổ khi bấm
"Ghi trả".

## API

```
POST   /auth/login                       GET /auth/me

GET/POST       /categories               PATCH/DELETE /categories/:id
GET/POST       /projects                 PATCH/DELETE /projects/:id
GET            /projects/:id/summary
GET/POST       /people                   PATCH/DELETE /people/:id
GET/POST       /transactions             PATCH/DELETE /transactions/:id
GET/POST       /debts                    PATCH/DELETE /debts/:id
GET            /debts/:id/schedule
POST           /debts/:id/payments       DELETE /debts/:id/payments/:paymentId

GET            /exchange-rates/currencies
GET            /exchange-rates/resolve?currency=USD&date=YYYY-MM-DD
GET/POST       /exchange-rates

GET /reports/overview | by-category | by-project | by-person | loans | monthly | export.csv
```

Mọi route trừ `/auth/login` đều cần header `Authorization: Bearer <token>`.

### Bộ lọc

Danh sách nào cũng nhận `q`, `from`, `to`, `sort=field:asc|desc`, `page`, `limit`
(tối đa 200) và trả về `{ items, total, page, limit }`.

- `/transactions` — thêm `kind`, `nature`, `scope` (`project`/`personal`), `categoryId`,
  `projectId`, `amountMin`, `amountMax`
- `/debts` — thêm `direction`, `status` (`active`/`overdue`/`paid`), `personId`,
  `projectId`, `dueFrom`, `dueTo`, `amountMin`/`amountMax` (theo số **còn lại**)
- `/projects` — thêm `status`, sort theo `profit`/`income`/`expense`
- `/people` — thêm `status` (`owing`/`clear`), sort theo `iOwe`/`owesMe`

`categoryId` và `projectId` nhận nhiều giá trị (`?projectId=1&projectId=2`) và giá trị
đặc biệt `none` = không thuộc mục nào.

## Kiểm thử

```bash
npx jest
```

Bao gồm 4 cách tính lãi, làm tròn kỳ cuối, ngày đến hạn khi tháng ngắn hơn, và đối chiếu
lịch trả với số đã trả thực tế.

## Đã cố tình bỏ

- Nhiều người dùng, đăng ký, quên mật khẩu — sửa `.env` là xong.
- Ngân sách, giao dịch định kỳ, đính kèm hoá đơn, nhiều ví.
- Phân bổ chi phí chung cho nhiều công việc theo tỉ lệ.
- Full-text search — SQLite `LIKE` đủ cho vài chục nghìn dòng.

Danh sách nợ, công việc và người lọc/sắp xếp theo giá trị tính toán (`remaining`,
`profit`) trong bộ nhớ. Đủ cho quy mô cá nhân; vượt vài nghìn bản ghi thì chuyển sang raw
SQL `GROUP BY` — chỗ cần sửa đã đánh dấu `ponytail:` trong code.

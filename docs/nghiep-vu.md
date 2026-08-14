# Nghiệp vụ — bản rà soát lại

Tài liệu này chốt nghiệp vụ trước khi sửa code. Chưa có dòng code nào theo bản này.

---

## 1. Đang sai ở đâu

### Lỗi 1 — Nợ không sinh ra dòng tiền

Vay anh Nam 10tr. Trong app hiện tại: `Debt` được tạo, hết. Số dư tiền mặt **không đổi**.

Thực tế: tiền trong túi bạn tăng 10tr. Đây là lỗi nặng nhất — số dư app hiển thị không phải
số tiền bạn thực có.

Tương tự: trả nợ 4tr thì tiền trong túi giảm 4tr, app cũng không ghi nhận.

### Lỗi 2 — Không phân biệt "dòng tiền" và "lãi lỗ"

Hiện tại app chỉ có một khái niệm: `income` / `expense`, và mặc định coi
`income − expense = lãi`. Sai, vì có 3 loại tiền vào ra khác nhau về bản chất:

| Loại | Ví dụ | Đổi số dư? | Đổi lãi/lỗ? |
|---|---|:--:|:--:|
| **Kinh doanh** | Khách trả tiền dự án, mua vật tư, ăn uống | ✅ | ✅ |
| **Vay / trả gốc** | Vay 10tr, trả gốc 4tr, cho vay, thu hồi | ✅ | ❌ |
| **Lãi vay** | Trả 500k tiền lãi cho khoản vay | ✅ | ✅ |

Vay 10tr **không phải** là bạn kiếm được 10tr. Nó chỉ đổi hình thái: tiền mặt +10tr,
nợ phải trả +10tr, **tài sản ròng không đổi**. Nếu tính vào lãi thì hôm nay lãi 10tr,
mai trả nợ lại lỗ 10tr — con số vô nghĩa.

Ngược lại, **tiền lãi vay** thì đúng là chi phí thật, phải vào lãi/lỗ.

### Lỗi 3 — Không phân định rõ "của công việc" hay "hằng ngày"

Hiện `projectId` để trống là mặc định. Không có ranh giới rõ giữa:

- Tiền của công việc: doanh thu Job A, vật tư Job A, thuê ngoài Job A
- Tiêu dùng cá nhân hằng ngày: ăn uống, xăng xe, hoá đơn điện nước

Báo cáo trộn cả hai vào một cục "số dư", nên không trả lời được câu hỏi quan trọng nhất:
**"Job A thực sự lãi bao nhiêu?"** và **"Tháng này tôi tiêu cá nhân hết bao nhiêu?"**

### Lỗi 4 — Thiếu những thứ nợ thật sự cần

- **Người**: `party` đang là text tự do. Gõ "Anh Nam" và "anh nam" thành 2 người khác nhau.
  Không tổng hợp được "tổng tôi đang nợ anh Nam bao nhiêu qua 3 khoản vay".
- **Lãi vay**: vay có lãi là chuyện bình thường, app chưa có chỗ ghi.
- **Trả một phần gốc + một phần lãi**: một lần trả 5tr có thể là 4.5tr gốc + 500k lãi.

---

## 2. Nguyên tắc sửa

> Mỗi lần tiền chuyển động, trả lời 3 câu: **Tiền đi đâu? Bản chất là gì? Của việc nào?**

### 2.1 Ba bản chất giao dịch (`nature`)

| `nature` | Nghĩa | Vào số dư | Vào lãi/lỗ |
|---|---|:--:|:--:|
| `operating` | Kinh doanh / tiêu dùng thật | ✅ | ✅ |
| `financing` | Vay, trả gốc, cho vay, thu hồi gốc | ✅ | ❌ |
| `interest` | Lãi vay phải trả / lãi cho vay được nhận | ✅ | ✅ |

Đây là thay đổi cốt lõi. `kind` (vào/ra) giữ nguyên, chỉ thêm `nature` để biết
giao dịch đó có được tính vào lãi/lỗ hay không.

### 2.2 Ranh giới công việc / cá nhân

Mỗi giao dịch bắt buộc chọn một trong hai, không để mập mờ:

- **Thuộc công việc X** — vào lãi/lỗ của X
- **Cá nhân / hằng ngày** — vào báo cáo chi tiêu cá nhân, không đụng lãi/lỗ job nào

Báo cáo tách hẳn hai khối, không cộng chung.

### 2.3 Nợ luôn đi kèm giao dịch tiền

Nợ không còn là bảng độc lập. Mỗi sự kiện của khoản nợ **tự sinh một giao dịch tiền**:

| Sự kiện | Chiều tiền | `nature` |
|---|---|---|
| Tôi vay tiền | Vào | `financing` |
| Tôi trả gốc | Ra | `financing` |
| Tôi trả lãi | Ra | `interest` |
| Tôi cho vay | Ra | `financing` |
| Người ta trả gốc cho tôi | Vào | `financing` |
| Người ta trả lãi cho tôi | Vào | `interest` |

Nhờ vậy **số dư trong app = số tiền thật bạn có**, luôn luôn, không cần đối chiếu tay.

### Khoản vay cũ: cờ "cộng vào số dư"

Khi bắt đầu dùng app, các khoản vay từ trước đã tiêu hết tiền rồi. Ghi vào mà vẫn cộng
gốc vào số dư thì số dư phồng lên sai. Vì vậy mỗi khoản nợ có cờ `affectsBalance`:

| | Bật (mặc định) | Tắt |
|---|---|---|
| Dùng khi | Vừa nhận/đưa tiền xong | Khoản cũ, tiền đã tiêu hết trước khi dùng app |
| Giao dịch tiền gốc | Có | **Không** |
| Số dư | Tăng/giảm theo gốc | **Không đổi** |
| Dư nợ | Có theo dõi | Có theo dõi |
| Tài sản ròng | Không đổi | **Giảm** đúng bằng số nợ |
| Các lần **trả nợ** | Ghi vào sổ | **Vẫn ghi vào sổ** |

Tài sản ròng giảm là đúng: bạn đang nợ tiền mà tiền thì không còn.

Bật/tắt lại sau cũng được — app tự tạo hoặc xoá giao dịch gốc tương ứng.

---

## 3. Ví dụ chạy đủ — Job A

Vay anh Nam 10tr (lãi 500k) để làm Job A. Xen giữa có ăn uống cá nhân 500k.

| # | Việc | Chiều | `nature` | Thuộc | Số dư sau | Lãi Job A |
|---|---|---|---|---|---:|---:|
| 1 | Vay anh Nam 10tr | Vào | `financing` | Job A | 10.000.000 | 0 |
| 2 | Mua vật tư Job A 8tr | Ra | `operating` | Job A | 2.000.000 | −8.000.000 |
| 3 | Ăn uống 1,5tr | Ra | `operating` | Cá nhân | 500.000 | −8.000.000 |
| 4 | Khách trả tiền Job A 30tr | Vào | `operating` | Job A | 30.500.000 | +22.000.000 |
| 5 | Trả gốc anh Nam 10tr | Ra | `financing` | Job A | 20.500.000 | +22.000.000 |
| 6 | Trả lãi anh Nam 500k | Ra | `interest` | Job A | 20.000.000 | +21.500.000 |

Đọc kết quả:

- **Số dư 20.000.000** — đúng bằng tiền thật còn trong túi.
- **Lãi Job A = 21.500.000** — doanh thu 30tr, trừ vật tư 8tr, trừ lãi vay 500k.
  Khoản vay 10tr và việc trả gốc 10tr **không làm méo con số này**.
- **Chi tiêu cá nhân tháng = 1.500.000** — tách riêng, không lẫn vào Job A.

So với model hiện tại: dòng 1 và 5 sẽ bị tính là thu/chi của Job A, làm lãi Job A
nhảy lên 32tr rồi tụt về 22tr, và số dư thì sai suốt từ dòng 1.

---

## 4. Thay đổi cần làm

### Dữ liệu

| Bảng | Thay đổi |
|---|---|
| `Person` | **Mới.** Danh sách người: tên, điện thoại, ghi chú. Thay cho `Debt.party` text tự do |
| `Transaction` | Thêm `nature` (`operating`/`financing`/`interest`); thêm liên kết ngược về `Debt` / `DebtPayment` |
| `Debt` | `party` → `personId`; thêm `interestAmount` (tiền lãi phải trả, nếu có) |
| `DebtPayment` | Tách `principalAmount` (gốc) và `interestAmount` (lãi) trong cùng một lần trả |
| `Category` | Thêm cờ đánh dấu danh mục hệ thống (Vay nợ, Trả nợ, Lãi vay) để không cho sửa/xoá |

### Báo cáo

- **Số dư** = tổng mọi giao dịch, không phân biệt `nature`
- **Lãi/lỗ công việc** = chỉ `operating` + `interest`, bỏ `financing`
- **Chi tiêu cá nhân** = giao dịch không thuộc công việc nào, tách thành khối riêng
- **Nợ**: gom theo người — "tổng đang nợ anh Nam", không chỉ theo từng khoản

### Giao diện

- Tab **Người** mới
- Tab **Nợ**: chọn người từ danh sách, ô nhập lãi, form trả nợ tách gốc/lãi
- Tab **Giao dịch**: hiện nhãn cho giao dịch sinh từ nợ, lọc theo `nature`
- Tab **Tổng quan**: tách "Kinh doanh theo công việc" và "Chi tiêu cá nhân"

---

## 5. Đã chốt

1. **Lãi vay** — chỉ áp dụng chiều `i_owe` (mình đi vay). **Không cho vay lấy lãi**:
   khoản `owes_me` mà nhập tiền lãi thì API trả lỗi.
2. **Khách ứng tiền trước** — không có nghiệp vụ này. Ghi nhận theo dòng tiền, nhận tiền
   là ghi doanh thu.
3. **Nhiều ví** — không tách. Một số dư duy nhất.
4. **Xoá khoản nợ** — không xoá. Trả hết gốc thì trạng thái tự chuyển `paid`. Chỉ cho xoá
   khi khoản nợ **chưa có lần trả nào** (trường hợp nhập nhầm).
5. **Dữ liệu cũ** — đã xoá sạch, tạo lại DB từ đầu.

### Trạng thái khoản nợ

Không lưu cột trạng thái — luôn tính lại từ số đã trả và hạn trả, nên không bao giờ
lệch với số tiền:

| Trạng thái | Điều kiện |
|---|---|
| `paid` | Đã trả hết gốc (`remaining ≤ 0`) |
| `overdue` | Còn nợ và đã quá `dueDate` |
| `active` | Còn nợ, chưa tới hạn |

---

## 6. Ngoại tệ

Có giao dịch phải thanh toán bằng $, nhưng sổ vẫn chỉ có **một số dư duy nhất tính bằng
VND**. Vì vậy mỗi giao dịch lưu 3 thứ:

| Trường | Ý nghĩa |
|---|---|
| `originalAmount` | Số tiền đúng như đã thanh toán, theo đơn vị nhỏ nhất (USD lưu theo **cent**) |
| `rate` | Tỷ giá 1 đơn vị ngoại tệ = ? VND, **chốt tại thời điểm ghi** |
| `amount` | Số VND đã quy đổi — **mọi báo cáo chỉ đọc trường này** |

Tỷ giá lấy tự động từ API (`open.er-api.com`, miễn phí, không cần key) theo đúng ngày
giao dịch, rồi **cache vào DB**. Lần sau ghi cùng ngày là không cần gọi mạng nữa.
Mất mạng thì lùi về tỷ giá gần nhất đã lưu và cảnh báo; vẫn sửa tay được nếu muốn
dùng tỷ giá ngân hàng.

Tỷ giá đã chốt thì **không đổi theo thời gian** — giao dịch cũ giữ nguyên số VND lúc
ghi, không bị tỷ giá hôm nay làm xê dịch báo cáo quá khứ.

Khoản nợ luôn ghi bằng VND (đã chốt ở mục 5), nên không có lãi/lỗ chênh lệch tỷ giá.

---

## 7. Vay ngân hàng / công ty tài chính

Ngoài vay mượn cá nhân, khoản nợ có thể là khoản vay có lịch trả. Chọn **loại vay**,
app tự gợi ý **cách tính lãi** thông dụng của loại đó — vẫn đổi được:

| Loại vay | Cách tính lãi gợi ý |
|---|---|
| Vay mượn cá nhân | Không tính lãi theo công thức |
| Vay tín chấp | Lãi phẳng trên gốc ban đầu |
| Vay thế chấp | Lãi trên dư nợ giảm dần |
| Vay thấu chi | Số tiền lãi cố định mỗi tháng |

### Bốn cách tính lãi

Ví dụ vay **120tr, 1%/tháng, 12 kỳ**:

| Cách tính | Lãi kỳ 1 | Lãi kỳ 12 | Tổng lãi | Đặc điểm |
|---|---:|---:|---:|---|
| Dư nợ giảm dần | 1.200.000 | 100.000 | 7.800.000 | Gốc chia đều, tiền trả giảm dần theo tháng |
| Lãi phẳng | 1.200.000 | 1.200.000 | 14.400.000 | Lãi tính trên gốc ban đầu, không đổi suốt kỳ |
| Trả góp đều (EMI) | 1.200.000 | ~106.000 | ~7.800.000 | Tổng trả mỗi tháng bằng nhau |
| Lãi cố định | số tiền bạn nhập | như trên | × số kỳ | Không cần lãi suất |
| Theo hợp đồng | suy ra từ số tiền trả | như trên | theo hợp đồng | Chép thẳng số của bên cho vay |

Cùng lãi suất 1%/tháng nhưng **lãi phẳng đắt gần gấp đôi** dư nợ giảm dần — đây chính
là chỗ hay bị nhầm khi so sánh các bên cho vay.

### Vì sao cần chế độ "theo hợp đồng"

Công thức chuẩn không tái tạo được số của mọi bên cho vay, vì mỗi bên có quy ước làm
tròn riêng. Ví dụ thật từ Shopee Pay: vay 17.000.000, 6 kỳ, 3,30%/tháng.

| | Công thức lãi phẳng | Sao kê Shopee |
|---|---:|---:|
| Trả kỳ 1–5 | 3.394.333 | 3.394.059 |
| Trả kỳ 6 | 3.394.335 | 3.420.905 |
| Tổng lãi | 3.366.000 | 3.391.200 |

Lệch 25.200 (0,7% tiền lãi). Con số của Shopee **không suy ra được** từ lãi suất 3,30%:
không phải lãi phẳng, cũng không phải EMI (EMI ở 3,3% chỉ ra ~3,17tr; muốn ra
3.394.059 thì lãi suất phải ~5,4%/tháng). Họ dồn phần lẻ vào kỳ cuối theo quy ước nội bộ.

> Lưu ý khi đọc sao kê: Shopee hiển thị `3.391.200` gạch ngang → `3.291.200`, tức là
> **được giảm 100.000**. So sánh với công thức phải lấy số gộp `3.391.200`.

Với vay tiêu dùng, **hợp đồng mới là chuẩn**. Chọn "Theo hợp đồng" rồi chép số tiền
phải trả mỗi kỳ (và kỳ cuối nếu lệch); app suy ngược tiền lãi = tiền trả − gốc, khớp
tuyệt đối với sao kê.

### Lịch trả nợ

App sinh sẵn từng kỳ: ngày đến hạn, dư nợ đầu kỳ, gốc, lãi, tổng phải trả. Phần lẻ do
làm tròn dồn vào kỳ cuối nên **tổng gốc các kỳ luôn đúng bằng gốc vay**.

Lịch chỉ để **đối chiếu** — app không tự tạo giao dịch. Tiền chỉ vào sổ khi bạn thực sự
bấm "Ghi trả", nên số dư luôn là tiền thật.

Đối chiếu tính theo **luỹ kế**, không khớp cứng từng kỳ, nên trả trước hay trả gộp
nhiều kỳ đều tính đúng:

| Tình trạng kỳ | Nghĩa |
|---|---|
| `paid` | Luỹ kế đã trả ≥ luỹ kế phải trả tới hết kỳ này |
| `partial` | Đã qua hạn, có trả nhưng chưa đủ |
| `late` | Đã qua hạn, chưa trả gì cho kỳ này |
| `upcoming` | Chưa tới hạn |

Thấu chi không có kỳ hạn: các kỳ chỉ trả lãi, gốc trả lúc nào tuỳ, app sinh các kỳ đã
qua cộng 2 kỳ tới.

Tổng hợp ở tab Tổng quan: kỳ tới phải trả bao nhiêu, đang thiếu bao nhiêu, tổng dư nợ
gốc và tổng lãi còn phải trả của tất cả khoản vay.

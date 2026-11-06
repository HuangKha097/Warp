<p align="center">
  <img src="assets/warp.png" width="72" height="72" alt="Warp">
</p>

<h1 align="center">Warp</h1>

<p align="center">Chuyển đổi tài liệu ngay trên Desktop và File Explorer.</p>

<p align="center">
  <a href="https://github.com/HuangKha097/Warp/releases/tag/v0.4.4"><strong>Tải cho Windows</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/HuangKha097/Warp/issues">Báo lỗi</a>
</p>

<p align="center">Windows x64 · Phiên bản thử nghiệm 0.4.4</p>

<p align="center">
  <img src="docs/assets/radial-menu.png" width="440" alt="Vòng tròn chọn định dạng của Warp">
</p>

Warp mở một vòng tròn định dạng quanh tệp đang chọn khi bạn giữ **Alt + Shift**. Kéo sang định dạng cần dùng để tạo bản chuyển đổi, ngay tại thư mục của tệp gốc.

- **Xử lý trên máy** — tài liệu không được tải lên dịch vụ đám mây.
- **Giữ nguyên bản gốc** — tạo tệp mới, tự thêm số khi tên đã tồn tại.
- **Sẵn sàng trong nền** — chạy từ khay hệ thống, có tiến trình và hàng đợi chuyển đổi.

## Cài đặt

Tải **Warp-Setup-0.4.4.exe** tại [Releases](https://github.com/HuangKha097/Warp/releases/tag/v0.4.4) và chạy bộ cài. Bộ chuyển đổi đã được tích hợp, không cần cài LibreOffice hoặc Microsoft Office riêng.

Nếu đang dùng Warp, chọn **Exit** từ biểu tượng khay trước khi cập nhật. Warp được đăng ký chạy khi đăng nhập Windows; bạn có thể tắt tùy chọn này trong **Startup Apps**.

## Sử dụng

1. Bấm một lần để chọn một tệp trên Desktop hoặc trong File Explorer.
2. Giữ **Alt + Shift** để hiện vòng tròn.
3. Nhấn giữ chuột trên tệp, kéo sang một định dạng đang bật rồi thả chuột.
4. Theo dõi tiến trình ở góc phải dưới. Khi hoàn tất, chọn **Mở thư mục** để xem kết quả.

Nhả Alt hoặc Shift trước khi xác nhận để hủy thao tác. Các tác vụ đã xác nhận tiếp tục chạy nền; bạn có thể chọn tệp khác để chuyển đổi tiếp. Nếu có lỗi, thông báo hiển thị lý do và tùy chọn **Thử lại** cho tác vụ chuyển đổi.

Bấm biểu tượng khay để xem lại tiến trình gần nhất. Bấm phải → **Exit** để thoát Warp.

## Định dạng hỗ trợ

Chỉ các định dạng tương thích với tệp đang chọn mới được bật.

| Tệp nguồn | Định dạng đầu ra |
| :--- | :--- |
| DOCX | PDF, TXT, ODT |
| DOC | PDF, TXT, DOCX |
| ODT, RTF | PDF, DOCX, TXT |
| TXT | PDF, DOCX, ODT |
| XLSX | PDF, CSV, ODS |
| XLS | PDF, CSV, XLSX |
| ODS | PDF, CSV, XLSX |
| CSV | PDF, XLSX, ODS |
| PPTX | PDF, ODP |
| PPT | PDF, PPTX, ODP |
| ODP | PDF, PPTX |

Hiện chưa hỗ trợ PDF đầu vào/OCR, nhiều tệp cùng lúc, thư mục, tài liệu có mật khẩu hoặc tệp đám mây chưa tải về máy. TXT/CSV có thể mất định dạng; bố cục đầu ra phụ thuộc font và tài liệu nguồn. Bộ cài hiện chưa ký mã. Alt + Shift có thể đồng thời đổi ngôn ngữ bàn phím theo thiết lập Windows.

## Kiến trúc

![Kiến trúc xử lý tài liệu cục bộ của Warp](docs/assets/architecture.svg)

React hiển thị vòng tròn và thông báo; Electron quản lý lựa chọn tệp, hàng đợi và bộ chuyển đổi cục bộ. Mỗi tác vụ dùng bản sao tạm và profile riêng. Ứng dụng không cần backend server hoặc database.

## Phát triển

Xem [hướng dẫn phát triển và build](docs/development.md) và [phạm vi kiểm thử](docs/testing.md).

## Giấy phép

Mã ứng dụng theo [MIT](LICENSE). Logo và các thành phần đi kèm được mô tả trong [thông tin giấy phép](THIRD-PARTY-NOTICES.md).

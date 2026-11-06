# Phát triển Warp

## Môi trường

Windows x64, Node.js 22.12+ hoặc bản LTS mới tương thích, npm và .NET Framework 4.x. CI sử dụng Node.js 24. Người dùng ứng dụng chỉ cần bộ cài Warp.

```powershell
npm ci
node node_modules/electron/install.js
npm run prepare:engine
npm start
```

`npm start` build rồi chạy ứng dụng trong khay hệ thống. Giữ Alt + Shift trên một tệp đã chọn trong Desktop/Explorer để mở vòng tròn.

## Build và đóng gói

```powershell
npm run check
npm run build
npm run package -- --publish never
```

Bộ cài NSIS được tạo trong `release/`. CI chạy kiểm tra và lưu bộ cài thành artifact **Warp-Windows**; xuất bản GitHub Release là bước riêng của người bảo trì. Chưa cấu hình cập nhật tự động.

`prepare:engine` là bước build: tải bản LibreOffice đã ghim phiên bản và SHA-256, giải nén vào `vendor/libreoffice`, rồi đóng gói cùng ứng dụng. Bước này không cài LibreOffice vào Windows hoặc thay đổi liên kết mở tệp. Giữ nguyên giấy phép trong runtime và [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md) khi phân phối lại.

## Cấu trúc mã nguồn

| Thư mục | Trách nhiệm |
| :--- | :--- |
| `src/` | Giao diện React: vòng tròn, hiệu ứng Dock và thông báo tiến trình |
| `electron/` | Main process, preload, contract IPC, trạng thái lựa chọn và hàng đợi |
| `native/` | Helper C# đọc phím và đường dẫn tệp từ Windows Shell; UI Automation cung cấp tọa độ icon |
| `scripts/` | Build helper/icon, chuẩn bị bộ chuyển đổi, kiểm tra native và cấu hình NSIS |
| `tests/` | Unit/integration test; harness Electron nằm trong `tests/electron/` |
| `docs/` | Hướng dẫn, phạm vi kiểm thử, hình minh họa và sơ đồ kiến trúc |
| `assets/` | Logo nguồn, PNG và ICO ứng dụng |

`ProgressCard.tsx` render chữ, nút, trạng thái và thời gian bằng React DOM. `progress.css` xử lý spinner, thanh loading và góc bo. Chỉ logo thương hiệu dùng ảnh; toàn bộ hộp thông báo không được dựng từ ảnh chụp hoặc canvas.

Cửa sổ thông báo dùng nền trong suốt, tắt native shadow và Windows thick frame. Màu nền chỉ được vẽ trên card bo góc để các góc ngoài luôn trong suốt.

## Kiểm thử

Xem [testing.md](testing.md) để chạy kiểm tra và phân biệt bằng chứng tự động với nghiệm thu Desktop thật. Đầu ra kiểm tra nằm trong `.cache/`; không commit các ảnh hoặc biên nhận phát sinh.

`node_modules/`, `vendor/`, `dist/`, `dist-electron/`, `release/`, `.cache/` và `.archify/` không được đưa vào Git. Hình công khai dùng trong README nằm trong `docs/assets/`.

## Chẩn đoán

- **Không thấy Warp:** kiểm tra khay biểu tượng ẩn `^`. Ứng dụng chỉ cho phép một phiên chạy.
- **Không đọc được tệp:** chọn đúng một tệp đã có trên ổ đĩa, nhả rồi giữ lại Alt + Shift. Kiểm tra thêm bố cục Explorer, tab và DPI theo danh sách nghiệm thu.
- **Không chuyển đổi được:** xem lý do trong thông báo, quyền ghi và dung lượng thư mục đích. Nếu thiếu engine tích hợp, cài lại bộ cài đầy đủ.

Log tại `%APPDATA%\Warp\runtime.log` ghi các mốc khởi động/helper/vòng tròn, không ghi tên tệp từ các sự kiện này. Khi báo lỗi, cung cấp phiên bản Warp, Windows, định dạng nguồn/đích và thông báo lỗi; tránh đính kèm tài liệu nhạy cảm.

# Chuyển Warp sang Tauri + React — 2026-11-12

## Thay đổi

- Bỏ Electron và electron-builder khỏi app/dependency/CI; giữ React và minh họa onboarding.
- Backend Rust thay phần main/preload: tray, single instance, cửa sổ trong suốt, bridge có giới hạn theo cửa sổ, hàng đợi và LibreOffice, settings và startup.
- Giữ schema `%APPDATA%\Warp\settings.json`, ngôn ngữ, mặc định lưu cạnh nguồn, thư mục tùy chọn theo từng job/retry và nguyên tắc không ghi đè.
- Giữ helper Windows Shell C#, thêm supervisor/watchdog bằng Rust.
- Cấu hình bộ cài Tauri NSIS với MIT consent, ngôn ngữ và thư mục cài; giữ notices của Tauri/LibreOffice.
- Loại thư mục Rust/engine/cache khỏi Vite watch để build backend không làm trang liên tục reload.

## Bằng chứng đã có

| Kiểm tra | Kết quả |
| --- | --- |
| TypeScript (`npm run check`) | PASS |
| Vite production + helper C# compilation (`npm run build`) | PASS |
| Frontend logic (`npm test`) | PASS, 7 tests |
| Rust core trên WSL Linux (`--no-default-features --lib`) | PASS, 7 tests |
| React thật trên Microsoft Edge (`npm run test:ui`) | PASS, 4 tests |
| Rustfmt | PASS |
| Cross-target `cargo check --target x86_64-pc-windows-msvc` | PASS; kiểm tra từ Linux, không chạy executable Windows |
| Cross-target `cargo check --all-features --all-targets` | PASS; gồm custom-protocol, smoke-test và engine integration test |

Rust core kiểm tra migration/settings lỗi, đầu ra không ghi đè ngay cả khi lưu đồng thời, giữ nguồn, hủy trước khi gọi converter, snapshot thư mục khi retry, thứ tự hàng đợi, gesture cũ và watchdog. UI test dùng fixture backend, kiểm tra kéo tâm vào PDF đúng một lần, đổi ngôn ngữ/thư mục/startup, onboarding ba bước/reduced motion và progress running/error/retry/success/reveal. Đã xem ảnh của vòng tròn và Settings trong `.cache/ui-*.png`.

## Giới hạn

Windows Application Control trả lỗi 4551 khi chạy build script Rust mới biên dịch và chặn `DesktopSelectionTests.exe`. Việc chạy ngoài sandbox cũng không giải quyết được chính sách này. Không thay đổi hoặc tắt Application Control. Unit test lõi được chạy trong Rust Linux/WSL; đây không phải bằng chứng nghiệm thu Windows.

Cross-target check dùng toolchain Rust Linux, Windows std và resource compiler Zig để biên dịch resources thật và kiểm tra mã cho Windows. Chỉ trong lần check này, `TAURI_CONFIG` tắt sao chép tài nguyên LibreOffice vào target để tránh tạo thêm bản sao engine; cấu hình bundle trong repository vẫn đóng gói engine đầy đủ. Cross-check không link hoặc chạy app, không thay thế bộ cài đã nghiệm thu.

`test:runtime` đã được chuyển sang app Tauri/WebView2 thật với feature smoke-test riêng; `test:engine` đã được chuyển sang Rust/LibreOffice thật. Chưa xác nhận hai suite này chạy thành công trên máy hiện tại. Chưa tạo/phát hành bộ cài Tauri đã nghiệm thu, chưa xác nhận install/uninstall sạch hay nâng cấp Electron → Tauri.

Chưa đo tổng RAM của Tauri + WebView2 + helper, độ trễ Alt + Shift, tốc độ chuyển tài liệu hoặc dung lượng bộ cài mới. LibreOffice vẫn được đóng gói đầy đủ. Không có kết luận định lượng về mức cải thiện hiệu năng/dung lượng.

Các toolchain và kết quả build kiểm tra nằm trong `.cache`, không phải thành phần phân phối cho người dùng. Bản Warp Electron đang cài trên máy không được thay thế trong lần sửa mã nguồn này.

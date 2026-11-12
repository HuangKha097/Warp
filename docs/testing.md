# Kiểm thử Warp Tauri

## Tự động

| Lệnh | Phạm vi |
| --- | --- |
| `npm run check` | TypeScript và contract frontend |
| `npm test` | Hit testing, bố trí vòng tròn ở cạnh/góc và animation spring |
| `npm run test:ui` | React thật trên Edge/Chromium với backend fixture: kéo chọn, Settings, onboarding và tiến trình |
| `npm run build` | Vite production và biên dịch helper C# |
| `npm run test:rust` | Settings, hàng đợi/retry, lưu không ghi đè, hủy và gesture/watchdog |
| `npm run test:native` | Windows Shell selection, giữ nguyên lựa chọn và phát hiện lỗi Desktop |
| `npm run test:engine` | LibreOffice thật: TXT → PDF vào thư mục Unicode, tránh trùng tên, giữ nguồn và TXT → DOCX |
| `npm run test:runtime` | App Tauri thật, WebView2/IPC, helper, onboarding, đổi ngôn ngữ/thư mục, overlay → conversion → progress |
| `npm run package` | Build release và NSIS đầy đủ |

`test:runtime` build feature `smoke-test` riêng, tạo hồ sơ/tệp trong `.cache/runtime-*`, chạy executable, kiểm tra report JSON và đóng app. Lệnh `smoke_step` và script tự điều khiển không được biên dịch vào bản release thông thường. Test không thay đổi startup hoặc hồ sơ thật. Có thể xem report ở thư mục được in ra khi chạy.

Lõi Rust có thể kiểm tra trên Linux bằng `cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --lib`. Kết quả này chỉ xác nhận logic dùng chung; không thay thế kiểm tra Windows/COM/WebView2. Cross-target `cargo check --target x86_64-pc-windows-msvc` kiểm tra kiểu và mã Windows; không chứng minh executable đã chạy.

## Nghiệm thu Windows thực tế

- Chọn đúng một tệp trong Desktop và Explorer; giữ Alt + Shift, kéo tâm rỗng vào định dạng rồi thả; bản gốc vẫn nguyên và đầu ra có nội dung đúng.
- Nhả một phím trước khi capture xong, nhấn nhanh nhiều lần, chuyển cửa sổ, đổi lựa chọn: không mở lại vòng tròn cũ.
- Nhả phím và xác nhận chuyển đổi phải ẩn toàn bộ cửa sổ trong suốt, không để lớp chắn chuột trên Explorer.
- Tab Explorer, icon lớn/nhỏ, nhiều màn hình, DPI 100/125/150/200%, màn hình có tọa độ âm, taskbar ở nhiều cạnh và icon sát góc.
- Một hàng đợi nhiều tệp; lỗi do tệp hỏng/quyền ghi; retry đúng thư mục cũ sau khi đổi Settings; Exit lúc đang chuyển đổi không để lại helper/LibreOffice.
- Tiến trình hiện đúng chữ/thời gian; góc ngoài card trong suốt; nút Ẩn/Mở thư mục/Thử lại; click tray mở lại thông báo đã ẩn.
- Onboarding chỉ lần đầu; ngôn ngữ cập nhật cả tray/ring/status; startup bật/tắt qua lần đăng nhập mới; đóng Settings giữ app trong tray.
- Bộ cài English/Vietnamese, ô đồng ý MIT chưa tick, link giấy phép, thư mục cài, không có Desktop shortcut, install/uninstall và nâng cấp từ Electron.
- Đo dung lượng cài đặt riêng app/engine, tổng working set của app + WebView2/helper khi rảnh và khi mở vòng tròn, CPU idle, thời gian từ Alt + Shift đến paint. Dùng cùng máy/tài liệu để so với Electron.

Không suy ra độ mượt, RAM hoặc chất lượng giữ bố cục tài liệu từ framework hay từ fixture nhỏ. Không công bố các số đo chưa thực hiện. Application Control chặn executable phải được ghi nhận là chưa chạy được, không tính thành test pass.

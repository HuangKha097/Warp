# Phát triển Warp 0.6 (Tauri + React)

## Môi trường Windows x64

- Node.js 22.12+ và npm; CI dùng Node.js 24.
- Rust stable với target `x86_64-pc-windows-msvc`.
- Visual Studio C++ Build Tools và Windows SDK.
- Microsoft Edge WebView2 Runtime.
- .NET Framework 4.x để build helper đọc Windows Shell.

```powershell
npm ci
npm run prepare:engine
npm start
```

`npm start` build icon/helper, mở Vite ở `127.0.0.1:1420`, rồi chạy app Tauri. Chỉ Vite phục vụ giao diện trong lúc phát triển; bản phát hành dùng tài nguyên đã nhúng, không chạy Node.js/server. Rust nằm trong `src-tauri/`, React trong `src/`, contract JSON trong `shared/contracts.ts`.

Rust cài theo cách thông thường được nhận từ PATH. Các wrapper `scripts/toolchain.cjs` cũng nhận toolchain riêng ở `.cache/cargo` và `.cache/rustup`; không cần thay đổi PATH của Windows.

## Build và kiểm tra

```powershell
npm run check
npm test
npm run build
npm run test:native
npm run test:rust
npm run test:engine
npm run test:runtime
npm run package
```

`build` chỉ build frontend và helper. `check:rust` kiểm tra backend; `tauri build --no-bundle` build app executable. `package` chuẩn bị LibreOffice đầy đủ, build bản release, rồi tạo NSIS ở `src-tauri/target/release/bundle/nsis/`. CI lưu artifact; khi đẩy tag `v<version>` trùng package.json và toàn bộ kiểm tra/build thành công, CI xuất bản prerelease GitHub với bộ cài và SHA-256. Ghi chú phát hành nằm ở `docs/releases/v<version>.md`. Không có auto-update.

`prepare:engine` tải đúng LibreOffice 26.8.2 đã ghim SHA-256, giải nén vào `vendor/libreoffice`, không cài vào Windows. Giữ nguyên giấy phép và notices của engine. Dung lượng engine độc lập với thay đổi Electron → Tauri; không có cơ chế tải engine theo nhu cầu trong bản này.

## Cấu trúc và hành vi

| Vị trí | Trách nhiệm |
| --- | --- |
| `src/` | React, animation, onboarding, Settings và bridge Tauri |
| `shared/contracts.ts` | Kiểu dữ liệu gửi giữa Rust và React |
| `src-tauri/src/app.rs` | Khởi động, cửa sổ, tray và single instance |
| `src-tauri/src/commands.rs` | API dành riêng cho từng cửa sổ |
| `src-tauri/src/runtime.rs` | Trạng thái app, DPI/monitor, trình chạy hàng đợi |
| `src-tauri/src/conversion.rs` | Gọi LibreOffice, snapshot, hủy/timeout, tạo bản sao không ghi đè |
| `src-tauri/src/preferences.rs` | JSON settings, xác thực, ghi thay thế nguyên tử |
| `src-tauri/src/watcher.rs` | Giao thức helper, gesture và watchdog tự phục hồi |
| `native/` | Helper C# đọc phím, Windows Shell và tọa độ UI Automation |
| `scripts/tauri-installer.nsi` | Mẫu NSIS Tauri có trang đồng ý MIT và không tạo shortcut Desktop |

Overlay/status dùng WebView2 trong suốt, không viền/shadow, không lấy focus, luôn ở trên. Helper gửi tọa độ vật lý; Rust đặt cửa sổ theo work area của monitor và đổi anchor sang logical pixel theo DPI. Renderer không chạy quy trình chuyển đổi. Khi xác nhận, Rust ẩn overlay trước khi enqueue; khi nhả phím, kết quả capture cũ không được mở lại vòng tròn.

Mỗi conversion chạy nối tiếp trên worker riêng, dùng bản sao nguồn và profile LibreOffice tạm. Timeout 120 giây; Exit dừng helper và cây tiến trình chuyển đổi. Đầu ra dùng `create_new` để tránh ghi đè kể cả khi nhiều bên lưu cùng lúc; file đích dở dang do lỗi sao chép được xóa. Mỗi job và retry giữ nguyên lựa chọn thư mục tại thời điểm enqueue.

Backend chỉ cho phép các cửa sổ phù hợp gọi lệnh; không có API frontend cho shell, đường dẫn hay URL tùy ý. CSP chỉ cho tài nguyên cục bộ và IPC. Thư mục và giấy phép được mở qua những lệnh giới hạn. Companion được tạo khi cần và hủy khi đóng để giải phóng WebView của Settings.

## Hồ sơ và chuyển từ Electron

Bản phát hành đọc cùng `%APPDATA%\Warp\settings.json`, giữ schema và các lựa chọn cũ. JSON lỗi được giữ thành `.invalid-*`. Startup vẫn dùng khóa HKCU Run `Warp`; mục đang bật được cập nhật sang executable Tauri khi khởi động. Không tự bật lại mục startup đã tắt khi nâng cấp.

Bản debug và smoke dùng `.cache/tauri-dev` hoặc `WARP_DATA_DIR`, không đăng ký startup. Có thể dùng `WARP_ENGINE_DIR` để chỉ runtime trong lúc phát triển; bản phát hành chỉ dùng engine resource và LibreOffice cài sẵn được phát hiện.

Trước khi cài bản Tauri, thoát Warp Electron từ tray và gỡ bản Electron cũ để không giữ hai app và hai bản engine trên ổ đĩa. Sao lưu `%APPDATA%\Warp\settings.json` nếu trình gỡ cài đặt có tùy chọn xóa dữ liệu. Cài/upgrade từ Electron và uninstallation phải được nghiệm thu trên Windows sạch trước khi phát hành rộng rãi.

Bộ cài chọn English/Vietnamese, trang MIT có ô đồng ý chưa tick và link GitHub, cho chọn thư mục cài, có Start Menu shortcut, không có Desktop shortcut. Nếu thiếu WebView2, bootstrapper cần Internet. Giữ `scripts/TAURI-LICENSE-MIT` khi chỉnh sửa/phân phối mẫu NSIS.

## Chẩn đoán

Log tại `%APPDATA%\Warp\runtime.log` trong release, hoặc thư mục dữ liệu debug, ghi các mốc khởi động/helper/vòng tròn; không ghi đường dẫn tệp của người dùng. Application Control có thể chặn build script, helper hoặc executable mới chưa ký. Không tắt chính sách bảo mật; dùng môi trường build cho phép các chương trình phát triển chạy.

Xem [testing.md](testing.md) và [biên bản chuyển đổi](validation/2026-11-12-tauri-migration.md) để biết bằng chứng đã có và phần cần nghiệm thu.

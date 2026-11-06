# Phạm vi kiểm thử Warp

Các kiểm tra tự động giúp phát hiện hồi quy; chúng không thay thế nghiệm thu phím và chuột thật trên Desktop/Explorer.

## Chạy kiểm tra

```powershell
npm ci
node node_modules/electron/install.js
npm run check
npm test
npm run prepare:engine
npm run test:engine
npm run build
npm run test:visual
npm run test:runtime
```

| Lớp kiểm tra | Phạm vi |
| --- | --- |
| TypeScript | Renderer, Electron và contract IPC; chặn biến/import/tham số không dùng |
| Unit | Đích chuyển đổi tương thích; đầu ra không ghi đè; giữ/nhả phím; lựa chọn đến trễ; xếp hàng, lỗi/retry, hủy khi thoát; vùng thả; spring; phục hồi helper |
| Engine | Bộ chuyển đổi đã đóng gói được ưu tiên, tạo PDF/đích hỗ trợ và giữ nguyên đầu vào |
| Renderer Electron | Tâm không có icon/nhãn vẽ lại, alpha tối đa 2/255; bốn góc và bốn mép trên hai kích thước vùng làm việc: tệp gốc rõ, múi nguyên vẹn, nhãn không tràn, ngoài viền không có pixel bóng hình chữ nhật; kéo từ tệp ở góc vẫn chuyển PDF đúng một lần; chặn đích sai; hover/spring/reduced motion; bảng tiến trình và các nút thao tác |
| Runtime Electron | Main/preload/renderer thật và bộ chuyển đổi thật; cửa sổ tắt shadow/khung Windows, overlay dùng work area và tọa độ tương ứng; startup không mở menu; xác nhận chuyển đổi đóng overlay; tệp thứ hai được chọn và xếp hàng khi tệp đầu đang chạy; lỗi không khóa phím tắt; tệp sau chuyển thành công; reset helper và Exit |

Harness runtime thay thế nguồn sự kiện bàn phím/Explorer và cách trình bày cửa sổ/khay. Nó không thao tác Desktop của người phát triển và không đăng ký startup trên máy khi chạy kiểm tra. Renderer dùng nền Desktop giả lập để chụp ảnh minh họa.

Các biên nhận nằm trong `.cache/engine-check.json`, `.cache/visual-check.json` và `.cache/runtime-check.json`. Ảnh renderer nằm trong `.cache/visual-smoke/previews/`. Chạy lại kiểm tra sẽ cập nhật các đầu ra này; chúng không được commit.

## Cần nghiệm thu thủ công

- Chọn tệp trên Desktop/Explorer, giữ Alt + Shift, kéo sang đích, nhả phím để hủy; lặp lại với tệp khác sau thành công và sau lỗi.
- Nhiều màn hình, DPI khác nhau, Explorer có nhiều tab và tệp nằm sát các mép màn hình.
- Cài/gỡ trên Windows sạch, đăng nhập lại để kiểm tra tự khởi động và mục HKCU Run; macro installer được kiểm tra khi đóng gói, chưa được nghiệm thu bằng reboot máy sạch.
- Tài liệu phức tạp, font thiếu, bảng biểu và bản trình chiếu thực tế. Không suy ra độ chính xác mọi tài liệu từ fixture nhỏ.

## Tài liệu kiến trúc

`architecture.json` là nguồn Archify; `architecture.html` là bản xem tương tác, còn `assets/architecture.svg` là hình tĩnh cho README. Sơ đồ dẫn tới code ở revision đã ghim trong `meta.repository`, thay vì dẫn tới dòng có thể thay đổi trên `main`.

Khi thay đổi kiến trúc, cập nhật các trích dẫn và chạy lại Archify `finalize architecture` với `--repo-root` và `--quality showcase` trước khi xuất SVG. Biên nhận Archify và candidate làm việc được giữ trong `.archify/`; không commit đường dẫn tuyệt đối hoặc biên nhận riêng của máy vào tài liệu công khai.

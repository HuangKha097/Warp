# Kiểm tra Warp 0.4.0

## Đã đạt

- TypeScript, React/Electron build và helper C# Windows đã biên dịch thành công.
- 18 unit test: bảo toàn file và tên trùng; engine tích hợp; spring; trạng thái giữ/nhả phím; vùng thả; tách file đang chọn khỏi tác vụ đang chạy; xếp hàng tệp kế tiếp; phục hồi sau lỗi và retry; chặn yêu cầu trùng; Exit hủy tác vụ; kết quả chọn file đến trễ; helper chết được tự khởi động lại.
- Runtime regression harness chạy **main/preload/renderer thật và bộ chuyển đổi đi kèm thật**: startup không gọi mở cửa sổ; menu khay chỉ có Exit; xác nhận convert đóng overlay; tệp B mở vòng tròn và được xếp hàng khi A còn chuyển; cả hai PDF được tạo; xóa tệp nguồn gây lỗi hiển thị rõ; khôi phục tệp rồi chuyển lại thành công; reset helper rồi giữ phím lượt mới vẫn gọi được vòng tròn; Exit gọi dừng helper và thoát.
- Harness thay thế nguồn sự kiện bàn phím/Explorer và trình bày cửa sổ/khay để không thao tác Desktop hoặc thay đổi startup trên máy phát triển. Nó không thay thế thử nghiệm phím vật lý hoàn toàn.
- Renderer: hover Dock, hồi spring, kéo PDF, chặn múi không phù hợp, reduced motion; bảng loading không giả phần trăm; thành công có Mở thư mục; lỗi có lý do và Retry; ảnh popup 370×228 vừa khung và đã được quan sát.
- Macro NSIS startup/uninstall đã được compiler kiểm tra riêng; bản cài ghi lệnh Warp --background vào HKCU Run và gỡ mục này khi uninstall. Không chạy macro đăng ký startup trên máy phát triển.
- Giữ nguyên bộ chuyển đổi, logo mới và các giấy phép đi kèm từ bản trước. Việc chuyển đổi luôn dùng bản sao tạm và tạo đầu ra mới.

## Phần chưa nghiệm thu đầy đủ

- Chuỗi phím vật lý Alt + Shift và chuột thật trên mọi bố cục Desktop/Explorer, đặc biệt tab Explorer, nhiều màn hình và DPI khác nhau.
- Cài/gỡ trên Windows sạch và đăng nhập lại Windows để quan sát autostart thực tế. Đã biên dịch/cấu hình installer; không khẳng định đã thử reboot máy người dùng.
- Độ chính xác bố cục tài liệu phức tạp, font thiếu, mật khẩu và fixture trình chiếu.
- Bản cài chưa ký mã.

Hướng dẫn: HUONG-DAN.md. Runtime và giấy phép: THIRD-PARTY-NOTICES.md.

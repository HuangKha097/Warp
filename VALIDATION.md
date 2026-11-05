# Kiểm tra Warp 0.3.0

## Thay đổi và kiểm tra trong bản này

- TypeScript và build React/Electron/C# đều đạt.
- 13 unit test đạt: bảo toàn file/tên trùng, engine tích hợp, giữ/nhả phím, hit testing hình vành khăn, cùng độ giảm phóng đại theo khoảng cách, spring hội tụ về trạng thái nghỉ và ổn định sau khi cửa sổ tạm dừng.
- Kiểm tra renderer Electron đạt: 6 múi liền nhau; icon PDF phóng theo chuột; icon lân cận phản ứng; icon bị vô hiệu hóa không phóng; rời chuột trở về tỷ lệ 1; kéo PDF gửi đúng một yêu cầu; thả vào Word không áp dụng không gửi yêu cầu; reduced motion không phóng.
- Đã quan sát ảnh render của vòng tròn khi nghỉ, khi hover, cửa sổ 620×670 và cửa sổ gọn 390×720. Footer nằm trong cửa sổ, không tràn ngang ở cỡ gọn, logo có ảnh nguồn 256 px đúng.
- Rà component theo react-best-practices: bộ menu dùng chung; physics/ghost dùng ref và cập nhật DOM thay vì render mỗi frame; RAF dừng khi spring nghỉ; listener/RAF/animation được dọn; vùng thả không thay đổi khi icon phóng; có focus/Enter/Space cho múi khả dụng và tuân theo giảm chuyển động.
- Bản logo gốc trong assets khớp SHA-256 với ảnh cắt mới do người dùng cung cấp; script tạo ICO 16/24/32/48/64/128/256. Icon dùng cho favicon, khay, cửa sổ và executable.

## Bằng chứng engine giữ từ 0.2.0

Bộ chuyển đổi và logic chuyển đổi không thay đổi trong bản 0.3.0. Ở 0.2.0 đã chuyển thật TXT → DOCX → PDF, DOCX → TXT giữ tiếng Việt, CSV → XLSX → PDF; hash file gốc không đổi và PDF có sẵn không bị ghi đè. Engine trong tài nguyên bản đóng gói cũng đã chuyển TXT → PDF. Engine vẫn đi kèm bản cài, người dùng không phải cài LibreOffice riêng.

## Phần chưa nghiệm thu đầy đủ

- Giữ Alt + Shift → kéo → nhả phím với lớp mới trên Desktop thật; test renderer và state machine không thay thế kiểm tra input Windows toàn tuyến.
- Mọi bố cục/tab Explorer, DPI/màn hình khác nhau và bộ cài trên Windows sạch.
- Độ chính xác bố cục của tài liệu phức tạp, font thiếu, nội dung có mật khẩu và fixture trình chiếu.
- Bản cài chưa ký mã, chưa publish GitHub Release.

Runtime và giấy phép: THIRD-PARTY-NOTICES.md. Hướng dẫn: HUONG-DAN.md.

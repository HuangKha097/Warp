import type {Language} from '../shared/contracts';

const english:Record<string,string>={
  'Không có quyền đọc tệp hoặc ghi bản chuyển đổi vào thư mục này.':'You do not have permission to read the file or write to this folder.',
  'Windows đang chặn truy cập tệp hoặc thư mục đầu ra.':'Windows is blocking access to the file or output folder.',
  'Không tìm thấy tệp nguồn. Tệp có thể đã bị di chuyển hoặc xóa.':'The source file was not found. It may have been moved or deleted.',
  'Ổ đĩa không đủ dung lượng để tạo bản chuyển đổi.':'There is not enough disk space to save the converted file.',
  'Thiếu bộ chuyển đổi tích hợp. Hãy cài lại bản Warp đầy đủ.':'The bundled converter is missing. Reinstall the full version of Warp.',
  'Có quá nhiều file trùng tên.':'Too many files already use this name.',
  'Không thể truy cập thư mục lưu đã chọn. Hãy chọn lại trong Cài đặt.':'Cannot access the chosen output folder. Select it again in Settings.',
  'Định dạng chuyển đổi không được hỗ trợ.':'This conversion format is not supported.',
  'Vui lòng chọn một file.':'Select one file.',
  'Đã hủy chuyển đổi khi thoát Warp.':'Conversion was cancelled when Warp exited.',
  'Chuyển đổi quá 2 phút. Hãy thử file nhỏ hơn.':'Conversion took longer than 2 minutes. Try a smaller file.',
  'Bộ chuyển đổi không tạo được file. File có thể bị khóa, hỏng hoặc có mật khẩu.':'No converted file was produced. The document may be locked, damaged or password-protected.',
  'Không đọc được tệp đang chọn. Hãy chọn lại tệp rồi giữ Alt + Shift.':'Could not read the selected file. Select it again, then hold Alt + Shift.',
  'Vui lòng chọn một tệp có trên ổ đĩa.':'Select a file that is available on this device.',
  'Không đọc được cửa sổ Desktop. Hãy chọn lại tệp rồi giữ Alt + Shift.':'Could not read the Desktop window. Select the file again and hold Alt + Shift.',
  'Vui lòng chọn đúng một file trên Desktop.':'Select exactly one file on the Desktop.',
  'Chỉ hỗ trợ tệp đã có trên ổ đĩa, không phải thư mục hoặc biểu tượng hệ thống.':'Select a local file. Folders and system icons are not supported.',
  'Không đọc được lựa chọn. Hãy chọn lại tệp rồi giữ Alt + Shift.':'Could not read the selection. Select the file again and hold Alt + Shift.',
  'Biểu tượng file không nằm trong vùng đang hiển thị.':'The file icon is outside the visible area.',
  'Hãy chọn file trong File Explorer hoặc Desktop trước.':'First select a file in File Explorer or on the Desktop.',
  'Vui lòng chọn đúng một file đang hiển thị.':'Select exactly one visible file.',
  'Vui lòng chọn đúng một file.':'Select exactly one file.',
  'Chỉ hỗ trợ file đã có trên ổ đĩa.':'Only files available on this device are supported.',
  'Không lấy được file từ cửa sổ Explorer này. Hãy chọn lại tệp rồi thử lại.':'Could not read the file from this Explorer window. Select it again and retry.',
  'Lựa chọn đã thay đổi. Hãy giữ lại Alt + Shift.':'The selection changed. Hold Alt + Shift again.',
  'Chuyển đổi không thành công.':'Conversion failed.'
};
export function errorText(message:string|undefined,language:Language):string {
  if(!message)return '';
  if(language==='vi')return message;
  return english[message]??message.replace(/^Không thể chuyển đổi tài liệu \(([^)]+)\)\./,'Could not convert the document ($1).');
}

using System;
using System.IO;
using System.Runtime.InteropServices;

// Ask the active Desktop Shell view for the selected item's identity. Display
// names are not paths: report.docx and report.pdf can both be shown as "report".
internal static class DesktopSelection {
  internal static void Release(object value) {
    if(value!=null&&Marshal.IsComObject(value))Marshal.ReleaseComObject(value);
  }

  internal static string Read() {
    object windows=null,desktop=null,browser=null,view=null,folderView=null;
    try {
      windows=Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("9BA05972-F6A8-11CF-A442-00A0C90A8F39")));
      object location=0,root=null;int hwnd;
      desktop=((IShellWindows)windows).FindWindowSW(ref location,ref root,8,out hwnd,1);
      if(desktop==null)throw new InvalidOperationException("Không đọc được cửa sổ Desktop. Hãy chọn lại tệp rồi giữ Alt + Shift.");
      var service=new Guid("4C96BE40-915C-11CF-99D3-00AA004AE837");
      var browserId=typeof(IShellBrowser).GUID;
      browser=((IShellServiceProvider)desktop).QueryService(ref service,ref browserId);
      view=((IShellBrowser)browser).QueryActiveShellView();
      var dispatch=new Guid("00020400-0000-0000-C000-000000000046");
      folderView=((IShellView)view).GetItemObject(0,ref dispatch);
      return ReadFromView(folderView);
    } finally {
      Release(folderView);Release(view);Release(browser);Release(desktop);Release(windows);
    }
  }

  internal static string ReadFromView(object folderView) {
    object items=null,item=null;
    try {
      items=((dynamic)folderView).SelectedItems();
      int count=((dynamic)items).Count;
      if(count!=1)throw new DesktopSelectionException("Vui lòng chọn đúng một file trên Desktop.");
      item=((dynamic)items).Item(0);
      string file=((dynamic)item).Path;
      if(String.IsNullOrEmpty(file)||!Path.IsPathRooted(file)||!File.Exists(file))throw new DesktopSelectionException("Chỉ hỗ trợ tệp đã có trên ổ đĩa, không phải thư mục hoặc biểu tượng hệ thống.");
      return file;
    } finally { Release(item);Release(items); }
  }

  [ComImport,Guid("85CB6900-4D95-11CF-960C-0080C7F4EE85"),InterfaceType(ComInterfaceType.InterfaceIsIDispatch)]
  interface IShellWindows {
    [return:MarshalAs(UnmanagedType.IDispatch)]
    object FindWindowSW([MarshalAs(UnmanagedType.Struct)]ref object location,[MarshalAs(UnmanagedType.Struct)]ref object root,int kind,out int hwnd,int options);
  }

  [ComImport,Guid("6D5140C1-7436-11CE-8034-00AA006009FA"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellServiceProvider {
    [return:MarshalAs(UnmanagedType.Interface)]object QueryService(ref Guid service,ref Guid iid);
  }

  // Only the called methods are projected. Reserved slots preserve the native
  // vtable order (including IOleWindow); they must never be invoked.
  [ComImport,Guid("000214E2-0000-0000-C000-000000000046"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellBrowser {
    void Reserved01();void Reserved02();void Reserved03();void Reserved04();
    void Reserved05();void Reserved06();void Reserved07();void Reserved08();
    void Reserved09();void Reserved10();void Reserved11();void Reserved12();
    [return:MarshalAs(UnmanagedType.Interface)]IShellView QueryActiveShellView();
  }

  [ComImport,Guid("000214E3-0000-0000-C000-000000000046"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellView {
    void Reserved01();void Reserved02();void Reserved03();void Reserved04();
    void Reserved05();void Reserved06();void Reserved07();void Reserved08();
    void Reserved09();void Reserved10();void Reserved11();void Reserved12();
    [return:MarshalAs(UnmanagedType.Interface)]object GetItemObject(uint scope,ref Guid iid);
  }
}

internal sealed class DesktopSelectionException:InvalidOperationException {
  internal DesktopSelectionException(string message):base(message){}
}

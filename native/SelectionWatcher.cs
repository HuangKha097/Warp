using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using System.Windows.Automation;

// Captures Explorer selection BEFORE Electron activates its overlay.
class SelectionWatcher {
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder text,int max);
  static string Json(string value) {
    var b=new StringBuilder("\"");
    foreach(char c in value) { if(c=='"'||c=='\\')b.Append('\\').Append(c);else if(c<32)b.Append("\\u"+((int)c).ToString("x4"));else b.Append(c); }
    return b.Append('"').ToString();
  }
  static void Error(string value){Console.WriteLine("{\"error\":"+Json(value)+"}");}
  static List<AutomationElement> SelectedElements(IntPtr hwnd){
    var root=AutomationElement.FromHandle(hwnd);
    var nodes=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.ListItem));
    var selected=new List<AutomationElement>();
    foreach(AutomationElement node in nodes){object pattern;if(node.TryGetCurrentPattern(SelectionItemPattern.Pattern,out pattern)&&((SelectionItemPattern)pattern).Current.IsSelected)selected.Add(node);}
    return selected;
  }
  static void Emit(string file,AutomationElement node,int gesture){
    var rect=node.Current.BoundingRectangle;
    if(rect.IsEmpty||node.Current.IsOffscreen){Error("Biểu tượng file không nằm trong vùng đang hiển thị.");return;}
    double x=rect.Left+(rect.Width>180?18:rect.Width/2),y=rect.Top+Math.Min(rect.Height/2,28);
    Console.WriteLine("{\"file\":"+Json(file)+",\"x\":"+((int)x)+",\"y\":"+((int)y)+",\"gesture\":"+gesture+"}");
  }
  static void Capture(int gesture){
    IntPtr hwnd=GetForegroundWindow();
    var cls=new StringBuilder(256);GetClassName(hwnd,cls,256);
    bool desktop=cls.ToString()=="Progman"||cls.ToString()=="WorkerW";
    if(!desktop && cls.ToString()!="CabinetWClass") {Error("Hãy chọn file trong File Explorer hoặc Desktop trước.");return;}
    object shellObject=null, windowsObject=null;
    try{
      shellObject=Activator.CreateInstance(Type.GetTypeFromProgID("Shell.Application"));
      dynamic shell=shellObject;windowsObject=shell.Windows();dynamic windows=windowsObject;
      var selectedNodes=SelectedElements(hwnd);
      if(selectedNodes.Count!=1){Error("Vui lòng chọn đúng một file đang hiển thị.");return;}
      if(!desktop){
        foreach(dynamic window in windows){
          try{
            if(new IntPtr((long)window.HWND)!=hwnd)continue;
            dynamic items=window.Document.SelectedItems();
            if(items.Count!=1){Error("Vui lòng chọn đúng một file.");return;}
            string file=items.Item(0).Path;
            if(!File.Exists(file)){Error("Chỉ hỗ trợ file đã có trên ổ đĩa.");return;}
            string label=selectedNodes[0].Current.Name;
            if(!String.Equals(label,Path.GetFileName(file),StringComparison.OrdinalIgnoreCase)&&!String.Equals(label,Path.GetFileNameWithoutExtension(file),StringComparison.OrdinalIgnoreCase))continue;
            Emit(file,selectedNodes[0],gesture);return;
          }finally{if(Marshal.IsComObject(window))Marshal.ReleaseComObject(window);}
        }
        Error("Không lấy được file từ cửa sổ Explorer này. Bạn có thể dùng nút Chọn file.");return;
      }
      // Desktop labels can omit extensions. Resolve only an unambiguous real file.
      string desktopLabel=selectedNodes[0].Current.Name;
      var matches=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      foreach(string dir in new[]{Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory)}){
        if(!Directory.Exists(dir))continue;
        foreach(string file in Directory.GetFiles(dir)) if(String.Equals(Path.GetFileName(file),desktopLabel,StringComparison.OrdinalIgnoreCase)||String.Equals(Path.GetFileNameWithoutExtension(file),desktopLabel,StringComparison.OrdinalIgnoreCase))matches.Add(file);
      }
      if(matches.Count!=1){Error("Không xác định được file Desktop. Hãy mở thư mục Desktop trong Explorer hoặc dùng Chọn file.");return;}
      foreach(string file in matches)Emit(file,selectedNodes[0],gesture);
    }catch{Error("Không đọc được lựa chọn. Hãy thử Chọn file trong Warp.");}
    finally{if(windowsObject!=null&&Marshal.IsComObject(windowsObject))Marshal.ReleaseComObject(windowsObject);if(shellObject!=null&&Marshal.IsComObject(shellObject))Marshal.ReleaseComObject(shellObject);}
  }
  [STAThread] static void Main(string[] args){
    try{SetProcessDpiAwarenessContext(new IntPtr(-4));}catch{}
    Console.OutputEncoding=new UTF8Encoding(false);Console.WriteLine("{\"ready\":true}");
    bool previous=false;int ticks=0;int sequence=0;int parent=0;if(args.Length>0)int.TryParse(args[0],out parent);
    while(true){
      if(parent>0&&ticks++%25==0){try{if(System.Diagnostics.Process.GetProcessById(parent).HasExited)return;}catch{return;}}
      bool pressed=(GetAsyncKeyState(0x12)&0x8000)!=0&&(GetAsyncKeyState(0x10)&0x8000)!=0;
      if(pressed&&!previous){int gesture=++sequence;Console.WriteLine("{\"held\":true,\"gesture\":"+gesture+"}");var thread=new Thread(()=>Capture(gesture));thread.IsBackground=true;thread.SetApartmentState(ApartmentState.STA);thread.Start();}
      if(!pressed&&previous)Console.WriteLine("{\"released\":true}");
      previous=pressed;Thread.Sleep(20);
    }
  }
}

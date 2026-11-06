using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using System.Windows.Automation;

// Captures Explorer selection BEFORE Electron activates its overlay.
class SelectionWatcher {
  sealed class Request {public int Gesture;public IntPtr Window;}
  static readonly AutoResetEvent captureReady=new AutoResetEvent(false);
  static Request pending;
  static void Release(object value){try{if(value!=null&&Marshal.IsComObject(value))Marshal.ReleaseComObject(value);}catch{}}
  static void CaptureLoop(){
    while(true){captureReady.WaitOne();var request=Interlocked.Exchange(ref pending,null);if(request==null)continue;
      try{Capture(request.Gesture,request.Window);}catch{Error("Không đọc được lựa chọn. Hãy chọn lại tệp rồi giữ Alt + Shift.",request.Gesture);}
    }
  }
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder text,int max);
  static string Json(string value) {
    var b=new StringBuilder("\"");
    foreach(char c in value) { if(c=='"'||c=='\\')b.Append('\\').Append(c);else if(c<32)b.Append("\\u"+((int)c).ToString("x4"));else b.Append(c); }
    return b.Append('"').ToString();
  }
  static void Error(string value,int gesture){Console.WriteLine("{\"error\":"+Json(value)+",\"gesture\":"+gesture+"}");}
  static List<AutomationElement> SelectedElements(IntPtr hwnd){
    var root=AutomationElement.FromHandle(hwnd);
    var nodes=root.FindAll(TreeScope.Descendants,new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.ListItem));
    var selected=new List<AutomationElement>();
    foreach(AutomationElement node in nodes){object pattern;if(node.TryGetCurrentPattern(SelectionItemPattern.Pattern,out pattern)&&((SelectionItemPattern)pattern).Current.IsSelected)selected.Add(node);}
    return selected;
  }
  static void Emit(string file,AutomationElement node,int gesture){
    var rect=node.Current.BoundingRectangle;
    if(rect.IsEmpty||node.Current.IsOffscreen){Error("Biểu tượng file không nằm trong vùng đang hiển thị.",gesture);return;}
    double x=rect.Left+(rect.Width>180?18:rect.Width/2),y=rect.Top+Math.Min(rect.Height/2,28);
    Console.WriteLine("{\"file\":"+Json(file)+",\"x\":"+((int)x)+",\"y\":"+((int)y)+",\"gesture\":"+gesture+"}");
  }
  static void Capture(int gesture,IntPtr hwnd){
    var cls=new StringBuilder(256);GetClassName(hwnd,cls,256);
    bool desktop=cls.ToString()=="Progman"||cls.ToString()=="WorkerW";
    if(!desktop && cls.ToString()!="CabinetWClass") {Error("Hãy chọn file trong File Explorer hoặc Desktop trước.",gesture);return;}
    object shellObject=null, windowsObject=null;
    try{
      shellObject=Activator.CreateInstance(Type.GetTypeFromProgID("Shell.Application"));
      dynamic shell=shellObject;windowsObject=shell.Windows();dynamic windows=windowsObject;
      var selectedNodes=SelectedElements(hwnd);
      if(selectedNodes.Count!=1){Error("Vui lòng chọn đúng một file đang hiển thị.",gesture);return;}
      if(!desktop){
        foreach(dynamic window in windows){
          object documentObject=null,itemsObject=null,itemObject=null;
          try{
            if(new IntPtr((long)window.HWND)!=hwnd)continue;
            documentObject=window.Document;itemsObject=((dynamic)documentObject).SelectedItems();dynamic items=itemsObject;
            if(items.Count!=1){Error("Vui lòng chọn đúng một file.",gesture);return;}
            itemObject=items.Item(0);string file=((dynamic)itemObject).Path;
            if(!File.Exists(file)){Error("Chỉ hỗ trợ file đã có trên ổ đĩa.",gesture);return;}
            string label=selectedNodes[0].Current.Name;
            if(!String.Equals(label,Path.GetFileName(file),StringComparison.OrdinalIgnoreCase)&&!String.Equals(label,Path.GetFileNameWithoutExtension(file),StringComparison.OrdinalIgnoreCase))continue;
            Emit(file,selectedNodes[0],gesture);return;
          }finally{Release(itemObject);Release(itemsObject);Release(documentObject);Release(window);}
        }
        Error("Không lấy được file từ cửa sổ Explorer này. Hãy chọn lại tệp rồi thử lại.",gesture);return;
      }
      string desktopFile=DesktopSelection.Read();
      // UI Automation supplies geometry only. Recheck the element after the
      // Shell query so a changed selection cannot anchor the file to an old icon.
      object selectionPattern;
      if(!selectedNodes[0].TryGetCurrentPattern(SelectionItemPattern.Pattern,out selectionPattern)||!((SelectionItemPattern)selectionPattern).Current.IsSelected){Error("Lựa chọn đã thay đổi. Hãy giữ lại Alt + Shift.",gesture);return;}
      Emit(desktopFile,selectedNodes[0],gesture);
    }catch(DesktopSelectionException error){Error(error.Message,gesture);}
    catch{Error("Không đọc được lựa chọn. Hãy chọn lại tệp rồi giữ Alt + Shift.",gesture);}
    finally{Release(windowsObject);Release(shellObject);}
  }
  [STAThread] static void Main(string[] args){
    try{SetProcessDpiAwarenessContext(new IntPtr(-4));}catch{}
    Console.OutputEncoding=new UTF8Encoding(false);Console.WriteLine("{\"ready\":true}");
    var worker=new Thread(CaptureLoop);worker.IsBackground=true;worker.SetApartmentState(ApartmentState.STA);worker.Start();
    bool previous=false;int ticks=0;int sequence=0;int parent=0;if(args.Length>0)int.TryParse(args[0],out parent);
    while(true){
      if(ticks++%50==0){Console.WriteLine("{\"heartbeat\":true}");if(parent>0){try{using(var process=System.Diagnostics.Process.GetProcessById(parent)){if(process.HasExited)return;}}catch{return;}}}
      bool pressed=(GetAsyncKeyState(0x12)&0x8000)!=0&&(GetAsyncKeyState(0x10)&0x8000)!=0;
      if(pressed&&!previous){int gesture=++sequence;var request=new Request{Gesture=gesture,Window=GetForegroundWindow()};Console.WriteLine("{\"held\":true,\"gesture\":"+gesture+"}");Interlocked.Exchange(ref pending,request);captureReady.Set();}
      if(!pressed&&previous)Console.WriteLine("{\"released\":true}");
      previous=pressed;Thread.Sleep(20);
    }
  }
}

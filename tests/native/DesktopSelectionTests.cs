using System;
using System.IO;
using System.Text;

public class FixtureItem {
  public string Path {get;set;}
  public string Name {get;set;}
}
public class FixtureItems {
  public FixtureItem[] Values;
  public int Count {get{return Values.Length;}}
  public FixtureItem Item(int index){return Values[index];}
}
public class FixtureView {
  public FixtureItems Selection;
  public FixtureItems SelectedItems(){return Selection;}
  public void Select(string file){Selection=new FixtureItems{Values=new[]{new FixtureItem{Path=file,Name=System.IO.Path.GetFileNameWithoutExtension(file)}}};}
}
class DesktopSelectionTests {
  static void Equal(string expected,string actual){if(expected!=actual)throw new Exception("Selected identity differs from expected fixture.");}
  static void Reject(FixtureView view){try{DesktopSelection.ReadFromView(view);}catch(DesktopSelectionException){return;}throw new Exception("Invalid selection was accepted.");}
  [STAThread] static int Main(string[] args){
    Console.OutputEncoding=new UTF8Encoding(false);
    if(args.Length>0&&args[0]=="--probe"){
      try{
        string file=null;
        for(int i=0;i<5;i++)file=DesktopSelection.Read();
        int siblings=0;string stem=System.IO.Path.GetFileNameWithoutExtension(file);
        foreach(string candidate in Directory.EnumerateFiles(System.IO.Path.GetDirectoryName(file)))if(String.Equals(System.IO.Path.GetFileNameWithoutExtension(candidate),stem,StringComparison.OrdinalIgnoreCase))siblings++;
        Console.WriteLine("PASS: live Desktop Shell selected-item path read five times; same-stem files in its folder: "+siblings+". No filenames logged.");return 0;
      }
      catch(DesktopSelectionException){Console.WriteLine("PASS: live Desktop Shell view is readable; current selection is empty, multiple or not a local file.");return 0;}
      catch(Exception error){Console.Error.WriteLine("Live Desktop Shell probe failed: "+error.GetType().Name+" "+error.Message);return 1;}
    }
    string root=System.IO.Path.GetFullPath(args[0]);Directory.CreateDirectory(root);
    var view=new FixtureView();
    string doc=System.IO.Path.Combine(root,"Báo cáo.docx"),pdf=System.IO.Path.Combine(root,"Báo cáo.pdf");
    string next=System.IO.Path.Combine(root,"Tệp tiếp theo.docx");
    File.WriteAllText(doc,"ORIGINAL");view.Select(doc);Equal(doc,DesktopSelection.ReadFromView(view));
    File.WriteAllText(pdf,"CONVERTED COPY");
    if(System.IO.Path.GetFileNameWithoutExtension(doc)!=System.IO.Path.GetFileNameWithoutExtension(pdf))throw new Exception("Collision fixture is invalid.");
    view.Select(doc);Equal(doc,DesktopSelection.ReadFromView(view));
    view.Select(pdf);Equal(pdf,DesktopSelection.ReadFromView(view));
    File.WriteAllText(next,"NEXT ORIGINAL");view.Select(next);Equal(next,DesktopSelection.ReadFromView(view));
    view.Select(doc);Equal(doc,DesktopSelection.ReadFromView(view));
    Console.WriteLine("PASS: hidden-extension name collision after conversion; original, copy and next file resolve independently on repeated reads.");
    string redirected=System.IO.Path.Combine(root,"redirected","Desktop");Directory.CreateDirectory(redirected);
    string remote=System.IO.Path.Combine(redirected,"Báo cáo.docx");File.WriteAllText(remote,"REDIRECTED");view.Select(remote);Equal(remote,DesktopSelection.ReadFromView(view));
    Console.WriteLine("PASS: source identity does not depend on scanning user/public Desktop directories.");
    view.Selection=new FixtureItems{Values=new FixtureItem[0]};Reject(view);
    view.Selection=new FixtureItems{Values=new[]{new FixtureItem{Path=doc},new FixtureItem{Path=pdf}}};Reject(view);
    view.Select(root);Reject(view);view.Select("::{virtual-icon}");Reject(view);view.Select(System.IO.Path.Combine(root,"missing.docx"));Reject(view);
    Equal("ORIGINAL",File.ReadAllText(doc));Equal("CONVERTED COPY",File.ReadAllText(pdf));
    Console.WriteLine("PASS: empty/multiple/virtual/missing/directory selections rejected; files preserved.");
    return 0;
  }
}

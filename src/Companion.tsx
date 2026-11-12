import {useEffect, useRef, useState} from 'react';
import type {PreferencePatch, SettingsResult, SettingsState} from '../shared/contracts';
import logo from '../assets/warp.png';
import selectGif from '../assets/onboarding/01-select.gif';
import selectPng from '../assets/onboarding/01-select.png';
import dragGif from '../assets/onboarding/02-drag.gif';
import dragPng from '../assets/onboarding/02-drag.png';
import copyGif from '../assets/onboarding/03-copy.gif';
import copyPng from '../assets/onboarding/03-copy.png';
import './companion.css';

const art = [[selectGif, selectPng], [dragGif, dragPng], [copyGif, copyPng]];
const words = {
  vi: {
    settings:'Cài đặt', guide:'Hướng dẫn sử dụng', language:'Ngôn ngữ', skip:'Bỏ qua', back:'Quay lại', next:'Tiếp tục', start:'Bắt đầu dùng Warp',
    pause:'Dừng chuyển động', play:'Phát chuyển động', step:'BƯỚC', choose:'Chọn thư mục…', saved:'Đã lưu', saving:'Đang lưu…',
    settingsIntro:'Một lần thiết lập, ít thao tác mỗi ngày.', general:'Tùy chọn chung', startup:'Chạy cùng Windows', startupHint:'Warp ở trong khay hệ thống cạnh đồng hồ.',
    devStartup:'Tùy chọn này khả dụng trong bản Warp đã cài đặt.', output:'Lưu bản chuyển đổi', outputHint:'Các tác vụ đã xác nhận giữ nguyên thư mục đích trước đó.',
    beside:'Ở thư mục cùng file gốc', custom:'Trong thư mục riêng', noDirectory:'Chưa chọn thư mục', safe:'Luôn tạo bản sao. Nếu trùng tên, Warp tự thêm số.',
    locations:'Ứng dụng và dữ liệu', install:'Thư mục cài Warp', installHint:'Đổi vị trí này bằng cách cài lại và chọn thư mục trong bộ cài.', data:'File lưu tùy chọn', dataHint:'Lưu trên máy trong hồ sơ Windows của bạn.',
    open:'Mở', about:'Hỗ trợ', license:'Giấy phép MIT trên GitHub ↗', privacy:'Tài liệu được xử lý cục bộ. Warp không gửi file lên máy chủ.',
    close:'Đóng về khay', guideHint:'Xem lại ba thao tác cơ bản bất cứ lúc nào.',
    errors:{generic:'Không lưu được thay đổi. Hãy thử lại.',directory:'Không thể ghi vào thư mục này. Hãy chọn thư mục khác.',invalid:'Tùy chọn chưa hợp lệ. Hãy kiểm tra lại.',choose:'Hãy chọn thư mục trước.',startup:'Tùy chọn khởi động chỉ có trong bản đã cài.'},
    steps:[
      {title:'Chọn tài liệu của bạn', description:'Bấm một lần vào file trên Desktop hoặc File Explorer. Bạn không cần mở tài liệu.', hint:'Một file được chọn, mọi thứ đã sẵn sàng.', alt:'Con trỏ bấm một lần để chọn tài liệu trên Desktop.'},
      {title:'Giữ phím. Kéo. Chuyển đổi.', description:'Giữ Alt + Shift để hiện vòng tròn. Kéo file sang định dạng đang bật rồi thả chuột để xác nhận.', hint:'Nhả Alt hoặc Shift trước khi xác nhận để hủy thao tác.', alt:'Giữ Alt và Shift, kéo tài liệu sang PDF trong vòng tròn.'},
      {title:'Bản sao mới. Bản gốc vẫn nguyên.', description:'Warp báo tiến trình ở góc phải dưới. Khi hoàn tất, bản chuyển đổi nằm ngay cạnh file gốc.', hint:'Trùng tên? Warp tự thêm số để giữ nguyên các file đã có.', alt:'DOCX gốc được giữ nguyên, bản PDF mới xuất hiện cùng thông báo hoàn tất.'}
    ], customDescription:'Warp báo tiến trình ở góc phải dưới. Khi hoàn tất, bản chuyển đổi nằm trong thư mục riêng bạn đã chọn.'
  },
  en: {
    settings:'Settings', guide:'Quick guide', language:'Language', skip:'Skip', back:'Back', next:'Continue', start:'Start using Warp',
    pause:'Pause animation', play:'Play animation', step:'STEP', choose:'Choose folder…', saved:'Saved', saving:'Saving…',
    settingsIntro:'Set it once. Save steps every day.', general:'General', startup:'Start with Windows', startupHint:'Warp stays in the system tray next to the clock.',
    devStartup:'Available in the installed version of Warp.', output:'Converted files', outputHint:'Jobs already submitted keep their original destination.',
    beside:'Next to the original', custom:'In a chosen folder', noDirectory:'No folder selected', safe:'Always a new copy. Warp adds a number if the name already exists.',
    locations:'Application and data', install:'Warp installation folder', installHint:'To change this location, reinstall Warp and choose a folder in Setup.', data:'Preferences file', dataHint:'Stored locally in your Windows user profile.',
    open:'Open', about:'Help', license:'MIT license on GitHub ↗', privacy:'Documents are processed locally. Warp does not upload your files.',
    close:'Close to tray', guideHint:'Revisit the three basic steps at any time.',
    errors:{generic:'Could not save your change. Please try again.',directory:'Cannot write to this folder. Choose another folder.',invalid:'Invalid preference. Please check your selection.',choose:'Choose a folder first.',startup:'Startup is only available in the installed app.'},
    steps:[
      {title:'Choose your document', description:'Click a file once on your Desktop or in File Explorer. There is no need to open the document.', hint:'One selected file. Ready when you are.', alt:'A cursor clicks once to select a document on the Desktop.'},
      {title:'Hold. Drag. Convert.', description:'Hold Alt + Shift to reveal the circle. Drag the file to an available format and release the mouse to confirm.', hint:'Release Alt or Shift before confirming to cancel.', alt:'Hold Alt and Shift, then drag the document to PDF in the circle.'},
      {title:'A new copy. Original intact.', description:'Watch the progress in the bottom-right corner. Your converted copy appears next to the original.', hint:'Name already taken? Warp adds a number to preserve existing files.', alt:'The original DOCX stays intact while a new PDF appears with a completion message.'}
    ], customDescription:'Watch the progress in the bottom-right corner. Your converted copy is saved in your chosen folder.'
  }
};

export default function Companion({mode}:{mode:'settings'|'onboarding'}) {
  const [data, setData] = useState<SettingsState>();
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const [playing, setPlaying] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const heading = useRef<HTMLHeadingElement>(null), mounted = useRef(true), actionPending = useRef(false);
  const t = words[data?.preferences.language ?? 'vi'];
  useEffect(() => {
    mounted.current = true;
    window.warp?.settings().then(value=>{if(mounted.current)setData(value);}).catch(() => {if(mounted.current)setError('LOAD_SETTINGS');});
    const unsubscribe = window.warp?.onSettings(setData);
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setPlaying(!media.matches);
    media.addEventListener('change', changed);
    return () => {mounted.current = false; unsubscribe?.(); media.removeEventListener('change', changed);};
  }, []);
  useEffect(() => {document.documentElement.lang = data?.preferences.language ?? 'vi';}, [data?.preferences.language]);
  useEffect(() => {if(step)heading.current?.focus();}, [step]);
  useEffect(() => {
    if(mode !== 'onboarding')return;
    const key = (event:KeyboardEvent) => {
      if((event.target as HTMLElement).closest('select,input,button') || busy)return;
      if(event.key === 'ArrowRight')setStep(value => Math.min(2, value + 1));
      if(event.key === 'ArrowLeft')setStep(value => Math.max(0, value - 1));
    };
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  }, [mode, busy]);

  async function action(task:()=>Promise<SettingsResult|void>|undefined) {
    if(actionPending.current)return;
    actionPending.current=true;setBusy(true);setError('');setSaved(false);
    try {
      const result=await task();
      if(!mounted.current)return;
      if(result && !result.ok)setError(result.error);
      else {if(result?.ok)setData(result.value);setSaved(true);}
    } catch {if(mounted.current)setError('ACTION_FAILED');}
    finally {actionPending.current=false;if(mounted.current)setBusy(false);}
  }
  const update = (patch:PreferencePatch) => void action(() => window.warp?.updateSettings(patch));
  const finish = () => void action(() => window.warp?.finishOnboarding());
  const show = (page:'settings'|'onboarding') => void action(() => window.warp?.showCompanion(page));
  const message = error === 'INVALID_SETTINGS' ? t.errors.invalid : error === 'CHOOSE_DIRECTORY' ? t.errors.choose : error === 'STARTUP_PACKAGED_ONLY' ? t.errors.startup : /DIRECTORY|EACCES|EPERM|ENOENT|not a directory/i.test(error) ? t.errors.directory : t.errors.generic;

  if(!data)return <main className="companion-loading" role="status">{error ? message : 'Warp…'}</main>;
  const p=data.preferences, current=t.steps[step];
  return <main className={`companion ${mode}`}>
    <header className="companion-header">
      <div className="companion-brand"><img src={logo} alt=""/><strong>Warp</strong></div>
      <div className="companion-header-actions">
        {mode==='onboarding' && <select aria-label={t.language} disabled={busy} value={p.language} onChange={event=>update({language:event.target.value as 'vi'|'en'})}><option value="vi">Tiếng Việt</option><option value="en">English</option></select>}
        <button className="quiet-button" disabled={busy} onClick={()=>mode==='onboarding'?finish():void window.warp?.hide()}>{mode==='onboarding'?t.skip:t.close}</button>
      </div>
    </header>
    {mode==='onboarding' ? <>
      <div className="onboarding-visual"><img src={art[step][playing?0:1]} width="640" height="400" alt={current.alt}/><button className="motion-button" aria-pressed={!playing} onClick={()=>setPlaying(value=>!value)}>{playing?t.pause:t.play}</button></div>
      <div className="onboarding-instruction" aria-live="polite">
        <p className="eyebrow">{t.step} {step+1} / 3</p>
        <h1 tabIndex={-1} ref={heading}>{current.title}</h1>
        <p>{step===2&&p.outputMode==='custom'?t.customDescription:current.description}</p>
        <p className="muted-hint">{current.hint}</p>
      </div>
      <footer className="onboarding-navigation">
        <nav className="step-dots" aria-label={t.guide}>{t.steps.map((item,index)=><button key={index} aria-current={index===step?'step':undefined} aria-label={`${t.step} ${index+1}: ${item.title}`} onClick={()=>setStep(index)}><span/></button>)}</nav>
        <div className="navigation-buttons"><button className="quiet-button" disabled={!step||busy} onClick={()=>setStep(value=>value-1)}>{t.back}</button><button className="primary-button" disabled={busy} onClick={()=>step<2?setStep(step+1):finish()}>{step===2?t.start:t.next}<span aria-hidden="true">→</span></button></div>
      </footer>
      <div className="onboarding-bottom"><span>{p.language==='vi'?'Warp ở trong khay hệ thống. Bấm phải → Exit để thoát.':'Warp stays in the system tray. Right-click → Exit to quit.'}</span><button className="link-button" disabled={busy} onClick={()=>show('settings')}>{t.settings}</button></div>
    </> : <div className="settings-content">
      <h1>{t.settings}</h1><p className="settings-intro">{t.settingsIntro}</p>
      <section aria-labelledby="general-title"><h2 id="general-title">{t.general}</h2>
        <div className="setting-row"><label htmlFor="language">{t.language}</label><select id="language" value={p.language} disabled={busy} onChange={event=>update({language:event.target.value as 'vi'|'en'})}><option value="vi">Tiếng Việt</option><option value="en">English</option></select></div>
        <div className="setting-row"><div><label htmlFor="startup">{t.startup}</label><p>{data.packaged?t.startupHint:t.devStartup}</p></div><input id="startup" type="checkbox" role="switch" checked={p.launchAtLogin} disabled={busy||!data.packaged} onChange={event=>update({launchAtLogin:event.target.checked})}/></div>
      </section>
      <section aria-labelledby="output-title"><h2 id="output-title">{t.output}</h2>
        <fieldset disabled={busy} className="output-options"><legend className="sr-only">{t.output}</legend>
          <label><input type="radio" name="output" value="source" checked={p.outputMode==='source'} onChange={()=>update({outputMode:'source'})}/>{t.beside}</label>
          <label><input type="radio" name="output" value="custom" checked={p.outputMode==='custom'} onChange={()=>p.outputDirectory?update({outputMode:'custom'}):void action(()=>window.warp?.chooseOutputDirectory())}/>{t.custom}</label>
        </fieldset>
        <div className="directory-choice"><code title={p.outputDirectory??''}>{p.outputDirectory??t.noDirectory}</code><button className="secondary-button" disabled={busy} onClick={()=>void action(()=>window.warp?.chooseOutputDirectory())}>{t.choose}</button></div>
        <p className="setting-note">{t.safe}</p><p className="muted-hint">{t.outputHint}</p>
      </section>
      <section aria-labelledby="locations-title"><h2 id="locations-title">{t.locations}</h2>
        {(['install','settings'] as const).map(location=><div className="location-row" key={location}><div><span>{location==='install'?t.install:t.data}</span><code title={location==='install'?data.installDirectory:data.settingsFile}>{location==='install'?data.installDirectory:data.settingsFile}</code><p>{location==='install'?t.installHint:t.dataHint}</p></div><button className="quiet-button" disabled={busy} onClick={()=>void action(()=>window.warp?.openLocation(location))}>{t.open} ↗</button></div>)}
      </section>
      <section className="settings-help" aria-labelledby="help-title"><h2 id="help-title">{t.about}</h2><button className="link-button" disabled={busy} onClick={()=>show('onboarding')}>{t.guide} →</button><p>{t.guideHint}</p><button className="link-button" disabled={busy} onClick={()=>void action(()=>window.warp?.openLicense())}>{t.license}</button><p>{t.privacy}</p></section>
      <footer className="settings-footer"><span>Warp {data.version}</span><span role="status" aria-live="polite">{!error&&(busy?t.saving:saved?t.saved:'')}</span></footer>
    </div>}
    {error&&<p className="companion-error" role="alert">{message}</p>}
  </main>;
}

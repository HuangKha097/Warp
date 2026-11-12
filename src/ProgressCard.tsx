import {useEffect, useState} from 'react';
import type {ProgressState} from './types';
import type {Language} from '../shared/contracts';
import {errorText} from './error-text';
import logo from '../assets/warp.png';
import './progress.css';

interface ProgressCardProps {
  job: ProgressState | null;
  onHide: () => void;
  onReveal: () => void;
  onRetry: () => void;
  language?: Language;
}

const stages = {
  preparing: 'Đang chuẩn bị tệp…',
  converting: 'Đang chuyển đổi…',
  saving: 'Đang lưu bản sao…'
};

export default function ProgressCard({job, onHide, onReveal, onRetry, language='vi'}: ProgressCardProps) {
  const en=language==='en';
  const [now, setNow] = useState(Date.now());
  const running = job?.status === 'running' || job?.status === 'queued';

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, job?.id]);

  if (!job) return null;

  const failed = job.status === 'error';
  const done = job.status === 'success';
  const selectionError = failed && !job.target;
  const title = selectionError ? (en?'Could not read the selected file':'Không đọc được tệp đang chọn')
    : failed ? (en?'Conversion failed':'Chuyển đổi chưa thành công')
    : done ? (en?'Converted copy is ready':'Đã tạo bản chuyển đổi')
    : job.status === 'queued' ? (en?'Waiting to convert':'Đang chờ chuyển đổi')
    : en?({preparing:'Preparing file…',converting:'Converting…',saving:'Saving copy…'}[job.phase]):stages[job.phase];
  const seconds = Math.max(0, Math.floor((now - job.startedAt) / 1000));
  const elapsed = seconds < 60 ? `${seconds} ${en?'sec':'giây'}`
    : `${Math.floor(seconds / 60)} ${en?'min':'phút'} ${seconds % 60} ${en?'sec':'giây'}`;
  const queueText = selectionError ? (en?'Select a file, then hold Alt + Shift':'Chọn tệp rồi giữ Alt + Shift')
    : job.queued ? (en?`${job.queued} file(s) queued`:`${job.queued} tệp đang chờ`)
    : job.completed > 1 ? (en?`${job.completed} files completed`:`Đã xong ${job.completed} tệp`)
    : en?'Original file preserved':'File gốc được giữ nguyên';

  return (
    <section
      className={`progress-card ${failed ? 'has-error' : ''} ${done ? 'is-complete' : ''}`}
      aria-label={en?'Warp conversion progress':'Tiến trình chuyển đổi Warp'}
    >
      <header className="progress-header">
        <div className="progress-brand"><img src={logo} alt=""/><strong>Warp</strong></div>
        <button className="progress-close" onClick={onHide} aria-label={en?'Hide progress':'Ẩn tiến trình'} title={en?'Hide to tray':'Ẩn xuống khay hệ thống'}>×</button>
      </header>

      <div className="progress-heading" role="status" aria-live="polite">
        <span className={`state-mark ${running ? 'is-running' : ''}`} aria-hidden="true">
          {done ? '✓' : failed ? '!' : ''}
        </span>
        <strong>{title}</strong>
      </div>
      <p className="progress-file" title={job.input}>
        {job.name}<span>{job.target ? ` → ${job.target.toUpperCase()}` : ''}</span>
      </p>

      {failed ? <p className="progress-error" title={errorText(job.error,language)}>{errorText(job.error,language)}</p> : (
        <div
          className="progress-track" role="progressbar" aria-label={en?'Document conversion':'Chuyển đổi tài liệu'}
          aria-valuetext={title} aria-valuenow={done ? 100 : undefined} aria-valuemin={0} aria-valuemax={100}
        ><span/></div>
      )}
      {!failed && job.failures.length > 0 && (
        <p className="prior-error" title={job.failures.map(f => `${f.name}: ${errorText(f.error,language)}`).join('\n')}>
          ! {job.failures.at(-1)?.name}: {errorText(job.failures.at(-1)?.error,language)}
        </p>
      )}

      <footer className="progress-footer">
        <span>
          {running && job.startedAt > 0 ? <span aria-hidden="true">{elapsed} · </span> : null}
          {queueText}
        </span>
        <div>
          {done && <button onClick={onReveal}>{en?'Open folder ↗':'Mở thư mục ↗'}</button>}
          {job.failures.length > 0 && <button onClick={onRetry}>{en?'Retry':'Thử lại'}</button>}
        </div>
      </footer>
    </section>
  );
}

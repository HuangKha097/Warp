import {useEffect, useState} from 'react';
import type {ProgressState} from './types';
import logo from '../assets/warp.png';
import './progress.css';

interface ProgressCardProps {
  job: ProgressState | null;
  onHide: () => void;
  onReveal: () => void;
  onRetry: () => void;
}

const stages = {
  preparing: 'Đang chuẩn bị tệp…',
  converting: 'Đang chuyển đổi…',
  saving: 'Đang lưu bản sao…'
};

export default function ProgressCard({job, onHide, onReveal, onRetry}: ProgressCardProps) {
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
  const title = selectionError ? 'Không đọc được tệp đang chọn'
    : failed ? 'Chuyển đổi chưa thành công'
    : done ? 'Đã tạo bản chuyển đổi'
    : job.status === 'queued' ? 'Đang chờ chuyển đổi'
    : stages[job.phase];
  const seconds = Math.max(0, Math.floor((now - job.startedAt) / 1000));
  const elapsed = seconds < 60 ? `${seconds} giây`
    : `${Math.floor(seconds / 60)} phút ${seconds % 60} giây`;
  const queueText = selectionError ? 'Chọn tệp rồi giữ Alt + Shift'
    : job.queued ? `${job.queued} tệp đang chờ`
    : job.completed > 1 ? `Đã xong ${job.completed} tệp`
    : 'File gốc được giữ nguyên';

  return (
    <section
      className={`progress-card ${failed ? 'has-error' : ''} ${done ? 'is-complete' : ''}`}
      aria-label="Tiến trình chuyển đổi Warp"
    >
      <header className="progress-header">
        <div className="progress-brand"><img src={logo} alt=""/><strong>Warp</strong></div>
        <button className="progress-close" onClick={onHide} aria-label="Ẩn tiến trình" title="Ẩn xuống khay hệ thống">×</button>
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

      {failed ? <p className="progress-error" title={job.error}>{job.error}</p> : (
        <div
          className="progress-track" role="progressbar" aria-label="Chuyển đổi tài liệu"
          aria-valuetext={title} aria-valuenow={done ? 100 : undefined} aria-valuemin={0} aria-valuemax={100}
        ><span/></div>
      )}
      {!failed && job.failures.length > 0 && (
        <p className="prior-error" title={job.failures.map(f => `${f.name}: ${f.error}`).join('\n')}>
          ! {job.failures.at(-1)?.name}: {job.failures.at(-1)?.error}
        </p>
      )}

      <footer className="progress-footer">
        <span>
          {running && job.startedAt > 0 ? <span aria-hidden="true">{elapsed} · </span> : null}
          {queueText}
        </span>
        <div>
          {done && <button onClick={onReveal}>Mở thư mục ↗</button>}
          {job.failures.length > 0 && <button onClick={onRetry}>Thử lại</button>}
        </div>
      </footer>
    </section>
  );
}

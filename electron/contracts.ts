import type {Job} from './jobs';

/** Serializable state shared by the main process, preload and React renderer. */
export type ProgressState = Job & {
  name: string;
  queued: number;
  completed: number;
  failures: {name: string; error: string}[];
};

export interface AppState {
  file: string | null;
  path: string | null;
  targets: string[];
  busy: boolean;
  helperReady: boolean;
  anchor: {x: number; y: number};
  presentation: number;
  job: ProgressState | null;
}

export interface Bridge {
  state(): Promise<AppState>;
  convert(format: string): Promise<AppState>;
  retry(): Promise<AppState>;
  reveal(): Promise<void>;
  hide(): Promise<void>;
  onState(callback: (state: AppState) => void): () => void;
}

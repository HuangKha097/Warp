import type {Job} from './jobs';
import type {Language,Preferences,PreferencePatch} from './preferences';
export type {Language,Preferences,PreferencePatch} from './preferences';

export interface SettingsState {
  preferences: Preferences;
  version: string;
  installDirectory: string;
  settingsFile: string;
  packaged: boolean;
}
export type SettingsResult = {ok: true; value: SettingsState} | {ok: false; error: string};

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
  language?: Language;
}

export interface Bridge {
  state(): Promise<AppState>;
  convert(format: string): Promise<AppState>;
  retry(): Promise<AppState>;
  reveal(): Promise<void>;
  hide(): Promise<void>;
  onState(callback: (state: AppState) => void): () => void;
  settings(): Promise<SettingsState>;
  updateSettings(patch: PreferencePatch): Promise<SettingsResult>;
  chooseOutputDirectory(): Promise<SettingsResult>;
  finishOnboarding(): Promise<void>;
  openLicense(): Promise<void>;
  openLocation(location: 'install' | 'settings'): Promise<void>;
  showCompanion(page: 'settings' | 'onboarding'): Promise<void>;
  onSettings(callback: (state: SettingsState) => void): () => void;
}

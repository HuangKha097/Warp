export type Language = 'vi' | 'en';
export interface Preferences {
  language: Language;
  launchAtLogin: boolean;
  outputMode: 'source' | 'custom';
  outputDirectory: string | null;
  onboardingCompleted: boolean;
}
export type PreferencePatch = Partial<Pick<Preferences, 'language' | 'launchAtLogin' | 'outputMode' | 'outputDirectory'>>;
export interface Job {
  id: number; input: string; target: string;
  status: 'queued' | 'running' | 'success' | 'error';
  phase: 'preparing' | 'converting' | 'saving'; startedAt: number;
  output?: string; error?: string; outputDirectory?: string;
}
export type ProgressState = Job & {
  name: string; queued: number; completed: number;
  failures: {name: string; error: string}[];
};
export interface AppState {
  file: string | null; path: string | null; targets: string[];
  busy: boolean; helperReady: boolean; anchor: {x: number; y: number};
  presentation: number; job: ProgressState | null; language?: Language;
}
export interface SettingsState {
  preferences: Preferences; version: string; installDirectory: string;
  settingsFile: string; packaged: boolean;
}
export type SettingsResult = {ok: true; value: SettingsState} | {ok: false; error: string};
/** Narrow application API; the renderer cannot spawn processes or open arbitrary paths. */
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

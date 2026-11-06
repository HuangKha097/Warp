import {access, mkdir, readFile, rename, stat, writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';

export type Language = 'vi' | 'en';
export interface Preferences {
  language: Language;
  launchAtLogin: boolean;
  outputMode: 'source' | 'custom';
  outputDirectory: string | null;
  onboardingCompleted: boolean;
}
export type PreferencePatch = Partial<Pick<Preferences, 'language' | 'launchAtLogin' | 'outputMode' | 'outputDirectory'>>;
export const defaultPreferences = (locale = 'vi'): Preferences => ({
  language: locale.toLowerCase().startsWith('vi') ? 'vi' : 'en', launchAtLogin: true,
  outputMode: 'source', outputDirectory: null, onboardingCompleted: false
});

function decode(value: unknown, defaults: Preferences): Preferences {
  if (!value || typeof value !== 'object') return {...defaults};
  const p = value as Record<string, unknown>;
  const directory = typeof p.outputDirectory === 'string' && path.isAbsolute(p.outputDirectory) ? p.outputDirectory : null;
  return {
    language: p.language === 'vi' || p.language === 'en' ? p.language : defaults.language,
    launchAtLogin: typeof p.launchAtLogin === 'boolean' ? p.launchAtLogin : defaults.launchAtLogin,
    outputMode: p.outputMode === 'custom' && directory ? 'custom' : 'source', outputDirectory: directory,
    onboardingCompleted: p.onboardingCompleted === true
  };
}

/** One local file, serialized atomic writes; no database or network. */
export class PreferencesStore {
  private value: Preferences;
  private pending: Promise<unknown> = Promise.resolve();
  existed = false;
  constructor(readonly file: string, locale = 'vi') { this.value = defaultPreferences(locale); }
  get current(): Preferences { return {...this.value}; }
  async load() {
    try {
      const contents = await readFile(this.file, 'utf8');
      this.existed = true;
      try { this.value = decode(JSON.parse(contents), this.value); }
      catch { await rename(this.file, `${this.file}.invalid-${Date.now()}`); }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    return this.current;
  }
  update(patch: unknown): Promise<Preferences> {
    return this.serialize(async () => {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('INVALID_SETTINGS');
      const p = patch as Record<string, unknown>;
      if (Object.keys(p).some(key => !['language','launchAtLogin','outputMode','outputDirectory'].includes(key))) throw new Error('INVALID_SETTINGS');
      if ('language' in p && p.language !== 'vi' && p.language !== 'en') throw new Error('INVALID_SETTINGS');
      if ('launchAtLogin' in p && typeof p.launchAtLogin !== 'boolean') throw new Error('INVALID_SETTINGS');
      if ('outputMode' in p && p.outputMode !== 'source' && p.outputMode !== 'custom') throw new Error('INVALID_SETTINGS');
      if ('outputDirectory' in p && p.outputDirectory !== null && (typeof p.outputDirectory !== 'string' || !path.isAbsolute(p.outputDirectory))) throw new Error('INVALID_DIRECTORY');
      const next = {...this.value, ...p} as Preferences;
      if (next.outputMode === 'custom' && ('outputMode' in p || 'outputDirectory' in p)) {
        if (!next.outputDirectory) throw new Error('CHOOSE_DIRECTORY');
        if (!(await stat(next.outputDirectory)).isDirectory()) throw new Error('INVALID_DIRECTORY');
        await access(next.outputDirectory, constants.W_OK);
      }
      return this.persist(next);
    });
  }
  completeOnboarding() { return this.serialize(() => this.persist({...this.value, onboardingCompleted: true})); }
  private serialize(task: () => Promise<Preferences>) {
    const result = this.pending.then(task);
    this.pending = result.catch(() => {});
    return result;
  }
  private async persist(next: Preferences) {
    await mkdir(path.dirname(this.file), {recursive: true});
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify({schemaVersion: 1, ...next}, null, 2), 'utf8');
    await rename(temporary, this.file);
    this.value = next;
    return this.current;
  }
}

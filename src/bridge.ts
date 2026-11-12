import {invoke, isTauri} from '@tauri-apps/api/core';
import {listen, type UnlistenFn} from '@tauri-apps/api/event';
import type {AppState, Bridge, SettingsState} from '../shared/contracts';

/** React effects can unmount before Tauri resolves the listener registration. */
export function subscribe<T>(event: string, callback: (value: T) => void, refresh?: () => Promise<T>): () => void {
  let disposed = false;
  let unlisten: UnlistenFn | undefined;
  void listen<T>(event, value => { if (!disposed) callback(value.payload); })
    .then(async off => {
      if (disposed) { off(); return; }
      unlisten = off;
      // Read again after registration so a native event during React mount is not lost.
      if (refresh) { const current = await refresh(); if (!disposed) callback(current); }
    })
    .catch(error => console.error(`Warp event ${event}:`, error));
  return () => { disposed = true; unlisten?.(); };
}

export function installBridge() {
  if (!isTauri()) return;
  const bridge: Bridge = {
    state: () => invoke('app_state'),
    convert: format => invoke('convert_file', {format}),
    retry: () => invoke('retry'),
    reveal: () => invoke('reveal'),
    hide: () => invoke('hide'),
    settings: () => invoke('settings'),
    updateSettings: patch => invoke('update_settings', {patch}),
    chooseOutputDirectory: () => invoke('choose_output_directory'),
    finishOnboarding: () => invoke('finish_onboarding'),
    openLicense: () => invoke('open_license'),
    openLocation: location => invoke('open_location', {location}),
    showCompanion: page => invoke('show_companion', {page}),
    onState: callback => subscribe<AppState>('warp-state', callback, () => invoke('app_state')),
    onSettings: callback => subscribe<SettingsState>('warp-settings', callback, () => invoke('settings'))
  };
  window.warp = bridge;
}

export function notifyReady() {
  if (isTauri()) requestAnimationFrame(() => { void invoke('ui_ready').catch(console.error); });
}

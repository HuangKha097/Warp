document.addEventListener('DOMContentLoaded', async () => {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async (condition, description) => {
    for (let i = 0; i < 600; i++) { const result = await condition(); if (result) return result; await pause(100); }
    throw new Error(`Timed out: ${description}`);
  };
  const invoke = (command, args) => window.__TAURI_INTERNALS__.invoke(command, args);
  const step = (action, value) => invoke('smoke_step', {action, value});
  const check = (name, value) => step('check', {name, value});
  const assert = (value, message) => { if (!value) throw new Error(message); };
  try {
    await wait(() => window.warp, 'React bridge');
    const mode = new URLSearchParams(location.search).get('mode');
    if (mode === 'onboarding') {
      const initial = await window.warp.settings();
      assert(initial.preferences.outputMode === 'source', 'Default destination changed');
      assert(!initial.packaged, 'Smoke build must not alter Windows startup');
      await wait(() => document.querySelector('.onboarding-instruction h1'), 'onboarding art and text');
      const {output} = await step('context');
      let result = await window.warp.updateSettings({language:'en'}); assert(result.ok, 'English preference');
      await wait(() => document.documentElement.lang === 'en', 'language broadcast');
      result = await window.warp.updateSettings({outputMode:'custom', outputDirectory:output}); assert(result.ok, 'Custom directory preference');
      result = await window.warp.updateSettings({launchAtLogin:false}); assert(!result.ok && result.error === 'STARTUP_PACKAGED_ONLY', 'Dev startup guard');
      await check('onboarding-settings', true);
      await window.warp.finishOnboarding();
    } else if (mode === 'overlay') {
      await wait(async () => (await window.warp.state()).helperReady, 'native selection watcher');
      await wait(async () => (await step('context')).report.checks['onboarding-settings'], 'settings scenario');
      await step('select');
      await wait(() => document.querySelector('[data-format="pdf"][aria-disabled="false"]'), 'React orbit state');
      await check('orbit-rendered', true);
      document.querySelector('[data-format="pdf"]').dispatchEvent(new MouseEvent('click', {bubbles:true}));
      const job = await wait(async () => { const state = await window.warp.state(); if (state.job?.status === 'error') throw new Error(state.job.error); return state.job?.status === 'success' && state.job; }, 'TXT to PDF');
      assert(job.name === 'tài liệu.txt', 'Unicode source name');
      await check('conversion', true);
      await wait(async () => (await step('context')).report.checks['progress-card'], 'progress card renderer');
      await step('finish');
    } else if (mode === 'status') {
      await wait(() => document.querySelector('.progress-card') || document.querySelector('[role="status"]'), 'progress UI');
      await check('progress-card', true);
    }
  } catch (error) { try { await step('fail', String(error?.stack || error)); } catch { console.error(error); } }
});

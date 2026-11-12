require('./toolchain.cjs');
require('@tauri-apps/cli').run(process.argv.slice(2), 'npm run tauri').catch(error => {
  console.error(error.message);
  process.exit(1);
});

require('./toolchain.cjs');
const {spawnSync} = require('node:child_process');
const result = spawnSync('cargo', process.argv.slice(2), {stdio:'inherit', windowsHide:true});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);

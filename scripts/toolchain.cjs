const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const local = path.join(root, '.cache', 'cargo', 'bin');
// CI and contributors can use an ordinary Rust install. This workspace also
// supports a toolchain isolated under .cache, without editing the user's PATH.
if (fs.existsSync(path.join(local, 'cargo.exe')) && fs.existsSync(path.join(root, '.cache', 'rustup', 'toolchains'))) {
  process.env.CARGO_HOME = path.join(root, '.cache', 'cargo');
  process.env.RUSTUP_HOME = path.join(root, '.cache', 'rustup');
  process.env.PATH = local + path.delimiter + process.env.PATH;
}
module.exports = {root};

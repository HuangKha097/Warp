#[cfg(feature = "desktop")]
mod app;
#[cfg(feature = "desktop")]
mod commands;
pub mod conversion;
mod model;
mod preferences;
mod queue;
#[cfg(feature = "desktop")]
mod runtime;
#[cfg(feature = "smoke-test")]
mod smoke;
#[cfg(feature = "desktop")]
mod startup;
mod watcher;
#[cfg(feature = "desktop")]
pub fn run() {
    app::run();
}

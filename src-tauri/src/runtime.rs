use crate::{
    conversion,
    model::*,
    preferences::Store,
    queue::Queue,
    startup,
    watcher::{Selection, WatchEvent},
};
use std::{
    fs::OpenOptions,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
};

pub(crate) struct Core {
    pub store: Store,
    pub queue: Queue,
    pub selection: Selection,
    pub helper_ready: bool,
    pub anchor: Point,
    pub presentation: u64,
    pub progress: Option<Progress>,
    pub dismissed: Option<u64>,
    pub shown: Option<u64>,
    pub status_revision: u64,
}
impl Core {
    pub fn state(&self) -> AppState {
        let file = self.selection.file.as_ref();
        AppState {
            file: file.map(|f| basename(f)),
            path: file.cloned(),
            targets: file
                .map(|f| conversion::targets(Path::new(f)))
                .unwrap_or_default(),
            busy: file.is_some_and(|f| self.queue.has_input(f)),
            helper_ready: self.helper_ready,
            anchor: self.anchor,
            presentation: self.presentation,
            job: self.progress.clone(),
            language: self.store.value.language.clone(),
        }
    }
    fn record(&mut self, id: u64) {
        if let Some(job) = self.queue.jobs.iter().find(|j| j.id == id) {
            self.progress = Some(self.queue.progress(job));
        }
    }
}
#[derive(Clone)]
pub struct Runtime {
    pub app: AppHandle,
    pub(crate) core: Arc<Mutex<Core>>,
    pub stopped: Arc<AtomicBool>,
    pub wake: mpsc::Sender<()>,
    pub engine: PathBuf,
    pub data: PathBuf,
    pub packaged: bool,
    pub threads: Arc<Mutex<Vec<thread::JoinHandle<()>>>>,
}
impl Runtime {
    pub fn state(&self) -> AppState {
        self.core.lock().unwrap().state()
    }
    pub fn diagnostic(&self, event: &str) {
        if let Ok(mut log) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.data.join("runtime.log"))
        {
            let _ = writeln!(log, "{} {event}", now());
        }
    }
    pub fn broadcast(&self) {
        if self.stopped.load(Ordering::SeqCst) {
            return;
        }
        let state = self.state();
        for label in ["overlay", "status"] {
            let _ = self.app.emit_to(label, "warp-state", &state);
        }
    }
    pub fn settings(&self) -> SettingsState {
        let mut preferences = self.core.lock().unwrap().store.value.clone();
        if self.packaged {
            preferences.launch_at_login = startup::enabled();
        }
        SettingsState {
            preferences,
            version: self.app.package_info().version.to_string(),
            install_directory: if self.packaged {
                std::env::current_exe()
                    .unwrap()
                    .parent()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned()
            } else {
                project_root().to_string_lossy().into_owned()
            },
            settings_file: self
                .data
                .join("settings.json")
                .to_string_lossy()
                .into_owned(),
            packaged: self.packaged,
        }
    }
    pub fn settings_changed(&self) {
        let _ = self
            .app
            .emit_to("companion", "warp-settings", self.settings());
        self.broadcast();
        let _ = self.update_tray();
    }
    pub fn update_tray(&self) -> tauri::Result<()> {
        let en = self.core.lock().unwrap().store.value.language == "en";
        let settings = MenuItem::with_id(
            &self.app,
            "settings",
            if en { "Settings…" } else { "Cài đặt…" },
            true,
            None::<&str>,
        )?;
        let guide = MenuItem::with_id(
            &self.app,
            "guide",
            if en {
                "Quick guide…"
            } else {
                "Hướng dẫn sử dụng…"
            },
            true,
            None::<&str>,
        )?;
        let separator = PredefinedMenuItem::separator(&self.app)?;
        let quit = MenuItem::with_id(&self.app, "quit", "Exit", true, None::<&str>)?;
        if let Some(tray) = self.app.tray_by_id("warp") {
            tray.set_menu(Some(Menu::with_items(
                &self.app,
                &[&settings, &guide, &separator, &quit],
            )?))?;
        }
        Ok(())
    }
    pub fn show_companion(&self, page: &str) -> Result<(), String> {
        if !["settings", "onboarding"].contains(&page) {
            return Err("INVALID_PAGE".into());
        }
        if self.stopped.load(Ordering::SeqCst) {
            return Ok(());
        }
        self.core.lock().unwrap().selection.release();
        if let Some(window) = self.app.get_webview_window("overlay") {
            let _ = window.hide();
        }
        // Release the closed settings WebView instead of retaining a renderer in the tray.
        if let Some(window) = self.app.get_webview_window("companion") {
            window.destroy().map_err(|e| e.to_string())?;
        }
        let mut builder = WebviewWindowBuilder::new(
            &self.app,
            "companion",
            WebviewUrl::App(format!("index.html?mode={page}").into()),
        )
        .title("Warp")
        .inner_size(800.0, 790.0)
        .min_inner_size(480.0, 480.0)
        .visible(false)
        .shadow(false)
        .background_color(tauri::window::Color(24, 24, 24, 255))
        .disable_drag_drop_handler()
        .on_navigation(local_navigation);
        if let Some(monitor) = self.nearest_monitor() {
            let area = monitor.work_area();
            let scale = monitor.scale_factor();
            builder = builder
                .inner_size(
                    (area.size.width as f64 / scale).min(800.0),
                    (area.size.height as f64 / scale).min(790.0),
                )
                .min_inner_size(
                    (area.size.width as f64 / scale).min(480.0),
                    (area.size.height as f64 / scale).min(480.0),
                );
        }
        #[cfg(feature = "smoke-test")]
        if smoke_path().is_some() {
            builder = builder.initialization_script(include_str!("../../tests/tauri/smoke.js"));
        }
        builder.build().map_err(|e| e.to_string())?;
        Ok(())
    }
    fn nearest_monitor(&self) -> Option<tauri::Monitor> {
        self.app
            .cursor_position()
            .ok()
            .and_then(|p| self.app.monitor_from_point(p.x, p.y).ok().flatten())
            .or_else(|| self.app.primary_monitor().ok().flatten())
    }
    pub fn show_progress(&self, force: bool) {
        if self.stopped.load(Ordering::SeqCst) {
            return;
        }
        let Some(window) = self.app.get_webview_window("status") else {
            return;
        };
        let visible = window.is_visible().unwrap_or(false);
        let position = {
            let mut core = self.core.lock().unwrap();
            let Some(progress) = &core.progress else {
                return;
            };
            let id = progress.job.id;
            if !force && core.dismissed == Some(id) {
                return;
            }
            if force {
                core.dismissed = None;
            }
            let position = core.shown != Some(id) || !visible;
            core.shown = Some(id);
            position
        };
        if position {
            if let Some(monitor) = self.nearest_monitor() {
                let area = monitor.work_area();
                let scale = monitor.scale_factor();
                let _ = window.set_position(PhysicalPosition::new(
                    (area.position.x + area.size.width as i32 - (386.0 * scale) as i32)
                        .max(area.position.x),
                    (area.position.y + area.size.height as i32 - (244.0 * scale) as i32)
                        .max(area.position.y),
                ));
            }
        }
        let _ = window.show();
    }
    fn changed(&self, id: u64) {
        if self.stopped.load(Ordering::SeqCst) {
            return;
        }
        let (success, terminal, revision, tooltip) = {
            let mut core = self.core.lock().unwrap();
            core.record(id);
            core.status_revision += 1;
            let progress = core.progress.as_ref().unwrap();
            let success = progress.job.status == "success";
            let terminal = success || progress.job.status == "error";
            let tooltip = if terminal {
                "Warp · Alt + Shift".into()
            } else {
                format!(
                    "Warp · {} {}",
                    if core.store.value.language == "en" {
                        "Converting"
                    } else {
                        "Đang chuyển đổi"
                    },
                    progress.name
                )
            };
            (success, terminal, core.status_revision, tooltip)
        };
        self.broadcast();
        self.show_progress(terminal);
        if let Some(tray) = self.app.tray_by_id("warp") {
            let _ = tray.set_tooltip(Some(tooltip));
        }
        if success {
            let rt = self.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_secs(8)).await;
                if !rt.stopped.load(Ordering::SeqCst)
                    && rt.core.lock().unwrap().status_revision == revision
                {
                    if let Some(window) = rt.app.get_webview_window("status") {
                        let _ = window.hide();
                    }
                }
            });
        }
    }
    fn warning(&self, error: String) {
        {
            let mut core = self.core.lock().unwrap();
            if core.queue.jobs.iter().any(|j| j.status == "running") {
                return;
            }
            core.progress = Some(Progress {
                job: Job {
                    id: 0,
                    input: String::new(),
                    target: String::new(),
                    status: "error".into(),
                    phase: "preparing".into(),
                    started_at: 0,
                    output: None,
                    error: Some(error),
                    output_directory: None,
                },
                name: "Không thể mở vòng tròn".into(),
                queued: 0,
                completed: 0,
                failures: vec![],
            });
            core.status_revision += 1;
        }
        self.broadcast();
        self.show_progress(true);
    }
    pub fn reset_watcher(&self) {
        {
            let mut c = self.core.lock().unwrap();
            c.helper_ready = false;
            c.selection.release();
        }
        if let Some(w) = self.app.get_webview_window("overlay") {
            let _ = w.hide();
        }
        self.diagnostic("watcher-restarting");
        self.broadcast();
    }
    pub fn watch(&self, event: WatchEvent) {
        if self.stopped.load(Ordering::SeqCst) {
            return;
        }
        let Some(window) = self.app.get_webview_window("overlay") else {
            return;
        };
        if event.ready {
            self.core.lock().unwrap().helper_ready = true;
            self.diagnostic("watcher-ready");
            self.broadcast();
            return;
        }
        if event.released {
            self.core.lock().unwrap().selection.release();
            let _ = window.hide();
            return;
        }
        if event.held {
            if let Some(id) = event.gesture {
                self.core.lock().unwrap().selection.press(id);
                let _ = window.hide();
            }
            return;
        }
        if !self.core.lock().unwrap().selection.accepts(event.gesture) {
            return;
        }
        if let Some(error) = event.error {
            self.warning(error);
            return;
        }
        let (Some(file), Some(x), Some(y)) = (event.file, event.x, event.y) else {
            return;
        };
        if !x.is_finite()
            || !y.is_finite()
            || !Path::new(&file).is_absolute()
            || !Path::new(&file).is_file()
        {
            return;
        }
        let Some(monitor) = self.app.monitor_from_point(x, y).ok().flatten() else {
            return;
        };
        let area = monitor.work_area();
        let scale = monitor.scale_factor();
        if window.set_position(area.position).is_err()
            || window
                .set_size(PhysicalSize::new(area.size.width, area.size.height))
                .is_err()
        {
            return;
        }
        {
            let mut core = self.core.lock().unwrap();
            if !core.selection.accepts(event.gesture) {
                return;
            }
            core.selection.file = Some(file);
            core.presentation += 1;
            core.anchor = Point {
                x: (x - area.position.x as f64) / scale,
                y: (y - area.position.y as f64) / scale,
            };
        }
        self.broadcast();
        let _ = window.show();
        self.diagnostic("orbit-shown");
    }
    pub fn enqueue(&self, input: String, target: String, directory: Option<String>) {
        let id = {
            let mut core = self.core.lock().unwrap();
            if !core.queue.enqueue(input, target, directory) {
                return;
            }
            core.queue.jobs.last().unwrap().id
        };
        self.changed(id);
        let _ = self.wake.send(());
    }
    pub fn drain(&self, receiver: mpsc::Receiver<()>) {
        while receiver.recv().is_ok() && !self.stopped.load(Ordering::SeqCst) {
            loop {
                if self.stopped.load(Ordering::SeqCst) {
                    return;
                }
                let job = self.core.lock().unwrap().queue.next();
                let Some(job) = job else {
                    break;
                };
                self.changed(job.id);
                let result = conversion::find_office(&self.engine)
                    .ok_or_else(|| {
                        "Thiếu bộ chuyển đổi tích hợp. Hãy cài lại bản Warp đầy đủ.".into()
                    })
                    .and_then(|office| {
                        conversion::convert(
                            Path::new(&job.input),
                            &job.target,
                            &office,
                            job.output_directory.as_deref().map(Path::new),
                            &self.stopped,
                            |phase| {
                                {
                                    let mut core = self.core.lock().unwrap();
                                    if let Some(j) =
                                        core.queue.jobs.iter_mut().find(|j| j.id == job.id)
                                    {
                                        j.phase = phase.into();
                                    }
                                }
                                self.changed(job.id);
                            },
                        )
                    });
                {
                    let mut core = self.core.lock().unwrap();
                    if let Some(j) = core.queue.jobs.iter_mut().find(|j| j.id == job.id) {
                        match result {
                            Ok(path) => {
                                j.status = "success".into();
                                j.output = Some(path.to_string_lossy().into_owned());
                            }
                            Err(e) => {
                                j.status = "error".into();
                                j.error = Some(e);
                            }
                        }
                    }
                }
                self.changed(job.id);
                self.core.lock().unwrap().queue.prune();
            }
        }
    }
    pub fn stop(&self) {
        self.stopped.store(true, Ordering::SeqCst);
        let _ = self.wake.send(());
    }
    pub fn join(&self) {
        self.stop();
        for handle in self.threads.lock().unwrap().drain(..) {
            let _ = handle.join();
        }
    }
}
pub fn project_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .into()
}
pub fn local_navigation(url: &url::Url) -> bool {
    (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || (["http", "https"].contains(&url.scheme()) && url.host_str() == Some("tauri.localhost"))
        || (cfg!(debug_assertions)
            && url.scheme() == "http"
            && url.host_str() == Some("127.0.0.1")
            && url.port() == Some(1420))
}
#[cfg(feature = "smoke-test")]
pub fn smoke_path() -> Option<PathBuf> {
    std::env::var_os("WARP_SMOKE_REPORT").map(PathBuf::from)
}

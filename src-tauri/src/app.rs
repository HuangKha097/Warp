use crate::{
    commands::*,
    model::Point,
    preferences::Store,
    queue::Queue,
    runtime::{local_navigation, project_root, Core, Runtime},
    startup,
    watcher::{self, Selection},
};
use std::{
    fs,
    path::PathBuf,
    sync::{atomic::AtomicBool, mpsc, Arc, Mutex},
    thread,
};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

fn create_background(
    app: &tauri::AppHandle,
    label: &str,
    width: f64,
    height: f64,
) -> tauri::Result<()> {
    let builder = WebviewWindowBuilder::new(
        app,
        label,
        WebviewUrl::App(format!("index.html?mode={label}").into()),
    )
    .title("Warp")
    .inner_size(width, height)
    .transparent(true)
    .decorations(false)
    .shadow(false)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .focused(false)
    .focusable(false)
    .disable_drag_drop_handler()
    .on_navigation(local_navigation);
    #[cfg(feature = "smoke-test")]
    let builder = if crate::runtime::smoke_path().is_some() {
        builder.initialization_script(include_str!("../../tests/tauri/smoke.js"))
    } else {
        builder
    };
    builder.build()?;
    Ok(())
}
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.iter().any(|a| a == "--background") {
                return;
            }
            if let Some(rt) = app.try_state::<Runtime>() {
                let page = if rt.core.lock().unwrap().store.value.onboarding_completed {
                    "settings"
                } else {
                    "onboarding"
                };
                let rt = rt.inner().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = rt.show_companion(page);
                });
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());
    #[cfg(not(feature = "smoke-test"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_state,
        settings,
        update_settings,
        choose_output_directory,
        finish_onboarding,
        open_license,
        open_location,
        show_companion,
        convert_file,
        retry,
        reveal,
        hide,
        ui_ready
    ]);
    #[cfg(feature = "smoke-test")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_state,
        settings,
        update_settings,
        choose_output_directory,
        finish_onboarding,
        open_license,
        open_location,
        show_companion,
        convert_file,
        retry,
        reveal,
        hide,
        ui_ready,
        crate::smoke::smoke_step
    ]);
    let app = builder
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != "companion" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            let packaged = !cfg!(debug_assertions) && !cfg!(feature = "smoke-test");
            let data = if packaged {
                app.path().config_dir()?.join("Warp")
            } else {
                std::env::var_os("WARP_DATA_DIR")
                    .map(PathBuf::from)
                    .unwrap_or_else(|| project_root().join(".cache/tauri-dev"))
            };
            fs::create_dir_all(&data)?;
            let locale = if packaged {
                fs::read_to_string(
                    std::env::current_exe()?
                        .parent()
                        .unwrap()
                        .join("installer-language"),
                )
                .unwrap_or_else(|_| sys_locale::get_locale().unwrap_or_else(|| "vi".into()))
            } else {
                "vi".into()
            };
            let mut store = Store::load(data.join("settings.json"), locale.trim())?;
            if !store.existed {
                let mut next = store.value.clone();
                if packaged {
                    if data.join("runtime.log").exists() {
                        next.launch_at_login = startup::enabled();
                    } else {
                        startup::set(true)?;
                    }
                }
                store.save(next)?;
            }
            // Retarget an enabled Electron startup entry to the Tauri executable.
            // An absent/disabled entry remains disabled through upgrades.
            if packaged && startup::enabled() {
                startup::set(true)?;
            }
            let engine = if packaged {
                app.path().resource_dir()?.join("libreoffice")
            } else {
                std::env::var_os("WARP_ENGINE_DIR")
                    .map(PathBuf::from)
                    .unwrap_or_else(|| project_root().join("vendor/libreoffice"))
            };
            let (wake, rx) = mpsc::channel();
            let rt = Runtime {
                app: app_handle.clone(),
                core: Arc::new(Mutex::new(Core {
                    store,
                    queue: Queue::default(),
                    selection: Selection::default(),
                    helper_ready: false,
                    anchor: Point { x: 260.0, y: 260.0 },
                    presentation: 0,
                    progress: None,
                    dismissed: None,
                    shown: None,
                    status_revision: 0,
                })),
                stopped: Arc::new(AtomicBool::new(false)),
                wake,
                engine,
                data,
                packaged,
                threads: Arc::new(Mutex::new(vec![])),
            };
            app.manage(rt.clone());
            create_background(&app_handle, "overlay", 520.0, 520.0)?;
            create_background(&app_handle, "status", 370.0, 228.0)?;
            TrayIconBuilder::with_id("warp")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Warp · Alt + Shift")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    let rt = app.state::<Runtime>();
                    match event.id.as_ref() {
                        "quit" => {
                            let rt = rt.inner().clone();
                            tauri::async_runtime::spawn_blocking(move || {
                                rt.join();
                                rt.app.exit(0);
                            });
                        }
                        "settings" | "guide" => {
                            let page = if event.id.as_ref() == "settings" {
                                "settings"
                            } else {
                                "onboarding"
                            };
                            let rt = rt.inner().clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = rt.show_companion(page);
                            });
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) {
                        tray.app_handle().state::<Runtime>().show_progress(true);
                    }
                })
                .build(app)?;
            rt.update_tray()?;
            let worker = rt.clone();
            rt.threads
                .lock()
                .unwrap()
                .push(thread::spawn(move || worker.drain(rx)));
            let executable = if packaged {
                app.path().resource_dir()?.join("SelectionWatcher.exe")
            } else {
                project_root().join("native/SelectionWatcher.exe")
            };
            let watcher = rt.clone();
            rt.threads.lock().unwrap().push(thread::spawn(move || {
                watcher::supervise(watcher, &executable)
            }));
            rt.diagnostic("started-tauri-tray");
            if !rt.core.lock().unwrap().store.value.onboarding_completed
                && !std::env::args().any(|a| a == "--background")
            {
                let rt = rt.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = rt.show_companion("onboarding");
                });
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Could not start Warp");
    app.run(|app, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            app.state::<Runtime>().stop();
        }
    });
}

use crate::{
    conversion,
    model::*,
    runtime::{local_navigation, Runtime},
    startup,
};
use serde_json::{json, Value};
use std::path::Path;
use tauri::{AppHandle, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

fn trusted(window: &WebviewWindow, labels: &[&str]) -> Result<(), String> {
    if labels.contains(&window.label()) && window.url().is_ok_and(|u| local_navigation(&u)) {
        Ok(())
    } else {
        Err("UNTRUSTED_SENDER".into())
    }
}
#[tauri::command]
pub fn app_state(window: WebviewWindow, rt: tauri::State<Runtime>) -> Result<AppState, String> {
    trusted(&window, &["overlay", "status"])?;
    Ok(rt.state())
}
#[tauri::command]
pub fn settings(window: WebviewWindow, rt: tauri::State<Runtime>) -> Result<SettingsState, String> {
    trusted(&window, &["companion"])?;
    Ok(rt.settings())
}
#[tauri::command]
pub fn update_settings(
    window: WebviewWindow,
    rt: tauri::State<Runtime>,
    patch: Value,
) -> Result<Value, String> {
    trusted(&window, &["companion"])?;
    let result = (|| -> Result<SettingsState, String> {
        let mut core = rt.core.lock().unwrap();
        if patch.get("launchAtLogin").is_some() && !rt.packaged {
            return Err("STARTUP_PACKAGED_ONLY".into());
        }
        let next = core.store.patched(patch.clone())?;
        let previous = if rt.packaged {
            startup::enabled()
        } else {
            core.store.value.launch_at_login
        };
        if patch.get("launchAtLogin").is_some() {
            startup::set(next.launch_at_login)?;
        }
        if let Err(e) = core.store.save(next) {
            if patch.get("launchAtLogin").is_some() {
                let _ = startup::set(previous);
            }
            return Err(e);
        }
        drop(core);
        rt.settings_changed();
        Ok(rt.settings())
    })();
    Ok(match result {
        Ok(value) => json!({"ok":true,"value":value}),
        Err(error) => json!({"ok":false,"error":error}),
    })
}
#[tauri::command]
pub async fn choose_output_directory(
    window: WebviewWindow,
    rt: tauri::State<'_, Runtime>,
) -> Result<Value, String> {
    trusted(&window, &["companion"])?;
    let runtime = rt.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut picker = runtime.app.dialog().file().set_parent(&window);
        if let Some(directory) = runtime
            .core
            .lock()
            .unwrap()
            .store
            .value
            .output_directory
            .clone()
        {
            picker = picker.set_directory(directory);
        }
        if let Some(path) = picker.blocking_pick_folder() {
            let result = (|| -> Result<(), String> {
                let path = path.into_path().map_err(|e| e.to_string())?;
                let mut core = runtime.core.lock().unwrap();
                let next = core
                    .store
                    .patched(json!({"outputMode":"custom","outputDirectory":path}))?;
                core.store.save(next)
            })();
            if let Err(error) = result {
                return json!({"ok":false,"error":error});
            }
            runtime.settings_changed();
        }
        json!({"ok":true,"value":runtime.settings()})
    })
    .await
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn finish_onboarding(window: WebviewWindow, rt: tauri::State<Runtime>) -> Result<(), String> {
    trusted(&window, &["companion"])?;
    {
        let mut core = rt.core.lock().unwrap();
        let mut next = core.store.value.clone();
        next.onboarding_completed = true;
        core.store.save(next)?;
    }
    rt.settings_changed();
    window.destroy().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn open_license(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    trusted(&window, &["companion"])?;
    app.opener()
        .open_url(
            "https://github.com/HuangKha097/Warp/blob/main/LICENSE",
            None::<&str>,
        )
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn open_location(
    window: WebviewWindow,
    rt: tauri::State<Runtime>,
    location: String,
) -> Result<(), String> {
    trusted(&window, &["companion"])?;
    match location.as_str() {
        "settings" => {
            let file = rt.core.lock().unwrap().store.file.clone();
            rt.app.opener().reveal_item_in_dir(file)
        }
        "install" => rt
            .app
            .opener()
            .open_path(rt.settings().install_directory, None::<&str>),
        _ => return Err("INVALID_LOCATION".into()),
    }
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn show_companion(
    window: WebviewWindow,
    rt: tauri::State<'_, Runtime>,
    page: String,
) -> Result<(), String> {
    trusted(&window, &["companion"])?;
    rt.show_companion(&page)
}
#[tauri::command]
pub fn convert_file(
    window: WebviewWindow,
    rt: tauri::State<Runtime>,
    format: String,
) -> Result<AppState, String> {
    trusted(&window, &["overlay"])?;
    let job = {
        let mut core = rt.core.lock().unwrap();
        if !core.selection.held {
            return Ok(core.state());
        }
        let Some(file) = core.selection.file.clone() else {
            return Ok(core.state());
        };
        if !conversion::targets(Path::new(&file)).contains(&format) {
            return Ok(core.state());
        }
        core.selection.release();
        let p = &core.store.value;
        (
            file,
            if p.output_mode == "custom" {
                p.output_directory.clone()
            } else {
                None
            },
        )
    };
    window.hide().map_err(|e| e.to_string())?;
    rt.enqueue(job.0, format, job.1);
    Ok(rt.state())
}
#[tauri::command]
pub fn retry(window: WebviewWindow, rt: tauri::State<Runtime>) -> Result<AppState, String> {
    trusted(&window, &["status"])?;
    let failed = rt
        .core
        .lock()
        .unwrap()
        .queue
        .failures()
        .last()
        .map(|j| (**j).clone());
    if let Some(job) = failed {
        rt.enqueue(job.input, job.target, job.output_directory);
    }
    Ok(rt.state())
}
#[tauri::command]
pub fn reveal(window: WebviewWindow, rt: tauri::State<Runtime>) -> Result<(), String> {
    trusted(&window, &["status"])?;
    let output = rt
        .core
        .lock()
        .unwrap()
        .progress
        .as_ref()
        .and_then(|p| p.job.output.clone());
    if let Some(output) = output {
        rt.app
            .opener()
            .reveal_item_in_dir(output)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
pub fn hide(window: WebviewWindow, rt: tauri::State<Runtime>) -> Result<(), String> {
    trusted(&window, &["overlay", "status", "companion"])?;
    if window.label() == "companion" {
        return window.destroy().map_err(|e| e.to_string());
    }
    {
        let mut core = rt.core.lock().unwrap();
        if window.label() == "status" {
            core.dismissed = core.progress.as_ref().map(|p| p.job.id);
            core.status_revision += 1;
        } else {
            core.selection.release();
        }
    }
    window.hide().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn ui_ready(window: WebviewWindow, rt: tauri::State<Runtime>) -> Result<(), String> {
    trusted(&window, &["overlay", "status", "companion"])?;
    if window.label() == "companion" {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    rt.broadcast();
    Ok(())
}

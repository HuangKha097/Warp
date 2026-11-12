//! Only compiled into the explicit smoke-test build, never the distributable app.
use crate::{
    model::now,
    runtime::{smoke_path, Runtime},
    watcher::WatchEvent,
};
use serde_json::{json, Value};
use std::{fs, path::Path, sync::atomic::Ordering};
use tauri::WebviewWindow;

#[tauri::command]
pub fn smoke_step(
    window: WebviewWindow,
    rt: tauri::State<Runtime>,
    action: String,
    value: Option<Value>,
) -> Result<Value, String> {
    if !["overlay", "status", "companion"].contains(&window.label()) {
        return Err("UNTRUSTED_SENDER".into());
    }
    let report = smoke_path().ok_or("NO_SMOKE_REPORT")?;
    let read_report = || {
        fs::read_to_string(&report)
            .ok()
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            .unwrap_or_else(|| json!({"checks":{}}))
    };
    match action.as_str() {
        "context" => {
            let destination = rt.data.join("output");
            fs::create_dir_all(&destination).map_err(|e| e.to_string())?;
            Ok(json!({"output":destination,"report":read_report()}))
        }
        "select" if window.label() == "overlay" => {
            let file = rt.data.join("tài liệu.txt");
            fs::write(&file, "Warp Tauri smoke test\nOriginal remains unchanged.")
                .map_err(|e| e.to_string())?;
            rt.watch(WatchEvent {
                held: true,
                gesture: Some(900),
                ..Default::default()
            });
            let monitor = rt
                .app
                .primary_monitor()
                .map_err(|e| e.to_string())?
                .ok_or("NO_MONITOR")?;
            let area = monitor.work_area();
            rt.watch(WatchEvent {
                file: Some(file.to_string_lossy().into_owned()),
                x: Some((area.position.x + area.size.width as i32 / 2) as f64),
                y: Some((area.position.y + area.size.height as i32 / 2) as f64),
                gesture: Some(900),
                ..Default::default()
            });
            Ok(json!(rt.state()))
        }
        "check" => {
            let value = value.ok_or("MISSING_CHECK")?;
            let name = value["name"].as_str().ok_or("MISSING_CHECK_NAME")?;
            let mut result = read_report();
            result["checks"][name] = value["value"].clone();
            result["updatedAt"] = now().into();
            if let Some(parent) = report.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(report, serde_json::to_string_pretty(&result).unwrap())
                .map_err(|e| e.to_string())?;
            Ok(json!(true))
        }
        "finish" if window.label() == "overlay" => {
            let state = rt.state();
            let job = state.job.ok_or("NO_CONVERSION")?;
            let output = job.job.output.ok_or("NO_OUTPUT")?;
            if job.job.status != "success"
                || !fs::read(&output)
                    .map_err(|e| e.to_string())?
                    .starts_with(b"%PDF-")
            {
                return Err("INVALID_PDF".into());
            }
            if !Path::new(&output).starts_with(rt.data.join("output")) {
                return Err("WRONG_DESTINATION".into());
            }
            if !fs::read_to_string(rt.data.join("tài liệu.txt"))
                .map_err(|e| e.to_string())?
                .contains("Original remains unchanged")
            {
                return Err("SOURCE_CHANGED".into());
            }
            let mut result = read_report();
            result["ok"] = true.into();
            result["output"] = output.into();
            fs::write(report, serde_json::to_string_pretty(&result).unwrap())
                .map_err(|e| e.to_string())?;
            let runtime = rt.inner().clone();
            tauri::async_runtime::spawn_blocking(move || {
                runtime.join();
                runtime.app.exit(0);
            });
            Ok(json!(true))
        }
        "fail" => {
            let mut result = read_report();
            result["ok"] = false.into();
            result["error"] = value.unwrap_or(Value::Null);
            fs::write(report, serde_json::to_string_pretty(&result).unwrap())
                .map_err(|e| e.to_string())?;
            rt.stopped.store(true, Ordering::SeqCst);
            rt.app.exit(1);
            Ok(json!(false))
        }
        _ => Err("INVALID_SMOKE_ACTION".into()),
    }
}

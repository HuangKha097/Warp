#[cfg(windows)]
fn key() -> Result<winreg::RegKey, String> {
    use winreg::{enums::*, RegKey};
    RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")
        .map(|(key, _)| key)
        .map_err(|e| e.to_string())
}
#[cfg(windows)]
pub fn enabled() -> bool {
    key()
        .ok()
        .and_then(|k| k.get_value::<String, _>("Warp").ok())
        .is_some()
}
#[cfg(windows)]
pub fn set(enabled: bool) -> Result<(), String> {
    let key = key()?;
    if enabled {
        let executable = std::env::current_exe().map_err(|e| e.to_string())?;
        key.set_value(
            "Warp",
            &format!("\"{}\" --background", executable.display()),
        )
        .map_err(|e| e.to_string())
    } else {
        match key.delete_value("Warp") {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}
#[cfg(not(windows))]
pub fn enabled() -> bool {
    false
}
#[cfg(not(windows))]
pub fn set(_: bool) -> Result<(), String> {
    Err("STARTUP_WINDOWS_ONLY".into())
}

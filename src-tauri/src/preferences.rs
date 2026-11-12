use crate::model::{now, Preferences};
use serde_json::Value;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub struct Store {
    pub file: PathBuf,
    pub value: Preferences,
    pub existed: bool,
}
pub fn writable_directory(path: &Path) -> Result<(), String> {
    if !path.is_absolute() || !path.is_dir() {
        return Err("INVALID_DIRECTORY".into());
    }
    tempfile::NamedTempFile::new_in(path)
        .map(|_| ())
        .map_err(|_| "INVALID_DIRECTORY".into())
}
impl Store {
    pub fn load(file: PathBuf, locale: &str) -> Result<Self, String> {
        let defaults = Preferences::defaults(locale);
        let mut store = Self {
            existed: file.exists(),
            file,
            value: defaults.clone(),
        };
        match fs::read_to_string(&store.file) {
            Ok(text) => match serde_json::from_str::<Value>(&text) {
                Ok(p) => {
                    if let Some(lang @ ("vi" | "en")) = p["language"].as_str() {
                        store.value.language = lang.into();
                    }
                    store.value.launch_at_login = p["launchAtLogin"]
                        .as_bool()
                        .unwrap_or(defaults.launch_at_login);
                    store.value.output_directory = p["outputDirectory"]
                        .as_str()
                        .filter(|p| Path::new(p).is_absolute())
                        .map(str::to_owned);
                    if p["outputMode"] == "custom" && store.value.output_directory.is_some() {
                        store.value.output_mode = "custom".into();
                    }
                    store.value.onboarding_completed = p["onboardingCompleted"] == true;
                }
                Err(_) => {
                    fs::rename(
                        &store.file,
                        store.file.with_extension(format!("json.invalid-{}", now())),
                    )
                    .map_err(|e| e.to_string())?;
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.to_string()),
        }
        Ok(store)
    }
    pub fn patched(&self, patch: Value) -> Result<Preferences, String> {
        let p = patch.as_object().ok_or("INVALID_SETTINGS")?;
        if p.keys().any(|k| {
            !["language", "launchAtLogin", "outputMode", "outputDirectory"].contains(&k.as_str())
        }) {
            return Err("INVALID_SETTINGS".into());
        }
        let mut next = self.value.clone();
        if let Some(v) = p.get("language") {
            next.language = match v.as_str() {
                Some(v @ ("vi" | "en")) => v.into(),
                _ => return Err("INVALID_SETTINGS".into()),
            };
        }
        if let Some(v) = p.get("launchAtLogin") {
            next.launch_at_login = v.as_bool().ok_or("INVALID_SETTINGS")?;
        }
        if let Some(v) = p.get("outputMode") {
            next.output_mode = match v.as_str() {
                Some(v @ ("source" | "custom")) => v.into(),
                _ => return Err("INVALID_SETTINGS".into()),
            };
        }
        if let Some(v) = p.get("outputDirectory") {
            next.output_directory = if v.is_null() {
                None
            } else {
                Some(
                    v.as_str()
                        .filter(|v| Path::new(v).is_absolute())
                        .ok_or("INVALID_DIRECTORY")?
                        .into(),
                )
            };
        }
        if next.output_mode == "custom"
            && (p.contains_key("outputMode") || p.contains_key("outputDirectory"))
        {
            writable_directory(Path::new(
                next.output_directory.as_ref().ok_or("CHOOSE_DIRECTORY")?,
            ))?;
        }
        Ok(next)
    }
    pub fn save(&mut self, next: Preferences) -> Result<(), String> {
        let parent = self.file.parent().ok_or("INVALID_DIRECTORY")?;
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
        let mut json = serde_json::to_value(&next).map_err(|e| e.to_string())?;
        json["schemaVersion"] = 1.into();
        file.write_all(serde_json::to_string_pretty(&json).unwrap().as_bytes())
            .map_err(|e| e.to_string())?;
        file.as_file().sync_all().map_err(|e| e.to_string())?;
        file.persist(&self.file).map_err(|e| e.to_string())?;
        self.value = next;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn migrates_electron_preferences_and_updates_atomically() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, json!({"schemaVersion":1,"language":"en","launchAtLogin":false,"onboardingCompleted":true,"outputMode":"source","outputDirectory":null}).to_string()).unwrap();
        let mut store = Store::load(path.clone(), "vi").unwrap();
        assert!(store.existed && store.value.onboarding_completed);
        assert!(!store.value.launch_at_login);
        let next = store.patched(json!({"language":"vi"})).unwrap();
        store.save(next).unwrap();
        store
            .save(
                store
                    .patched(json!({"outputMode":"custom","outputDirectory":dir.path()}))
                    .unwrap(),
            )
            .unwrap();
        assert_eq!(Store::load(path, "en").unwrap().value.language, "vi");
        assert_eq!(store.value.output_mode, "custom");
    }
    #[test]
    fn rejects_untrusted_settings_and_preserves_corrupt_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("settings.json");
        fs::write(&path, "{broken").unwrap();
        let store = Store::load(path.clone(), "vi").unwrap();
        assert!(!path.exists());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
        for patch in [
            json!([]),
            json!({"onboardingCompleted":true}),
            json!({"language":"fr"}),
            json!({"launchAtLogin":1}),
            json!({"outputDirectory":"relative"}),
            json!({"outputMode":"custom"}),
        ] {
            assert!(store.patched(patch).is_err());
        }
    }
}

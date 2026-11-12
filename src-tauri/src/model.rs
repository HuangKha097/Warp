use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub language: String,
    pub launch_at_login: bool,
    pub output_mode: String,
    pub output_directory: Option<String>,
    pub onboarding_completed: bool,
}
impl Preferences {
    pub fn defaults(locale: &str) -> Self {
        Self {
            language: if locale.to_lowercase().starts_with("vi") {
                "vi"
            } else {
                "en"
            }
            .into(),
            launch_at_login: true,
            output_mode: "source".into(),
            output_directory: None,
            onboarding_completed: false,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: u64,
    pub input: String,
    pub target: String,
    pub status: String,
    pub phase: String,
    pub started_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_directory: Option<String>,
}
impl Job {
    pub fn active(&self) -> bool {
        self.status == "queued" || self.status == "running"
    }
}
#[derive(Clone, Debug, Serialize)]
pub struct Failure {
    pub name: String,
    pub error: String,
}
#[derive(Clone, Debug, Serialize)]
pub struct Progress {
    #[serde(flatten)]
    pub job: Job,
    pub name: String,
    pub queued: usize,
    pub completed: usize,
    pub failures: Vec<Failure>,
}
#[derive(Clone, Copy, Debug, Serialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub file: Option<String>,
    pub path: Option<String>,
    pub targets: Vec<String>,
    pub busy: bool,
    pub helper_ready: bool,
    pub anchor: Point,
    pub presentation: u64,
    pub job: Option<Progress>,
    pub language: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsState {
    pub preferences: Preferences,
    pub version: String,
    pub install_directory: String,
    pub settings_file: String,
    pub packaged: bool,
}
pub fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
pub fn basename(file: &str) -> String {
    std::path::Path::new(file)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned()
}

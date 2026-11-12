#[cfg(feature = "desktop")]
use crate::{
    conversion::{hidden, kill_tree},
    runtime::Runtime,
};
use serde::Deserialize;
use std::time::{Duration, Instant};
#[cfg(feature = "desktop")]
use std::{
    io::{BufRead, BufReader},
    path::Path,
    process::{Command, Stdio},
    sync::{atomic::Ordering, mpsc},
    thread,
};

#[derive(Default, Debug, Deserialize)]
pub struct WatchEvent {
    #[serde(default)]
    pub ready: bool,
    #[serde(default)]
    pub heartbeat: bool,
    #[serde(default)]
    pub held: bool,
    #[serde(default)]
    pub released: bool,
    pub gesture: Option<u64>,
    pub file: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub error: Option<String>,
}
#[derive(Default)]
pub struct Selection {
    pub file: Option<String>,
    pub gesture: u64,
    pub held: bool,
}
impl Selection {
    pub fn press(&mut self, gesture: u64) {
        self.gesture = gesture;
        self.held = true;
    }
    pub fn release(&mut self) {
        self.held = false;
    }
    pub fn accepts(&self, gesture: Option<u64>) -> bool {
        self.held && gesture == Some(self.gesture)
    }
}
#[derive(Default)]
struct Watchdog {
    capture: Option<(u64, Instant)>,
}
impl Watchdog {
    fn event(&mut self, event: &WatchEvent) {
        if event.held {
            self.capture = Some((event.gesture.unwrap_or(0), Instant::now()));
        }
        if event.released
            || ((event.file.is_some() || event.error.is_some())
                && self
                    .capture
                    .is_some_and(|(id, _)| Some(id) == event.gesture))
        {
            self.capture = None;
        }
    }
    fn stalled(&self) -> bool {
        self.capture
            .is_some_and(|(_, time)| time.elapsed() > Duration::from_millis(3500))
    }
}
#[cfg(feature = "desktop")]
pub fn supervise(runtime: Runtime, executable: &Path) {
    while !runtime.stopped.load(Ordering::SeqCst) {
        let result = hidden(Command::new(executable).arg(std::process::id().to_string()))
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn();
        if let Ok(mut child) = result {
            let stdout = child.stdout.take().unwrap();
            let (tx, rx) = mpsc::channel();
            thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    if let Ok(event) = serde_json::from_str::<WatchEvent>(&line) {
                        if tx.send(event).is_err() {
                            break;
                        }
                    }
                }
            });
            let mut last = Instant::now();
            let mut watchdog = Watchdog::default();
            while !runtime.stopped.load(Ordering::SeqCst) {
                match rx.recv_timeout(Duration::from_millis(50)) {
                    Ok(event) => {
                        last = Instant::now();
                        watchdog.event(&event);
                        if !event.heartbeat {
                            runtime.watch(event);
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                    Err(_) => {}
                }
                if last.elapsed() > Duration::from_secs(6)
                    || watchdog.stalled()
                    || child.try_wait().ok().flatten().is_some()
                {
                    break;
                }
            }
            kill_tree(&mut child);
        }
        if !runtime.stopped.load(Ordering::SeqCst) {
            runtime.reset_watcher();
            thread::sleep(Duration::from_millis(400));
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn releasing_or_new_gesture_invalidates_late_capture() {
        let mut s = Selection::default();
        s.press(1);
        assert!(s.accepts(Some(1)));
        s.release();
        assert!(!s.accepts(Some(1)));
        s.press(2);
        assert!(!s.accepts(Some(1)));
        assert!(s.accepts(Some(2)));
    }
    #[test]
    fn old_capture_cannot_clear_new_watchdog() {
        let mut w = Watchdog::default();
        w.event(&WatchEvent {
            held: true,
            gesture: Some(2),
            ..Default::default()
        });
        w.event(&WatchEvent {
            file: Some("old.docx".into()),
            gesture: Some(1),
            ..Default::default()
        });
        assert!(w.capture.is_some());
        w.event(&WatchEvent {
            released: true,
            ..Default::default()
        });
        assert!(w.capture.is_none());
    }
}

use std::{
    fs::{self, OpenOptions},
    io,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};

pub fn hidden(command: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    command
}
pub fn targets(file: &Path) -> Vec<String> {
    let extension = file
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    let values: &[&str] = match extension.as_str() {
        "docx" => &["pdf", "txt", "odt"],
        "doc" => &["pdf", "txt", "docx"],
        "odt" | "rtf" => &["pdf", "docx", "txt"],
        "txt" => &["pdf", "docx", "odt"],
        "xlsx" => &["pdf", "csv", "ods"],
        "xls" => &["pdf", "csv", "xlsx"],
        "ods" => &["pdf", "csv", "xlsx"],
        "csv" => &["pdf", "xlsx", "ods"],
        "pptx" => &["pdf", "odp"],
        "ppt" => &["pdf", "pptx", "odp"],
        "odp" => &["pdf", "pptx"],
        _ => &[],
    };
    values.iter().map(|s| (*s).into()).collect()
}
pub fn find_office(root: &Path) -> Option<PathBuf> {
    std::iter::once(root.join("program/soffice.com"))
        .chain(
            ["ProgramFiles", "ProgramFiles(x86)"]
                .iter()
                .filter_map(std::env::var_os)
                .map(|p| PathBuf::from(p).join("LibreOffice/program/soffice.com")),
        )
        .chain(std::env::var_os("PATH").into_iter().flat_map(|p| {
            std::env::split_paths(&p)
                .map(|p| p.join("soffice.com"))
                .collect::<Vec<_>>()
        }))
        .find(|p| p.is_file())
}
pub fn io_error(e: io::Error) -> String {
    match e.kind() {
        io::ErrorKind::NotFound => {
            "Không tìm thấy tệp nguồn. Tệp có thể đã bị di chuyển hoặc xóa.".into()
        }
        io::ErrorKind::PermissionDenied => {
            "Không có quyền đọc tệp hoặc ghi bản chuyển đổi vào thư mục này.".into()
        }
        _ if e.raw_os_error() == Some(112) => {
            "Ổ đĩa không đủ dung lượng để tạo bản chuyển đổi.".into()
        }
        _ => e.to_string(),
    }
}
pub fn copy_unique(
    source: &Path,
    original: &Path,
    target: &str,
    directory: Option<&Path>,
) -> Result<PathBuf, String> {
    let directory = directory
        .or_else(|| original.parent())
        .ok_or("INVALID_DIRECTORY")?;
    let name = original.file_stem().unwrap_or_default().to_string_lossy();
    for i in 0..10000 {
        let suffix = if i == 0 {
            String::new()
        } else {
            format!(" ({i})")
        };
        let destination = directory.join(format!("{name}{suffix}.{target}"));
        if destination
            .to_string_lossy()
            .eq_ignore_ascii_case(&original.to_string_lossy())
        {
            continue;
        }
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&destination)
        {
            Ok(mut output) => {
                let result =
                    fs::File::open(source).and_then(|mut input| io::copy(&mut input, &mut output));
                drop(output);
                if let Err(e) = result {
                    let _ = fs::remove_file(&destination);
                    return Err(io_error(e));
                }
                return Ok(destination);
            }
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(io_error(e)),
        }
    }
    Err("Có quá nhiều file trùng tên.".into())
}
pub fn kill_tree(child: &mut std::process::Child) {
    if matches!(child.try_wait(), Ok(Some(_))) {
        return;
    }
    #[cfg(windows)]
    {
        let _ = hidden(Command::new("taskkill.exe").args([
            "/pid",
            &child.id().to_string(),
            "/t",
            "/f",
        ]))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}
pub fn convert(
    original: &Path,
    target: &str,
    office: &Path,
    directory: Option<&Path>,
    stopped: &AtomicBool,
    progress: impl Fn(&str),
) -> Result<PathBuf, String> {
    let cancelled = || {
        if stopped.load(Ordering::SeqCst) {
            Err("Đã hủy chuyển đổi khi thoát Warp.".to_owned())
        } else {
            Ok(())
        }
    };
    cancelled()?;
    progress("preparing");
    if !targets(original).iter().any(|t| t == target) {
        return Err("Định dạng chuyển đổi không được hỗ trợ.".into());
    }
    if !fs::metadata(original).map_err(io_error)?.is_file() {
        return Err("Vui lòng chọn một file.".into());
    }
    if let Some(p) = directory {
        crate::preferences::writable_directory(p)?;
    }
    let temp = tempfile::Builder::new()
        .prefix("warp-")
        .tempdir()
        .map_err(io_error)?;
    let input_dir = temp.path().join("input");
    let output_dir = temp.path().join("output");
    fs::create_dir(&input_dir).map_err(io_error)?;
    fs::create_dir(&output_dir).map_err(io_error)?;
    let input = input_dir.join(original.file_name().ok_or("INVALID_FILE")?);
    fs::copy(original, &input).map_err(io_error)?;
    cancelled()?;
    progress("converting");
    let profile = url::Url::from_directory_path(temp.path().join("profile"))
        .map_err(|_| "INVALID_DIRECTORY")?;
    let log_path = temp.path().join("office.log");
    let log = fs::File::create(&log_path).map_err(io_error)?;
    let mut child = hidden(
        Command::new(office)
            .arg(format!("-env:UserInstallation={profile}"))
            .args([
                "--headless",
                "--convert-to",
                if target == "txt" {
                    "txt:Text (encoded):UTF8"
                } else {
                    target
                },
                "--outdir",
            ])
            .arg(&output_dir)
            .arg(&input),
    )
    .stdin(Stdio::null())
    .stdout(Stdio::from(log.try_clone().map_err(io_error)?))
    .stderr(Stdio::from(log))
    .spawn()
    .map_err(io_error)?;
    let started = Instant::now();
    loop {
        if let Err(e) = cancelled() {
            kill_tree(&mut child);
            return Err(e);
        }
        if started.elapsed() > Duration::from_secs(120) {
            kill_tree(&mut child);
            return Err("Chuyển đổi quá 2 phút. Hãy thử file nhỏ hơn.".into());
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Err(format!(
                        "Không thể chuyển đổi tài liệu ({}).",
                        status.code().unwrap_or(-1)
                    ));
                }
                break;
            }
            Ok(None) => thread::sleep(Duration::from_millis(40)),
            Err(e) => {
                kill_tree(&mut child);
                return Err(io_error(e));
            }
        }
    }
    let output = fs::read_dir(&output_dir)
        .map_err(io_error)?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .find(|p| {
            p.extension()
                .is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case(target))
                && p.metadata().is_ok_and(|m| m.is_file() && m.len() > 0)
        })
        .ok_or("Bộ chuyển đổi không tạo được file. File có thể bị khóa, hỏng hoặc có mật khẩu.")?;
    cancelled()?;
    progress("saving");
    if let Some(p) = directory {
        crate::preferences::writable_directory(p)?;
    }
    copy_unique(&output, original, target, directory)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_original_and_existing_output_even_under_concurrent_saves() {
        let dir = tempfile::tempdir().unwrap();
        let original = dir.path().join("tài liệu.txt");
        let output = dir.path().join("tài liệu.pdf");
        fs::write(&original, "original").unwrap();
        fs::write(&output, "existing").unwrap();
        let input = dir.path().join("converted");
        fs::write(&input, "converted").unwrap();
        thread::scope(|scope| {
            let handles: Vec<_> = (0..6)
                .map(|_| scope.spawn(|| copy_unique(&input, &original, "pdf", None).unwrap()))
                .collect();
            let paths: std::collections::HashSet<_> =
                handles.into_iter().map(|h| h.join().unwrap()).collect();
            assert_eq!(paths.len(), 6);
        });
        assert_eq!(fs::read_to_string(original).unwrap(), "original");
        assert_eq!(fs::read_to_string(output).unwrap(), "existing");
        assert_eq!(targets(Path::new("test.DOCX")), ["pdf", "txt", "odt"]);
        assert!(targets(Path::new("test.pdf")).is_empty());
    }
    #[test]
    fn cancelled_jobs_never_start_a_converter() {
        let stopped = AtomicBool::new(true);
        assert!(convert(
            Path::new("missing.docx"),
            "pdf",
            Path::new("missing.exe"),
            None,
            &stopped,
            |_| {}
        )
        .unwrap_err()
        .contains("hủy"));
    }
}

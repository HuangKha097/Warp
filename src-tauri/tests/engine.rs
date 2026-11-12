use std::{fs, path::PathBuf, sync::atomic::AtomicBool};
use warp_lib::conversion::{convert, find_office};

#[test]
#[ignore = "requires the pinned Windows LibreOffice runtime"]
fn real_txt_pdf_roundtrip_preserves_source_and_existing_files() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("vendor/libreoffice");
    let office = find_office(&root).expect("run npm run prepare:engine first");
    let dir = tempfile::tempdir().unwrap();
    let destination = dir.path().join("đầu ra");
    fs::create_dir(&destination).unwrap();
    let input = dir.path().join("tài liệu.txt");
    fs::write(
        &input,
        "Warp Tauri conversion test\nOriginal remains unchanged.",
    )
    .unwrap();
    fs::write(destination.join("tài liệu.pdf"), "existing").unwrap();
    let stopped = AtomicBool::new(false);
    let output = convert(&input, "pdf", &office, Some(&destination), &stopped, |_| {}).unwrap();
    assert_eq!(output.file_name().unwrap(), "tài liệu (1).pdf");
    assert!(fs::read(&output).unwrap().starts_with(b"%PDF-"));
    assert_eq!(
        fs::read_to_string(destination.join("tài liệu.pdf")).unwrap(),
        "existing"
    );
    assert!(fs::read_to_string(&input)
        .unwrap()
        .contains("Original remains unchanged"));
    let docx = convert(&input, "docx", &office, None, &stopped, |_| {}).unwrap();
    assert!(fs::read(docx).unwrap().starts_with(b"PK"));
}

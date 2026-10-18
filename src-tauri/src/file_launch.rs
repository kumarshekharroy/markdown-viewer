use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_fs::FsExt;

#[derive(Default)]
pub struct PendingFiles(Mutex<Vec<String>>);

#[tauri::command]
pub fn take_opened_files(state: State<'_, PendingFiles>) -> Vec<String> {
    std::mem::take(&mut *state.inner().0.lock().unwrap_or_else(|error| error.into_inner()))
}

pub fn paths_from_args(args: impl Iterator<Item = String>, cwd: &Path) -> Vec<PathBuf> {
    args.filter_map(|arg| {
        if arg.starts_with('-') {
            return None;
        }
        let path = if arg.starts_with("file:") {
            tauri::Url::parse(&arg).ok()?.to_file_path().ok()?
        } else if arg.contains("://") {
            return None;
        } else {
            PathBuf::from(arg)
        };
        Some(if path.is_absolute() { path } else { cwd.join(path) })
    })
    .collect()
}

fn supported_file(path: &Path) -> Option<PathBuf> {
    let path = path.canonicalize().ok()?;
    if !path.is_file() {
        return None;
    }
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    ["md", "markdown", "mdown", "txt"]
        .contains(&extension.as_str())
        .then_some(path)
}

pub fn enqueue_files(app: &AppHandle, paths: impl IntoIterator<Item = PathBuf>) {
    let state = app.state::<PendingFiles>();
    let mut pending = state.inner().0.lock().unwrap_or_else(|error| error.into_inner());
    for path in paths {
        let Some(path) = supported_file(&path) else { continue };
        // Permit exactly the selected file, never its containing directory.
        if app.fs_scope().allow_file(&path).is_err() {
            continue;
        }
        let path = path.to_string_lossy().into_owned();
        if !pending.contains(&path) {
            pending.push(path);
        }
    }
    let has_files = !pending.is_empty();
    drop(pending);
    if has_files {
        // The queue remains available if React is still restoring its workspace.
        let _ = app.emit("desktop-files-opened", ());
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_file_urls_and_relative_paths_without_accepting_flags_or_network_urls() {
        let cwd = std::env::temp_dir();
        let file = cwd.join("notes with spaces.md");
        let url = tauri::Url::from_file_path(&file).unwrap();
        let args = [
            "--debug".to_string(),
            "https://example.com/note.md".to_string(),
            "relative.md".to_string(),
            url.to_string(),
        ];
        assert_eq!(
            paths_from_args(args.into_iter(), &cwd),
            vec![cwd.join("relative.md"), file]
        );
    }

    #[test]
    fn only_accepts_existing_supported_files() {
        let directory = std::env::temp_dir().join(format!(
            "markdown-viewer-file-launch-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&directory).unwrap();
        let markdown = directory.join("note.MD");
        let other = directory.join("image.png");
        std::fs::write(&markdown, "# Test").unwrap();
        std::fs::write(&other, "not Markdown").unwrap();
        assert_eq!(supported_file(&markdown), Some(markdown.canonicalize().unwrap()));
        assert!(supported_file(&other).is_none());
        assert!(supported_file(&directory).is_none());
        assert!(supported_file(&directory.join("missing.md")).is_none());
        std::fs::remove_dir_all(directory).unwrap();
    }
}

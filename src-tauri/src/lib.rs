mod file_launch;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .manage(file_launch::PendingFiles::default())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            file_launch::enqueue_files(
                app,
                file_launch::paths_from_args(args.into_iter().skip(1), std::path::Path::new(&cwd)),
            );
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![file_launch::take_opened_files])
        .setup(|app| {
            // Explorer supplies file paths as arguments on the first launch.
            #[cfg(windows)]
            file_launch::enqueue_files(
                app.handle(),
                file_launch::paths_from_args(
                    std::env::args_os()
                        .skip(1)
                        .map(|arg| arg.to_string_lossy().into_owned()),
                    &std::env::current_dir()?,
                ),
            );
            #[cfg(not(windows))]
            let _ = app;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Markdown Viewer")
        .run(|app, event| {
            // Finder sends file URLs, including when the app is already running.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                file_launch::enqueue_files(
                    app,
                    urls.into_iter().filter_map(|url| url.to_file_path().ok()),
                );
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}

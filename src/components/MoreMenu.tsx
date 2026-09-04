import {
  Download,
  FilePlus2,
  Files,
  FolderOpen,
  Info,
  MoreHorizontal,
  Printer,
  RotateCcw,
  Save,
  Settings,
  Upload
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface MoreMenuProps {
  canDirectSave: boolean;
  dirty: boolean;
  onNew: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenFolder: () => void;
  onCopyRaw: () => void;
  onCopyRendered: () => void;
  onDownloadHtml: () => void;
  onPrint: () => void;
  onLoadUrl: () => void;
  onPaste: () => void;
  onExample: () => void;
  onSettings: () => void;
  onPrivacy: () => void;
  onClearData: () => void;
}

export function MoreMenu({
  canDirectSave,
  dirty,
  onNew,
  onSave,
  onSaveAs,
  onOpenFolder,
  onCopyRaw,
  onCopyRendered,
  onDownloadHtml,
  onPrint,
  onLoadUrl,
  onPaste,
  onExample,
  onSettings,
  onPrivacy,
  onClearData
}: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [open]);

  return (
    <div className="more-menu" ref={menuRef}>
      <button
        className="icon-button tooltip-button"
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-tooltip="More actions"
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open ? (
        <div className="menu-popover">
          <button type="button" onClick={() => run(onNew)}>
            <FilePlus2 size={16} aria-hidden="true" />
            New Markdown file
          </button>
          <hr />
          <button type="button" onClick={() => run(onSave)}>
            <Save size={16} aria-hidden="true" />
            {canDirectSave ? 'Save' : dirty ? 'Download updated file' : 'Download file'}
          </button>
          <button type="button" onClick={() => run(onSaveAs)}>
            <Download size={16} aria-hidden="true" />
            Save As
          </button>
          <button type="button" onClick={() => run(onOpenFolder)}>
            <FolderOpen size={16} aria-hidden="true" />
            Open folder
          </button>
          <button type="button" onClick={() => run(onLoadUrl)}>
            <Upload size={16} aria-hidden="true" />
            Load URL
          </button>
          <button type="button" onClick={() => run(onPaste)}>
            <Upload size={16} aria-hidden="true" />
            Paste Markdown
          </button>
          <button type="button" onClick={() => run(onExample)}>
            <Files size={16} aria-hidden="true" />
            Load example
          </button>
          <hr />
          <button type="button" onClick={() => run(onCopyRaw)}>
            Copy raw Markdown
          </button>
          <button type="button" onClick={() => run(onCopyRendered)}>
            Copy rendered text
          </button>
          <button type="button" onClick={() => run(onDownloadHtml)}>
            Download rendered HTML
          </button>
          <button type="button" onClick={() => run(onPrint)}>
            <Printer size={16} aria-hidden="true" />
            Print
          </button>
          <hr />
          <button type="button" onClick={() => run(onSettings)}>
            <Settings size={16} aria-hidden="true" />
            Preferences
          </button>
          <button type="button" onClick={() => run(onPrivacy)}>
            <Info size={16} aria-hidden="true" />
            Privacy
          </button>
          <button type="button" onClick={() => run(onClearData)}>
            <RotateCcw size={16} aria-hidden="true" />
            Clear local data
          </button>
        </div>
      ) : null}
    </div>
  );
}

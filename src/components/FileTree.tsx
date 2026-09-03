import { ChevronDown, ChevronRight, FileText, Folder, TriangleAlert } from 'lucide-react';
import { memo } from 'react';
import type { FolderDocument } from '../types';
import type { FileTreeNode } from '../lib/fileTree';

export const FileTree = memo(function FileTreeView({
  nodes,
  expandedFolders,
  activePath,
  dirty,
  onToggleFolder,
  onOpenDocument
}: {
  nodes: FileTreeNode[];
  expandedFolders: Set<string>;
  activePath?: string;
  dirty: boolean;
  onToggleFolder: (path: string) => void;
  onOpenDocument: (document: FolderDocument) => void;
}) {
  return (
    <ul className="file-tree__list">
      {nodes.map((node) => {
        if (node.kind === 'folder') {
          const expanded = expandedFolders.has(node.path);
          return (
            <li key={node.path} className="file-tree__folder">
              <button
                className="file-tree__folder-button"
                type="button"
                onClick={() => onToggleFolder(node.path)}
                aria-expanded={expanded}
                aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`}
                title={node.path}
              >
                {expanded ? (
                  <ChevronDown className="file-tree__chevron" size={15} aria-hidden="true" />
                ) : (
                  <ChevronRight className="file-tree__chevron" size={15} aria-hidden="true" />
                )}
                <Folder className="file-tree__marker" size={16} aria-hidden="true" />
                <span>{node.name}</span>
              </button>
              {expanded ? (
                <FileTree
                  nodes={node.children}
                  expandedFolders={expandedFolders}
                  activePath={activePath}
                  dirty={dirty}
                  onToggleFolder={onToggleFolder}
                  onOpenDocument={onOpenDocument}
                />
              ) : null}
            </li>
          );
        }

        const isActive = node.document.path === activePath;
        return (
          <li key={node.document.path}>
            <button
              type="button"
              className={[isActive ? 'is-active' : '', dirty && isActive ? 'is-dirty' : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => onOpenDocument(node.document)}
              aria-current={isActive ? 'page' : undefined}
              title={
                dirty && isActive ? `${node.document.path} has unsaved changes` : node.document.path
              }
            >
              <span className="file-tree__indent" aria-hidden="true" />
              {dirty && isActive ? (
                <TriangleAlert
                  className="file-tree__marker"
                  size={15}
                  aria-label="Unsaved changes"
                />
              ) : (
                <FileText className="file-tree__marker" size={15} aria-hidden="true" />
              )}
              <span>{node.document.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
});

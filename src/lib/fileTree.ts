import type { FolderDocument } from '../types';

interface FileTreeFileNode {
  kind: 'file';
  document: FolderDocument;
}

interface FileTreeFolderNode {
  kind: 'folder';
  name: string;
  path: string;
  children: FileTreeNode[];
}

export type FileTreeNode = FileTreeFileNode | FileTreeFolderNode;

export function buildFileTree(documents: FolderDocument[], rootName: string): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const foldersByPath = new Map<string, FileTreeFolderNode>();

  for (const document of documents) {
    const pathParts = document.path.split('/').filter(Boolean);
    const includesRoot = pathParts[0] === rootName;
    const displayParts = includesRoot ? pathParts.slice(1) : pathParts;
    const parentParts = includesRoot ? [pathParts[0]] : [];
    let level = root;

    for (const folderName of displayParts.slice(0, -1)) {
      parentParts.push(folderName);
      const path = parentParts.join('/');
      let folderNode = foldersByPath.get(path);
      if (!folderNode) {
        folderNode = { kind: 'folder', name: folderName, path, children: [] };
        foldersByPath.set(path, folderNode);
        level.push(folderNode);
      }
      level = folderNode.children;
    }

    level.push({ kind: 'file', document });
  }

  sortFileTree(root);
  return root;
}

function sortFileTree(nodes: FileTreeNode[]): void {
  nodes.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1;
    const leftName = left.kind === 'folder' ? left.name : left.document.name;
    const rightName = right.kind === 'folder' ? right.name : right.document.name;
    return leftName.localeCompare(rightName, undefined, { sensitivity: 'base' });
  });
  nodes.forEach((node) => {
    if (node.kind === 'folder') sortFileTree(node.children);
  });
}

export function collectFolderPaths(nodes: FileTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.kind === 'folder' ? [node.path, ...collectFolderPaths(node.children)] : []
  );
}

export function getParentFolderPaths(filePath: string, rootName: string): string[] {
  const parts = filePath.split('/').filter(Boolean);
  const includesRoot = parts[0] === rootName;
  const result: string[] = [];
  const parentParts = includesRoot ? [parts[0]] : [];
  const displayParts = includesRoot ? parts.slice(1) : parts;

  for (const folderName of displayParts.slice(0, -1)) {
    parentParts.push(folderName);
    result.push(parentParts.join('/'));
  }
  return result;
}

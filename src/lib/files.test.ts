import { describe, expect, it } from 'vitest';
import { isLegacyUnsavedFolderEntry } from './files';
import type { FolderDocument } from '../types';

const legacyEntry: FolderDocument = {
  id: 'workspace/Untitled.md',
  name: 'Untitled',
  path: 'workspace/Untitled.md',
  content: ''
};

describe('folder file helpers', () => {
  it('recognizes legacy unsaved Untitled entries without treating real folder files as virtual', () => {
    expect(isLegacyUnsavedFolderEntry(legacyEntry)).toBe(true);
    expect(
      isLegacyUnsavedFolderEntry({
        ...legacyEntry,
        lastModified: 1
      })
    ).toBe(false);
    expect(
      isLegacyUnsavedFolderEntry({
        ...legacyEntry,
        content: '# Saved content'
      })
    ).toBe(false);
    expect(
      isLegacyUnsavedFolderEntry({
        ...legacyEntry,
        path: 'workspace/notes.md',
        name: 'notes'
      })
    ).toBe(false);
  });
});

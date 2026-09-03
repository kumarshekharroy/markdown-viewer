import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { PanelHeader, PanelResizer, type PanelSide } from './Panel';
import type { extractHeadings } from '../lib/markdown';
import type { SearchOptions } from '../types';

export function TocPanel({
  open,
  onClose,
  toc,
  activeHeading,
  searchOpen,
  searchInputRef,
  searchQuery,
  searchOptions,
  searchCursor,
  matchCount,
  onOpenSearch,
  onCloseSearch,
  onSearchQueryChange,
  onSearchOptionsChange,
  onMoveSearch,
  onNavigateHeading,
  onResizePointerDown,
  onResizeKeyDown
}: {
  open: boolean;
  onClose: () => void;
  toc: ReturnType<typeof extractHeadings>;
  activeHeading: string;
  searchOpen: boolean;
  searchInputRef: React.RefObject<HTMLInputElement>;
  searchQuery: string;
  searchOptions: SearchOptions;
  searchCursor: number;
  matchCount: number;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onSearchQueryChange: (value: string) => void;
  onSearchOptionsChange: React.Dispatch<React.SetStateAction<SearchOptions>>;
  onMoveSearch: (direction: 'next' | 'previous') => void;
  onNavigateHeading: (id: string) => void;
  onResizePointerDown: (side: PanelSide, event: React.PointerEvent) => void;
  onResizeKeyDown: (side: PanelSide, event: React.KeyboardEvent) => void;
}) {
  return (
    <aside
      id="contents-panel"
      className={`toc-panel ${open ? 'is-open' : ''}`}
      aria-label="Table of contents"
    >
      <PanelHeader
        title="Contents"
        onClose={onClose}
        actions={
          <button
            className="panel-action tooltip-button"
            type="button"
            onClick={searchOpen ? onCloseSearch : onOpenSearch}
            aria-label="Find in document"
            aria-expanded={searchOpen}
            data-tooltip="Find in document"
          >
            <Search size={17} aria-hidden="true" />
            <span>Find</span>
          </button>
        }
      />
      {searchOpen ? (
        <div className="toc-search-block">
          <section className="toc-search" aria-label="Document search">
            <label>
              <span className="visually-hidden">Search text</span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="Search this document"
              />
            </label>
            <div className="toc-search__controls">
              <span className="match-count">
                {matchCount === 0 ? 'No matches' : `${searchCursor || 1} of ${matchCount}`}
              </span>
              <button
                className="icon-button"
                type="button"
                onClick={() => onMoveSearch('previous')}
                aria-label="Previous match"
              >
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={() => onMoveSearch('next')}
                aria-label="Next match"
              >
                <ChevronRight size={17} aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                type="button"
                onClick={onCloseSearch}
                aria-label="Close search"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="toc-search__options">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={searchOptions.caseSensitive}
                  onChange={(event) =>
                    onSearchOptionsChange((current) => ({
                      ...current,
                      caseSensitive: event.target.checked
                    }))
                  }
                />
                Case
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={searchOptions.wholeWord}
                  onChange={(event) =>
                    onSearchOptionsChange((current) => ({
                      ...current,
                      wholeWord: event.target.checked
                    }))
                  }
                />
                Whole word
              </label>
            </div>
          </section>
        </div>
      ) : null}
      <nav className="toc-list" aria-label="Document headings">
        {toc.length === 0 ? (
          <p className="browser-note">Headings in the current document appear here.</p>
        ) : (
          toc.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault();
                onNavigateHeading(item.id);
              }}
              title={item.text}
              className={activeHeading === item.id ? 'is-active' : ''}
              style={{ paddingLeft: `${Math.max(0, item.level - 1) * 12 + 8}px` }}
            >
              {item.text}
            </a>
          ))
        )}
      </nav>
      <PanelResizer
        side="toc"
        label="Resize table of contents"
        onPointerDown={onResizePointerDown}
        onKeyDown={onResizeKeyDown}
      />
    </aside>
  );
}

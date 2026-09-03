import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import { Check, Copy, ExternalLink, ImageOff, Link as LinkIcon } from 'lucide-react';
import {
  createContext,
  createElement,
  memo,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState
} from 'react';
import ReactMarkdown, { type Components, type ExtraProps } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import type { Preferences, TocItem } from '../types';
import { isMarkdownLink, isSafeImageUrl, isSafeLinkUrl } from '../lib/markdown';
import { Dialog } from './Dialog';

interface MarkdownRendererProps {
  markdown: string;
  toc: TocItem[];
  preferences: Preferences;
  dark: boolean;
  currentPath?: string;
  resolveAsset: (src: string) => string | undefined;
  onNavigateLocal: (href: string) => void;
  articleRef: React.RefObject<HTMLElement>;
}

interface RenderContext {
  dark: boolean;
  codeWrap: boolean;
  currentPath?: string;
  resolveAsset: MarkdownRendererProps['resolveAsset'];
  onNavigateLocal: MarkdownRendererProps['onNavigateLocal'];
}
const RendererContext = createContext<RenderContext>({
  dark: false,
  codeWrap: false,
  resolveAsset: () => undefined,
  onNavigateLocal: () => undefined
});

export const MarkdownRenderer = memo(function MarkdownRenderer({
  markdown,
  toc,
  preferences,
  dark,
  currentPath,
  resolveAsset,
  onNavigateLocal,
  articleRef
}: MarkdownRendererProps) {
  const zoomScale = preferences.zoom / 100;
  const context = useMemo(
    () => ({ dark, codeWrap: preferences.codeWrap, currentPath, resolveAsset, onNavigateLocal }),
    [dark, preferences.codeWrap, currentPath, resolveAsset, onNavigateLocal]
  );
  useLayoutEffect(() => {
    articleRef.current?.querySelectorAll<HTMLElement>('.doc-heading').forEach((heading, index) => {
      if (toc[index]) heading.id = toc[index].id;
    });
  }, [articleRef, toc, markdown]);

  return (
    <RendererContext.Provider value={context}>
      <div
        className={`markdown-frame ${preferences.fullWidth ? 'markdown-frame--full' : ''}`}
        style={
          {
            '--reader-width': `${preferences.contentWidth}px`
          } as React.CSSProperties
        }
      >
        <article
          ref={articleRef}
          className={`markdown-body markdown-body--${preferences.fontChoice}`}
          style={
            {
              '--reader-font-size': `${preferences.fontSize}px`,
              '--reader-font-weight': String(preferences.fontWeight),
              '--reader-heading-weight': String(Math.min(900, preferences.fontWeight + 400)),
              '--reader-line-height': String(preferences.lineHeight),
              width: '100%',
              zoom: zoomScale
            } as React.CSSProperties
          }
        >
          <MarkdownContent markdown={markdown} />
        </article>
      </div>
    </RendererContext.Provider>
  );
});

// Component identities and plugin arrays never change. UI-only updates do not
// reparse Markdown or remount stateful diagrams, images and copy buttons.
const COMPONENTS: Components = {
  h1: createHeading(1),
  h2: createHeading(2),
  h3: createHeading(3),
  h4: createHeading(4),
  h5: createHeading(5),
  h6: createHeading(6),
  a: LinkRenderer,
  img: ImageRenderer,
  code: CodeRenderer,
  table: TableRenderer
};
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeSanitize, rehypeKatex];
const MarkdownContent = memo(function MarkdownContent({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={COMPONENTS}
    >
      {markdown}
    </ReactMarkdown>
  );
});

function createHeading(level: number) {
  return function Heading(allProps: React.HTMLAttributes<HTMLHeadingElement> & ExtraProps) {
    const { children, ...props } = withoutNode(allProps);
    const copyLink = async (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.closest('.doc-heading')?.id;
      if (id) await navigator.clipboard?.writeText(`${window.location.href.split('#')[0]}#${id}`);
    };
    return createElement(
      `h${level}`,
      { ...props, className: 'doc-heading' },
      <>
        <span>{children}</span>
        <button
          className="heading-anchor"
          type="button"
          onClick={copyLink}
          aria-label="Copy link to heading"
        >
          <LinkIcon size={15} aria-hidden="true" />
        </button>
      </>
    );
  };
}

function LinkRenderer(allProps: React.ComponentPropsWithoutRef<'a'> & ExtraProps) {
  const { href: originalHref = '', children, ...props } = withoutNode(allProps);
  // GFM already prefixes footnote IDs; sanitization adds its own safety prefix.
  // Keep that protection and point the generated reference/backlink at its target.
  const footnote = 'data-footnote-ref' in props || 'data-footnote-backref' in props;
  const href = footnote ? originalHref.replace(/^#/, '#user-content-') : originalHref;
  const { currentPath, onNavigateLocal } = useContext(RendererContext);
  if (!isSafeLinkUrl(href))
    return (
      <span className="blocked-link" title="Unsafe link blocked">
        {children}
      </span>
    );
  if (currentPath && isMarkdownLink(href)) {
    return (
      <a
        {...props}
        href={href}
        onClick={(event) => {
          event.preventDefault();
          onNavigateLocal(href);
        }}
      >
        {children}
      </a>
    );
  }
  const external = href && !href.startsWith('#') && !href.startsWith('/') && !href.startsWith('.');
  return (
    <a
      {...props}
      href={href}
      rel={external ? 'noopener noreferrer' : undefined}
      target={external ? '_blank' : undefined}
    >
      {children}
      {external ? <ExternalLink className="inline-link-icon" size={14} aria-hidden="true" /> : null}
    </a>
  );
}

function ImageRenderer({ src = '', alt = '', title }: React.ComponentPropsWithoutRef<'img'>) {
  const { resolveAsset } = useContext(RendererContext);
  return (
    <SafeImage
      key={resolveAsset(src) ?? src}
      src={src}
      alt={alt}
      title={title}
      resolveAsset={resolveAsset}
    />
  );
}

function CodeRenderer({ className, children }: React.ComponentPropsWithoutRef<'code'>) {
  const { dark, codeWrap } = useContext(RendererContext);
  const rawCode = String(children);
  const code = rawCode.replace(/\n$/, '');
  const language = /language-([\w-]+)/.exec(className ?? '')?.[1]?.toLowerCase();
  if (!className && !rawCode.includes('\n')) return <code className="inline-code">{children}</code>;
  if (language === 'mermaid') return <MermaidBlock chart={code} dark={dark} />;
  return <CodeBlock code={code} language={language} wrap={codeWrap} />;
}

function TableRenderer({ children }: React.ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="table-scroll" tabIndex={0}>
      <table>{children}</table>
    </div>
  );
}

function withoutNode<T extends object>(props: T & ExtraProps): Omit<T, 'node'> {
  const { node, ...attributes } = props;
  void node;
  return attributes;
}

interface CodeBlockProps {
  code: string;
  language?: string;
  wrap: boolean;
}

function CodeBlock({ code, language, wrap }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const highlighted = useMemo(() => {
    const known = language && hljs.getLanguage(language);
    const result = known
      ? hljs.highlight(code, { language, ignoreIllegals: true })
      : hljs.highlightAuto(code);
    return DOMPurify.sanitize(result.value, { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['class'] });
  }, [code, language]);

  const copy = async () => {
    await navigator.clipboard?.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={`code-block ${wrap ? 'code-block--wrap' : ''}`}>
      <div className="code-block__bar">
        <span>
          {language && hljs.getLanguage(language)
            ? language
            : language
              ? `${language} text`
              : 'code'}
        </span>
        <button className="mini-button" type="button" onClick={copy}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        {/* Sanitized Highlight.js HTML is the only reviewed innerHTML boundary in the renderer. */}
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

interface MermaidBlockProps {
  chart: string;
  dark: boolean;
}

function MermaidBlock({ chart, dark }: MermaidBlockProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    setSvg('');

    async function renderMermaid() {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: dark ? 'dark' : 'neutral',
          htmlLabels: false
        });
        const result = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled) {
          setSvg(DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } }));
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : 'Mermaid diagram could not be rendered.'
          );
        }
      }
    }

    renderMermaid();
    return () => {
      cancelled = true;
    };
  }, [chart, dark, id]);

  if (error) {
    return <div className="render-warning">Mermaid error: {error}</div>;
  }

  return (
    <div className="mermaid-block" aria-label="Mermaid diagram">
      {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <span>Rendering diagram...</span>}
    </div>
  );
}

interface SafeImageProps extends React.ComponentPropsWithoutRef<'img'> {
  resolveAsset: (src: string) => string | undefined;
}

function SafeImage({ src = '', alt = '', resolveAsset, ...props }: SafeImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState(false);
  const resolved = resolveAsset(src) ?? src;
  const safe = isSafeImageUrl(resolved);

  if (!safe) {
    return (
      <span className="image-placeholder" role="note">
        <ImageOff size={18} aria-hidden="true" />
        Image blocked
      </span>
    );
  }

  return (
    <figure className={`image-frame ${loaded ? 'is-loaded' : ''}`}>
      {!loaded && !error ? <span className="image-loading">Loading image...</span> : null}
      {error ? (
        <span className="image-placeholder" role="note">
          <ImageOff size={18} aria-hidden="true" />
          Image unavailable
        </span>
      ) : (
        <button
          className="image-button"
          type="button"
          onClick={() => setPreview(true)}
          aria-label="Open image preview"
        >
          <img
            {...props}
            src={resolved}
            alt={alt}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        </button>
      )}
      {alt ? <figcaption>{alt}</figcaption> : null}
      <Dialog
        open={preview}
        title={alt || 'Image preview'}
        onClose={() => setPreview(false)}
        className="image-dialog"
      >
        <img src={resolved} alt={alt} />
      </Dialog>
    </figure>
  );
}

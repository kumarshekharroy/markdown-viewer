import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import { Check, Copy, ExternalLink, ImageOff, Link as LinkIcon } from 'lucide-react';
import { createElement, useEffect, useId, useLayoutEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
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

export function MarkdownRenderer({
  markdown,
  toc,
  preferences,
  dark,
  currentPath,
  resolveAsset,
  onNavigateLocal,
  articleRef
}: MarkdownRendererProps) {
  const components = {
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

  useLayoutEffect(() => {
    const headings = articleRef.current?.querySelectorAll<HTMLElement>(
      'h1.doc-heading, h2.doc-heading, h3.doc-heading, h4.doc-heading, h5.doc-heading, h6.doc-heading'
    );
    headings?.forEach((heading, index) => {
      const item = toc[index];
      if (item) {
        heading.id = item.id;
      }
    });
  });

  function createHeading(level: number) {
    const tagName = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    return function Heading({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
      const copyLink = async (event: React.MouseEvent<HTMLButtonElement>) => {
        const id = event.currentTarget.closest('.doc-heading')?.id;
        if (!id) return;
        await navigator.clipboard?.writeText(`${window.location.href.split('#')[0]}#${id}`);
      };

      return createElement(
        tagName,
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

  function LinkRenderer({ href = '', children, ...props }: React.ComponentPropsWithoutRef<'a'>) {
    if (!isSafeLinkUrl(href)) {
      return (
        <span className="blocked-link" title="Unsafe link blocked">
          {children}
        </span>
      );
    }

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

    const external =
      href && !href.startsWith('#') && !href.startsWith('/') && !href.startsWith('.');
    return (
      <a
        {...props}
        href={href}
        rel={external ? 'noopener noreferrer' : undefined}
        target={external ? '_blank' : undefined}
      >
        {children}
        {external ? (
          <ExternalLink className="inline-link-icon" size={14} aria-hidden="true" />
        ) : null}
      </a>
    );
  }

  function ImageRenderer({ src = '', alt = '', ...props }: React.ComponentPropsWithoutRef<'img'>) {
    return <SafeImage {...props} src={src} alt={alt} resolveAsset={resolveAsset} />;
  }

  function CodeRenderer({
    inline,
    className,
    children,
    ...props
  }: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
    const rawCode = String(children);
    const isInline = inline === true || (!className && !rawCode.includes('\n'));
    const code = rawCode.replace(/\n$/, '');
    const language = /language-([\w-]+)/.exec(className ?? '')?.[1]?.toLowerCase();

    if (isInline) {
      return (
        <code {...props} className="inline-code">
          {children}
        </code>
      );
    }

    if (language === 'mermaid') {
      return <MermaidBlock chart={code} dark={dark} />;
    }

    return <CodeBlock code={code} language={language} wrap={preferences.codeWrap} />;
  }

  function TableRenderer({ children, ...props }: React.ComponentPropsWithoutRef<'table'>) {
    return (
      <div className="table-scroll" tabIndex={0}>
        <table {...props}>{children}</table>
      </div>
    );
  }

  return (
    <article
      ref={articleRef}
      className={`markdown-body markdown-body--${preferences.fontChoice}`}
      style={
        {
          '--reader-font-size': `${preferences.fontSize}px`,
          '--reader-line-height': String(preferences.lineHeight),
          '--reader-width': `${preferences.contentWidth}px`
        } as React.CSSProperties
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
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

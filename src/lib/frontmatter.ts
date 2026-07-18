import YAML from 'yaml';

export interface ParsedFrontMatter {
  body: string;
  raw?: string;
  data?: Record<string, unknown>;
  error?: string;
}

export function parseFrontMatter(markdown: string): ParsedFrontMatter {
  if (!markdown.startsWith('---')) {
    return { body: markdown };
  }

  const match = markdown.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/);
  if (!match) {
    return {
      body: markdown,
      raw: undefined,
      error:
        'The document appears to start with YAML front matter, but no closing marker was found.'
    };
  }

  const raw = match[0];
  const yamlSource = match[1] ?? '';
  try {
    const parsed = YAML.parse(yamlSource);
    return {
      body: markdown.slice(raw.length),
      raw,
      data: isRecord(parsed) ? parsed : {}
    };
  } catch (error) {
    return {
      body: markdown.slice(raw.length),
      raw,
      data: {},
      error: error instanceof Error ? error.message : 'Front matter could not be parsed.'
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

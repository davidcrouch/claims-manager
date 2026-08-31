'use client';

import { useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertCircle, AlertTriangle, Info, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuideMarkdownProps {
  content: string;
  className?: string;
  /** When true, show an in-document table of contents from ## headings. */
  showToc?: boolean;
}

type CalloutKind = 'note' | 'warning' | 'permission' | 'tip' | null;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function textFromNode(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join('');
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return textFromNode(props?.children);
  }
  return '';
}

function detectCallout(children: ReactNode): CalloutKind {
  const text = textFromNode(children).trim();
  if (/^(required permission|permission)\b/i.test(text)) return 'permission';
  if (/^warning\b/i.test(text)) return 'warning';
  if (/^tip\b/i.test(text)) return 'tip';
  if (/^(note|important)\b/i.test(text)) return 'note';
  return null;
}

function extractToc(markdown: string): Array<{ id: string; label: string }> {
  const toc: Array<{ id: string; label: string }> = [];
  const seen = new Set<string>();
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^##\s+(.+)$/);
    if (!match) continue;
    const label = match[1]!.replace(/[*_`]/g, '').trim();
    if (!label) continue;
    let id = slugify(label);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    toc.push({ id, label });
  }
  return toc;
}

const CALLOUT_STYLES: Record<
  Exclude<CalloutKind, null>,
  { wrap: string; icon: typeof Info; label: string }
> = {
  note: {
    wrap: 'border-sky-200 bg-sky-50/80 text-sky-950',
    icon: Info,
    label: 'Note',
  },
  tip: {
    wrap: 'border-emerald-200 bg-emerald-50/80 text-emerald-950',
    icon: Info,
    label: 'Tip',
  },
  warning: {
    wrap: 'border-amber-200 bg-amber-50/80 text-amber-950',
    icon: AlertTriangle,
    label: 'Warning',
  },
  permission: {
    wrap: 'border-violet-200 bg-violet-50/80 text-violet-950',
    icon: AlertCircle,
    label: 'Permission',
  },
};

/**
 * Professional document renderer for help guides and other long-form markdown
 * opened in the chat canvas.
 */
export function GuideMarkdown({ content, className, showToc = true }: GuideMarkdownProps) {
  const toc = useMemo(() => (showToc ? extractToc(content) : []), [content, showToc]);

  return (
    <div className={cn('guide-markdown bg-white text-slate-800', className)}>
      {toc.length >= 3 && (
        <nav
          aria-label="On this page"
          className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-8 py-4 backdrop-blur-sm"
        >
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <BookOpen className="h-3.5 w-3.5" />
            On this page
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-[13px] text-slate-600 underline-offset-2 transition-colors hover:text-slate-900 hover:underline"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <article className="mx-auto max-w-3xl px-8 py-8">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="mb-3 border-b border-slate-200 pb-4 text-[1.75rem] font-semibold tracking-tight text-slate-900">
                {children}
              </h1>
            ),
            h2: ({ children }) => {
              const label = textFromNode(children).replace(/[*_`]/g, '').trim();
              const id = slugify(label);
              return (
                <h2
                  id={id || undefined}
                  className="mb-3 mt-10 scroll-mt-28 text-lg font-semibold tracking-tight text-slate-900 first:mt-0"
                >
                  {children}
                </h2>
              );
            },
            h3: ({ children }) => (
              <h3 className="mb-2 mt-7 text-base font-semibold text-slate-900">{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-slate-700">
                {children}
              </h4>
            ),
            p: ({ children }) => (
              <p className="my-3 text-[15px] leading-7 text-slate-700">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="my-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-700 marker:text-slate-400">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="my-4 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-slate-700 marker:font-semibold marker:text-slate-500">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="pl-1">{children}</li>,
            strong: ({ children }) => (
              <strong className="font-semibold text-slate-900">{children}</strong>
            ),
            em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
            hr: () => <hr className="my-10 border-slate-200" />,
            a: ({ href, children, ...props }) => (
              <a
                href={href}
                target={href?.startsWith('#') ? undefined : '_blank'}
                rel={href?.startsWith('#') ? undefined : 'noopener noreferrer'}
                className="font-medium text-sky-700 underline decoration-sky-200 underline-offset-2 hover:text-sky-900 hover:decoration-sky-400"
                {...props}
              >
                {children}
              </a>
            ),
            blockquote: ({ children }) => {
              const kind = detectCallout(children);
              if (kind) {
                const style = CALLOUT_STYLES[kind];
                const Icon = style.icon;
                return (
                  <aside
                    className={cn(
                      'my-5 flex gap-3 rounded-lg border px-4 py-3.5 text-[14px] leading-6',
                      style.wrap,
                    )}
                    aria-label={style.label}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    <div className="min-w-0 [&_p]:my-1 [&_p]:text-[14px] [&_p]:leading-6 first:[&_p]:mt-0 last:[&_p]:mb-0">
                      {children}
                    </div>
                  </aside>
                );
              }
              return (
                <blockquote className="my-5 border-l-[3px] border-slate-300 pl-4 text-[15px] leading-7 text-slate-600">
                  {children}
                </blockquote>
              );
            },
            table: ({ children }) => (
              <div className="my-6 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-[13px] leading-5">
                    {children}
                  </table>
                </div>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-slate-50">{children}</thead>,
            tbody: ({ children }) => (
              <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
            ),
            tr: ({ children }) => <tr className="align-top">{children}</tr>,
            th: ({ children }) => (
              <th className="whitespace-nowrap px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-600">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="px-3.5 py-2.5 text-slate-700">{children}</td>
            ),
            pre: ({ children }) => (
              <pre className="my-5 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-[13px] leading-6 text-slate-100">
                {children}
              </pre>
            ),
            code: ({ children, className, ...props }) => {
              const isBlock = className?.startsWith('language-');
              if (isBlock) {
                return (
                  <code className={cn('font-mono', className)} {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code
                  className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[12.5px] text-slate-800"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            img: ({ src, alt }) => {
              if (!src || typeof src !== 'string') return null;
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={alt ?? ''}
                  className="my-6 max-h-[28rem] w-full rounded-lg border border-slate-200 object-contain shadow-sm"
                />
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}

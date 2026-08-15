'use client';

import { useState } from 'react';
import { Copy, Check, Tag } from 'lucide-react';
import { useTemplateEditor } from './TemplateEditorContext';

export function TemplateMergeTagPanel({ className = '' }: { className?: string }) {
  const { templateTags } = useTemplateEditor();
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  function handleCopy(tag: string) {
    navigator.clipboard.writeText(`{${tag}}`);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 1500);
  }

  return (
    <div className={className}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Tag className="mr-1 inline size-3" />
        Template merge tags
      </h3>
      <p className="mb-3 text-[11px] text-slate-400">
        Tags extracted from the assigned .docx template. Click to copy.
      </p>

      {templateTags.length === 0 ? (
        <p className="text-sm text-slate-400">
          No merge tags found. Assign a template with merge fields to see them here.
        </p>
      ) : (
        <div className="space-y-0.5">
          {templateTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="group flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-blue-50"
              onClick={() => handleCopy(tag)}
              title={`Copy {${tag}}`}
            >
              <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] font-mono text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-800">
                {`{${tag}}`}
              </code>
              <span className="ml-auto">
                {copiedTag === tag ? (
                  <Check className="size-3 text-green-500" />
                ) : (
                  <Copy className="size-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

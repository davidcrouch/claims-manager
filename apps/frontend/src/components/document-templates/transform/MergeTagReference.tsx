'use client';

import { useMemo, useState } from 'react';
import { Copy, Check, Tag, ChevronDown, ChevronRight } from 'lucide-react';
import { useTransformEditor } from './TransformEditorContext';
import type { JsonSchemaProperty } from './TransformEditorContext';

function collectMergeTags(
  properties: Record<string, JsonSchemaProperty>,
  parentPath = '',
): string[] {
  const tags: string[] = [];

  for (const [key, property] of Object.entries(properties)) {
    const path = parentPath ? `${parentPath}.${key}` : key;

    if (property.type === 'object' && property.properties) {
      tags.push(...collectMergeTags(property.properties, path));
      continue;
    }

    if (property.type === 'array' && property.items) {
      tags.push(`{#${path}}`);
      if (property.items.type === 'object' && property.items.properties) {
        // Inside FOR loops, child tags use the item field name (not a dotted path).
        tags.push(...collectMergeTags(property.items.properties));
      } else {
        tags.push(`{${path}}`);
      }
      tags.push(`{/${path}}`);
      continue;
    }

    tags.push(`{${path}}`);
  }

  return tags;
}

export function MergeTagReference({ className = '' }: { className?: string }) {
  const { targetSchema } = useTransformEditor();
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const allTags = useMemo(
    () =>
      targetSchema?.properties
        ? collectMergeTags(targetSchema.properties)
        : [],
    [targetSchema],
  );

  function handleCopy(tag: string) {
    navigator.clipboard.writeText(`{${tag}}`);
    setCopiedTag(tag);
    setCopiedAll(false);
    setTimeout(() => setCopiedTag(null), 1500);
  }

  function handleCopyAll() {
    if (allTags.length === 0) return;
    navigator.clipboard.writeText(allTags.join('\n'));
    setCopiedAll(true);
    setCopiedTag(null);
    setTimeout(() => setCopiedAll(false), 1500);
  }

  if (!targetSchema?.properties) {
    return (
      <div className={className}>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Tag className="mr-1 inline size-3" />
          Merge tags
        </h3>
        <p className="text-sm text-slate-400">No target schema available</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Tag className="mr-1 inline size-3" />
          Merge tags
        </h3>
        <button
          type="button"
          onClick={handleCopyAll}
          disabled={allTags.length === 0}
          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Copy all merge tags"
        >
          {copiedAll ? (
            <>
              <Check className="size-3 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3" />
              Copy all
            </>
          )}
        </button>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">
        Use these tags in your Word template. Click to copy.
      </p>
      <div className="space-y-0.5">
        {Object.entries(targetSchema.properties).map(([key, prop]) => (
          <MergeTagNode
            key={key}
            path={key}
            name={key}
            property={prop}
            copiedTag={copiedTag}
            onCopy={handleCopy}
          />
        ))}
      </div>
    </div>
  );
}

function MergeTagNode({
  path,
  name,
  property,
  copiedTag,
  onCopy,
  depth = 0,
}: {
  path: string;
  name: string;
  property: JsonSchemaProperty;
  copiedTag: string | null;
  onCopy: (tag: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isContainer = property.type === 'object' && property.properties;
  const isArray = property.type === 'array' && property.items;

  if (isContainer) {
    return (
      <div>
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-slate-50"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="size-3 text-slate-400" />
          ) : (
            <ChevronRight className="size-3 text-slate-400" />
          )}
          <span className="text-[12px] font-medium text-slate-600">{name}</span>
          {property.description && (
            <span className="ml-1 text-[10px] text-slate-400">
              — {property.description}
            </span>
          )}
        </button>
        {expanded &&
          Object.entries(property.properties!).map(([childKey, childProp]) => (
            <MergeTagNode
              key={childKey}
              path={`${path}.${childKey}`}
              name={childKey}
              property={childProp}
              copiedTag={copiedTag}
              onCopy={onCopy}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  if (isArray) {
    const tag = path;
    return (
      <div>
        <div
          className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-50"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <span className="text-[10px] text-slate-400">FOR</span>
          <code className="rounded bg-blue-50 px-1 py-0.5 text-[11px] font-mono text-blue-700">
            {`{#${tag}}`}…{`{/${tag}}`}
          </code>
          {property.description && (
            <span className="ml-1 text-[10px] text-slate-400">
              — {property.description}
            </span>
          )}
        </div>
        {property.items?.type === 'object' &&
          property.items.properties &&
          Object.entries(property.items.properties).map(([childKey, childProp]) => (
            <MergeTagNode
              key={childKey}
              path={childKey}
              name={childKey}
              property={childProp}
              copiedTag={copiedTag}
              onCopy={onCopy}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-blue-50"
      style={{ paddingLeft: `${depth * 12 + 16}px` }}
      onClick={() => onCopy(path)}
      title={`Copy {${path}}`}
    >
      <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] font-mono text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-800">
        {`{${path}}`}
      </code>
      {property.description && (
        <span className="text-[10px] text-slate-400">{property.description}</span>
      )}
      <span className="ml-auto">
        {copiedTag === path ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3 text-slate-300 opacity-0 group-hover:opacity-100" />
        )}
      </span>
    </button>
  );
}

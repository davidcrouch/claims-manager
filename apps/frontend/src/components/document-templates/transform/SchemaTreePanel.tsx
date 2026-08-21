'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Braces, Type, List, Hash, ToggleLeft } from 'lucide-react';
import type { JsonSchemaObject, JsonSchemaProperty } from './TransformEditorContext';

interface SchemaTreePanelProps {
  title: string;
  schema: JsonSchemaObject | null;
  className?: string;
}

export function SchemaTreePanel({ title, schema, className = '' }: SchemaTreePanelProps) {
  if (!schema) {
    return (
      <div className={`flex flex-col ${className}`}>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </h3>
        <div className="flex-1 rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-400">No schema available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      <div className="flex-1 overflow-y-auto rounded-md border border-slate-200 bg-white">
        <div className="p-2">
          {schema.properties ? (
            Object.entries(schema.properties).map(([key, prop]) => (
              <SchemaNode
                key={key}
                name={key}
                property={prop}
                depth={0}
                defaultExpanded={key === '_context'}
              />
            ))
          ) : (
            <p className="px-2 py-1 text-sm text-slate-400">Empty schema</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SchemaNode({
  name,
  property,
  depth,
  defaultExpanded,
}: {
  name: string;
  property: JsonSchemaProperty;
  depth: number;
  defaultExpanded?: boolean;
}) {
  const hasChildren =
    (property.type === 'object' && property.properties) ||
    (property.type === 'array' && property.items);

  const [expanded, setExpanded] = useState(defaultExpanded ?? depth < 2);

  const TypeIcon = getTypeIcon(property.type);

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 16 + 6}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
        disabled={!hasChildren}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="size-3 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="size-3 shrink-0 text-slate-400" />
          )
        ) : (
          <span className="inline-block size-3 shrink-0" />
        )}
        <TypeIcon className="size-3 shrink-0 text-slate-400" />
        <span className="truncate text-[13px] font-medium text-slate-800">{name}</span>
        <span className="ml-auto shrink-0 text-[11px] text-slate-400">{property.type}</span>
      </button>

      {property.description && expanded && (
        <p
          className="truncate text-[11px] text-slate-400"
          style={{ paddingLeft: `${depth * 16 + 30}px` }}
        >
          {property.description}
        </p>
      )}

      {expanded && property.type === 'object' && property.properties && (
        <div>
          {Object.entries(property.properties).map(([key, child]) => (
            <SchemaNode key={key} name={key} property={child} depth={depth + 1} />
          ))}
        </div>
      )}

      {expanded && property.type === 'array' && property.items && (
        <div>
          {property.items.type === 'object' && property.items.properties ? (
            Object.entries(property.items.properties).map(([key, child]) => (
              <SchemaNode key={key} name={key} property={child} depth={depth + 1} />
            ))
          ) : (
            <p
              className="text-[11px] text-slate-400"
              style={{ paddingLeft: `${(depth + 1) * 16 + 6}px` }}
            >
              items: {property.items.type}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'object':
      return Braces;
    case 'array':
      return List;
    case 'number':
    case 'integer':
      return Hash;
    case 'boolean':
      return ToggleLeft;
    default:
      return Type;
  }
}

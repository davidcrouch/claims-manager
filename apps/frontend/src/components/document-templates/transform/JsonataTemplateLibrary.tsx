'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTransformEditor } from './TransformEditorContext';

interface Template {
  name: string;
  description: string;
  expression: string;
}

const TEMPLATES: { category: string; items: Template[] }[] = [
  {
    category: 'Basic mappings',
    items: [
      {
        name: 'Rename fields',
        description: 'Map source field names to simpler target names',
        expression: `{
  "company": company_name,
  "number": invoice_number,
  "date": issue_date,
  "total": total_amount
}`,
      },
      {
        name: 'Passthrough',
        description: 'Return source data unchanged',
        expression: '$',
      },
      {
        name: 'Pick fields',
        description: 'Select specific fields from the source',
        expression: `$~> |$|{}, ["internal_id", "tenant_id"]|`,
      },
    ],
  },
  {
    category: 'Nested objects',
    items: [
      {
        name: 'Group into object',
        description: 'Combine related fields into a nested object',
        expression: `{
  "to": {
    "name": to_name,
    "email": to_email,
    "address": to_address
  },
  "from": {
    "name": from_name,
    "address": from_address
  }
}`,
      },
      {
        name: 'Flatten object',
        description: 'Flatten a nested object into top-level keys',
        expression: `$merge([$, address.{"addr_street": street, "addr_city": city}])`,
      },
    ],
  },
  {
    category: 'Arrays',
    items: [
      {
        name: 'Map array items',
        description: 'Transform each item in an array',
        expression: `{
  "items": items.({
    "name": item_name,
    "qty": item_quantity,
    "cost": item_unit_cost,
    "total": item_total
  })
}`,
      },
      {
        name: 'Filter array',
        description: 'Keep only items matching a condition',
        expression: `{
  "active_items": items[status = "active"]
}`,
      },
      {
        name: 'Groups with nested items',
        description: 'Map grouped structures (quotes, POs, etc.)',
        expression: `{
  "groups": groups.({
    "name": group_name,
    "subtotal": group_subtotal,
    "items": items.({
      "name": item_name,
      "total": item_total
    })
  })
}`,
      },
    ],
  },
  {
    category: 'Formatting',
    items: [
      {
        name: 'String concatenation',
        description: 'Combine fields into a single string',
        expression: `{
  "full_address": address_suburb & ", " & address_state & " " & address_postcode
}`,
      },
      {
        name: 'Conditional value',
        description: 'Set a field based on a condition',
        expression: `{
  "status_label": status = "active" ? "Active" : "Inactive"
}`,
      },
      {
        name: 'Default value',
        description: 'Fall back when a field is missing or empty',
        expression: `{
  "notes": comments ? comments : "No notes provided"
}`,
      },
    ],
  },
  {
    category: 'List reports',
    items: [
      {
        name: 'Standard list envelope',
        description: 'Rename list envelope fields and map items',
        expression: `{
  "company": company_name,
  "title": report_title,
  "date": report_date,
  "count": total_count,
  "items": items.({
    "name": name,
    "reference": reference,
    "date": request_date
  })
}`,
      },
    ],
  },
];

export function JsonataTemplateLibrary() {
  const { setJsonataRules } = useTransformEditor();
  const [open, setOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);

  function handleUse(expression: string) {
    setJsonataRules(expression);
    setOpen(false);
  }

  function handleCopy(expression: string, id: string) {
    navigator.clipboard.writeText(expression);
    setCopiedIdx(id);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <BookOpen className="size-3.5" />
        Templates
      </Button>
    );
  }

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
      <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-800">JSONata template library</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Close
        </Button>
      </div>

      <div className="p-2">
        {TEMPLATES.map((cat) => (
          <div key={cat.category} className="mb-1">
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() =>
                setExpandedCategory(expandedCategory === cat.category ? null : cat.category)
              }
            >
              {expandedCategory === cat.category ? (
                <ChevronDown className="size-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="size-3.5 text-slate-400" />
              )}
              {cat.category}
              <span className="ml-auto text-xs text-slate-400">{cat.items.length}</span>
            </button>

            {expandedCategory === cat.category &&
              cat.items.map((tpl) => {
                const id = `${cat.category}:${tpl.name}`;
                return (
                  <div
                    key={tpl.name}
                    className="mb-2 ml-5 rounded border border-slate-100 bg-slate-50 p-2"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[13px] font-medium text-slate-800">
                        {tpl.name}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                          onClick={() => handleCopy(tpl.expression, id)}
                          title="Copy"
                        >
                          {copiedIdx === id ? (
                            <Check className="size-3" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleUse(tpl.expression)}
                        >
                          Use
                        </Button>
                      </div>
                    </div>
                    <p className="mb-1.5 text-[11px] text-slate-500">{tpl.description}</p>
                    <pre className="whitespace-pre-wrap rounded bg-slate-900 p-2 text-[11px] leading-relaxed text-emerald-300">
                      {tpl.expression}
                    </pre>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

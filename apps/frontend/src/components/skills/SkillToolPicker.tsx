'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react';
import { listMcpToolsAction } from '@/app/(app)/admin/mcp-servers/actions';
import type { McpToolGroupResponse } from '@/lib/ai/types';
import { cn } from '@/lib/utils';

const CATEGORY_ORDER = ['Claims', 'Jobs', 'Tasks', 'Contacts', 'Lookups', 'Other'];

interface FlatTool {
  namespacedId: string;
  originalName: string;
  description: string;
  category: string;
  label: string;
}

function resolveToolInfo(originalName: string, description: string): { label: string; description: string; category: string } {
  const label = originalName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const category = inferCategory(originalName);
  const shortDesc = description.length > 100 ? description.slice(0, 100).replace(/\s\S*$/, '') + '…' : description;
  return { label, description: shortDesc, category };
}

function inferCategory(toolName: string): string {
  if (toolName.includes('claim')) return 'Claims';
  if (toolName.includes('job')) return 'Jobs';
  if (toolName.includes('task')) return 'Tasks';
  if (toolName.includes('contact')) return 'Contacts';
  if (toolName.includes('lookup')) return 'Lookups';
  return 'Other';
}

interface SkillToolPickerProps {
  selectedTools: string[];
  onChange: (tools: string[]) => void;
}

export function SkillToolPicker({ selectedTools, onChange }: SkillToolPickerProps) {
  const [groups, setGroups] = useState<McpToolGroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    listMcpToolsAction()
      .then((fetched) => {
        setGroups(fetched ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const allTools: FlatTool[] = useMemo(() => {
    const seen = new Set<string>();
    const result: FlatTool[] = [];

    for (const group of groups) {
      for (const tool of group.tools) {
        const key = tool.originalName;
        if (seen.has(key)) continue;
        seen.add(key);
        const info = resolveToolInfo(tool.originalName, tool.description);
        result.push({
          namespacedId: tool.namespacedId,
          originalName: tool.originalName,
          description: info.description,
          category: info.category,
          label: info.label,
        });
      }
    }
    return result;
  }, [groups]);

  const selectedSet = useMemo(() => new Set(selectedTools), [selectedTools]);

  const filteredTools = useMemo(() => {
    if (!search) return allTools;
    const q = search.toLowerCase();
    return allTools.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.originalName.toLowerCase().includes(q),
    );
  }, [allTools, search]);

  const toolsByCategory = useMemo(() => {
    const map = new Map<string, FlatTool[]>();
    for (const tool of filteredTools) {
      const list = map.get(tool.category) ?? [];
      list.push(tool);
      map.set(tool.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [filteredTools]);

  const toggleTool = useCallback(
    (originalName: string) => {
      if (selectedSet.has(originalName)) {
        onChange(selectedTools.filter((t) => t !== originalName));
      } else {
        onChange([...selectedTools, originalName]);
      }
    },
    [selectedTools, selectedSet, onChange],
  );

  const toggleCategory = useCallback(
    (category: string, enable: boolean) => {
      const categoryToolNames = allTools.filter((t) => t.category === category).map((t) => t.originalName);
      if (enable) {
        const merged = new Set([...selectedTools, ...categoryToolNames]);
        onChange([...merged]);
      } else {
        const remove = new Set(categoryToolNames);
        onChange(selectedTools.filter((t) => !remove.has(t)));
      }
    },
    [allTools, selectedTools, onChange],
  );

  const toggleCategoryCollapse = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <Loader2 className="mb-3 h-6 w-6 animate-spin" />
        <p className="text-sm">Loading available tools…</p>
      </div>
    );
  }

  if (allTools.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm">
        No tools available. Ensure MCP connections are configured.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Required Tools</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              When activated, only these tools will be available during skill execution.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap text-xs text-slate-400">
              {selectedTools.length} of {allTools.length} selected
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-300"
              disabled={selectedTools.length === 0}
            >
              Clear all
            </button>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tools…"
            className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
          />
        </div>
      </div>

      <div className="space-y-3">
        {toolsByCategory.map(([category, tools]) => {
          const collapsed = collapsedCategories.has(category);
          const catSelectedCount = tools.filter((t) => selectedSet.has(t.originalName)).length;
          const catAllSelected = catSelectedCount === tools.length;

          return (
            <div key={category} className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
                <button
                  type="button"
                  onClick={() => toggleCategoryCollapse(category)}
                  className="flex items-center gap-2 text-left"
                >
                  {collapsed ? (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="text-sm font-semibold text-slate-800">{category}</span>
                </button>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {catSelectedCount}/{tools.length}
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => toggleCategory(category, !catAllSelected)}
                  className={cn(
                    'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                    catAllSelected
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                  )}
                >
                  {catAllSelected ? 'All' : 'None'}
                </button>
              </div>

              {!collapsed && (
                <div>
                  {tools.map((tool) => {
                    const enabled = selectedSet.has(tool.originalName);
                    return (
                      <div
                        key={tool.originalName}
                        className="flex items-center gap-3 border-b border-slate-50 px-5 py-2.5 last:border-b-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">{tool.label}</p>
                          <p className="text-xs text-slate-500">{tool.description}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          onClick={() => toggleTool(tool.originalName)}
                          className={cn(
                            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200',
                            enabled ? 'bg-blue-600' : 'bg-slate-200',
                          )}
                        >
                          <span
                            className={cn(
                              'pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
                              enabled ? 'translate-x-4' : 'translate-x-0.5',
                            )}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

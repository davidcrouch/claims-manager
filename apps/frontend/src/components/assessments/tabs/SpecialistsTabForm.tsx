'use client';

import { useMemo } from 'react';
import { TabPanel, CheckField, asBool, asStr, type TabFormProps } from './shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SPECIALIST_TYPE_OPTIONS = [
  'Plumbing',
  'Roofing',
  'Surveyors',
  'Electrical',
  'Structural',
  'Arborist',
  'Asbestos',
  'Environmental',
  'Other',
];

/** Parse specialistType(s) — backward compatible with single string or array. */
function parseTypes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string');
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
}

/** Build the backward-compat specialistType string, expanding Other with free text when present. */
function formatSpecialistType(types: string[], otherText: string): string {
  const trimmedOther = otherText.trim();
  return types
    .map((t) => (t === 'Other' && trimmedOther ? `Other: ${trimmedOther}` : t))
    .join(', ');
}

export function SpecialistsTabForm({ data, onChange, locked }: TabFormProps) {
  const selected = useMemo(() => new Set(parseTypes(data.specialistTypes ?? data.specialistType)), [data.specialistTypes, data.specialistType]);
  const otherSelected = selected.has('Other');
  const otherText = asStr(data.specialistOther);

  function commitTypes(next: Set<string>, nextOtherText = otherText) {
    const arr = [...next];
    onChange('specialistTypes', arr);
    // Keep backward-compat single-value field for downstream consumers
    onChange('specialistType', formatSpecialistType(arr, nextOtherText));
  }

  function toggleType(type: string) {
    const next = new Set(selected);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    if (type === 'Other' && !next.has('Other')) {
      onChange('specialistOther', '');
      commitTypes(next, '');
      return;
    }
    commitTypes(next);
  }

  function setOtherText(value: string) {
    onChange('specialistOther', value);
    commitTypes(selected, value);
  }

  return (
    <TabPanel disabled={locked}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CheckField
          id="specialist-required"
          label="Specialist required"
          checked={asBool(data.specialistRequired)}
          onChange={(v) => onChange('specialistRequired', v)}
        />
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500">Specialist types</Label>
          <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3">
            {SPECIALIST_TYPE_OPTIONS.map((type) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    id={`specialist-type-${type}`}
                    checked={selected.has(type)}
                    disabled={locked}
                    onCheckedChange={() => toggleType(type)}
                  />
                  <Label
                    htmlFor={`specialist-type-${type}`}
                    className="cursor-pointer text-sm font-normal text-slate-700"
                  >
                    {type}
                  </Label>
                </div>
                {type === 'Other' && (
                  <Input
                    id="specialist-other-text"
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder="Describe other specialist…"
                    disabled={locked || !otherSelected}
                    className="ml-7 h-9 text-sm"
                    aria-label="Other specialist type"
                  />
                )}
              </div>
            ))}
          </div>
          {selected.size > 0 && (
            <p className="text-xs text-muted-foreground">
              Selected: {formatSpecialistType([...selected], otherText)}
            </p>
          )}
        </div>
      </div>
    </TabPanel>
  );
}

'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { LookupOption, MobilityOption } from './job-edit.types';

const EMPTY = '__none__';

export function EditSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={(v) => onChange(!!v)}
    />
  );
}

export function EditText({
  value,
  onChange,
  disabled,
  type = 'text',
  className,
  min,
  max,
  step,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: string | number;
}) {
  return (
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      className={className ?? 'h-8 w-full max-w-xs text-sm'}
    />
  );
}

export function EditTextarea({
  value,
  onChange,
  disabled,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={rows}
      className="min-h-18 w-full text-sm"
    />
  );
}

export function EditLookupSelect({
  valueId,
  options,
  onChange,
  disabled,
  placeholder = 'Select...',
}: {
  valueId: string;
  options: LookupOption[];
  onChange: (opt: LookupOption | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const items: Record<string, string> = { [EMPTY]: '—' };
  for (const opt of options) {
    items[opt.id] = opt.name ?? opt.externalReference ?? opt.id;
  }

  return (
    <Select
      value={valueId || EMPTY}
      onValueChange={(v) => {
        if (!v || v === EMPTY) {
          onChange(null);
          return;
        }
        onChange(options.find((o) => o.id === v) ?? null);
      }}
      items={items}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 w-full max-w-xs" disabled={disabled}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY}>—</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {items[opt.id]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EditRefSelect({
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Select...',
}: {
  value: string;
  options: Array<{ name: string; externalReference: string }>;
  onChange: (opt: { name: string; externalReference: string } | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const items: Record<string, string> = { [EMPTY]: '—' };
  for (const opt of options) {
    items[opt.externalReference] = opt.name;
  }

  return (
    <Select
      value={value || EMPTY}
      onValueChange={(v) => {
        if (!v || v === EMPTY) {
          onChange(null);
          return;
        }
        onChange(options.find((o) => o.externalReference === v) ?? null);
      }}
      items={items}
      disabled={disabled}
    >
      <SelectTrigger className="h-8 w-full max-w-xs" disabled={disabled}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY}>—</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.externalReference} value={opt.externalReference}>
            {opt.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EditMobilityGroup({
  selected,
  options,
  onChange,
  disabled,
}: {
  selected: MobilityOption[];
  options: MobilityOption[];
  onChange: (next: MobilityOption[]) => void;
  disabled?: boolean;
}) {
  const selectedRefs = new Set(selected.map((s) => s.externalReference));

  return (
    <div className="flex flex-col gap-2 pt-0.5">
      {options.map((opt) => {
        const checked = selectedRefs.has(opt.externalReference);
        const id = `mobility-${opt.externalReference}`;
        return (
          <div key={opt.externalReference} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(v) => {
                if (v) {
                  onChange([...selected.filter((s) => s.externalReference !== opt.externalReference), opt]);
                } else {
                  onChange(selected.filter((s) => s.externalReference !== opt.externalReference));
                }
              }}
            />
            <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
              {opt.name}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

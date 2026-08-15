'use client';

import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { asBool, asStr } from '../assessment-sections';

export { asBool, asStr };

const EMPTY_PLACEHOLDER = '__empty__';

export interface TabFormProps {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  locked?: boolean;
}

export function TabPanel({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <fieldset
      disabled={disabled}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm disabled:opacity-80"
    >
      {children}
    </fieldset>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-500">{label}</Label>
      <Select
        value={value || EMPTY_PLACEHOLDER}
        onValueChange={(v) => onChange(!v || v === EMPTY_PLACEHOLDER ? '' : v)}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 w-full" disabled={disabled}>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_PLACEHOLDER}>-- None --</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CheckField({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(!!v)}
      />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal text-slate-700">
        {label}
      </Label>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  multiline,
  type,
  placeholder,
  disabled,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-500">{label}</Label>
      {multiline ? (
        <Textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          disabled={disabled}
          className="text-sm"
        />
      ) : (
        <Input
          type={type ?? 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-9 text-sm"
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type AddressParts = {
  unitNumber?: string;
  streetNumber?: string;
  streetName?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
};

export type AddressSuggestion = {
  id: string;
  label: string;
  primary: string;
  secondary: string;
  parts?: AddressParts;
};

export interface AddressAutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when a suggestion is chosen (in addition to onChange with the label). */
  onSelect?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  name?: string;
}

type MenuState = {
  top: number;
  left: number;
  width: number;
};

const MIN_CHARS = 3;

export function AddressAutocompleteInput({
  id,
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing an address…',
  disabled,
  className,
  inputClassName,
  name = 'address-search',
}: AddressAutocompleteInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  function getInputEl() {
    return inputRef.current ?? wrapRef.current?.querySelector('input');
  }

  function updateMenuPosition() {
    const el = wrapRef.current ?? getInputEl();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenu({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 280),
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    function onReposition() {
      updateMenuPosition();
    }
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || listRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setActiveIndex(-1);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function selectSuggestion(suggestion: AddressSuggestion) {
    onChange(suggestion.label);
    onSelect?.(suggestion);
    setQuery(suggestion.label);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    getInputEl()?.focus();
  }

  function searchAddresses(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (next.trim().length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setOpen(true);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/address-autocomplete?q=${encodeURIComponent(next.trim())}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = (await res.json()) as { suggestions?: AddressSuggestion[] };
        setSuggestions(data.suggestions ?? []);
        setActiveIndex(-1);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        console.error('[frontend:AddressAutocompleteInput.searchAddresses]', err);
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
  }

  function handleChange(next: string) {
    setQuery(next);
    onChange(next);
    searchAddresses(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]!);
    }
  }

  const showMenu = open && query.trim().length >= MIN_CHARS;

  return (
    <div className={cn('relative', className)} ref={wrapRef}>
      <MapPin className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        id={inputId}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (query.trim().length >= MIN_CHARS) {
            setOpen(true);
            if (suggestions.length === 0) searchAddresses(query);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        name={name}
        autoComplete="new-password"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        data-form-type="other"
        role="combobox"
        aria-expanded={showMenu}
        aria-controls={`${inputId}-listbox`}
        aria-autocomplete="list"
        className={cn('pl-8 pr-8', inputClassName)}
      />
      {loading && (
        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {showMenu &&
        menu &&
        createPortal(
          <ul
            ref={listRef}
            id={`${inputId}-listbox`}
            role="listbox"
            className="fixed z-[9999] max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
            style={{ top: menu.top, left: menu.left, width: menu.width }}
          >
            {loading && suggestions.length === 0 && (
              <li className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching addresses…
              </li>
            )}
            {!loading && suggestions.length === 0 && (
              <li className="px-3 py-2.5 text-sm text-slate-500">
                No matching Australian addresses
              </li>
            )}
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.id}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50',
                    index === activeIndex && 'bg-slate-100',
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectSuggestion(suggestion);
                  }}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {suggestion.primary}
                    </span>
                    {suggestion.secondary && (
                      <span className="block truncate text-xs text-slate-500">
                        {suggestion.secondary}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}

'use client';

import { useCallback, useRef } from 'react';
import { Play, RotateCcw, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTransformEditor } from './TransformEditorContext';

export function JsonataEditorPanel({ className = '' }: { className?: string }) {
  const {
    jsonataRules,
    setJsonataRules,
    evaluate,
    save,
    reset,
    saving,
    evaluating,
    dirty,
    isCustom,
    defaultJsonataRules,
  } = useTransformEditor();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const value = ta.value;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        setJsonataRules(newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        evaluate();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    },
    [setJsonataRules, evaluate, save],
  );

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          JSONata rules
        </h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={evaluate}
            disabled={evaluating || !jsonataRules.trim()}
            title="Evaluate (Ctrl+Enter)"
          >
            {evaluating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => void save()}
            disabled={saving || !dirty}
            title="Save (Ctrl+S)"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
          </Button>
          {isCustom && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => void reset()}
              disabled={saving}
              title="Reset to defaults"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={jsonataRules}
          onChange={(e) => setJsonataRules(e.target.value)}
          onKeyDown={handleKeyDown}
          className="size-full resize-none rounded-md border border-slate-200 bg-slate-950 p-3 font-mono text-[13px] leading-relaxed text-emerald-300 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          spellCheck={false}
          placeholder="Enter JSONata expression…"
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          {dirty ? (
            <span className="text-amber-600">Unsaved changes</span>
          ) : isCustom ? (
            'Custom transform saved'
          ) : (
            'Using built-in defaults'
          )}
        </p>
        <p className="text-[11px] text-slate-400">
          Ctrl+Enter to evaluate · Ctrl+S to save
        </p>
      </div>
    </div>
  );
}

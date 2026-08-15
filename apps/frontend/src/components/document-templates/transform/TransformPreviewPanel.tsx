'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
} from 'lucide-react';
import { useTransformEditor } from './TransformEditorContext';

export function TransformPreviewPanel({ className = '' }: { className?: string }) {
  const { previewResult, previewError, testData, setTestData, evaluating } =
    useTransformEditor();

  const [showTestData, setShowTestData] = useState(false);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Test data (collapsible) */}
      <div>
        <button
          type="button"
          className="mb-1 flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
          onClick={() => setShowTestData(!showTestData)}
        >
          {showTestData ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          <Database className="size-3" />
          Test data
        </button>

        {showTestData && (
          <textarea
            value={testData}
            onChange={(e) => setTestData(e.target.value)}
            className="h-40 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[12px] leading-relaxed text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            spellCheck={false}
            placeholder="Paste source JSON to test against…"
          />
        )}
      </div>

      {/* Output preview */}
      <div className="flex min-h-0 flex-1 flex-col">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Output preview
        </h3>

        <div className="flex-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-3">
          {evaluating ? (
            <p className="text-sm text-slate-400">Evaluating…</p>
          ) : previewError ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
              <pre className="whitespace-pre-wrap text-[13px] text-red-600">
                {previewError}
              </pre>
            </div>
          ) : previewResult !== null ? (
            <>
              <div className="mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-green-500" />
                <span className="text-[11px] font-medium text-green-700">
                  Transform successful
                </span>
              </div>
              <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                {JSON.stringify(previewResult, null, 2)}
              </pre>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              Click the play button or press Ctrl+Enter to evaluate the transform
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

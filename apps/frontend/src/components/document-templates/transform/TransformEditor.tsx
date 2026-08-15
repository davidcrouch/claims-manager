'use client';

import { Loader2, AlertCircle, FileCode2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  TransformEditorProvider,
  useTransformEditor,
} from './TransformEditorContext';
import { SchemaTreePanel } from './SchemaTreePanel';
import { JsonataEditorPanel } from './JsonataEditorPanel';
import { TransformPreviewPanel } from './TransformPreviewPanel';
import { TransformAIAssistButton } from './TransformAIAssist';
import { JsonataTemplateLibrary } from './JsonataTemplateLibrary';
import { MergeTagReference } from './MergeTagReference';
import { LoadSampleDataButton } from './LoadSampleData';
import { TransformVersionHistoryButton } from './TransformVersionHistory';

interface TransformEditorProps {
  documentType: string;
  label: string;
}

export function TransformEditor({ documentType, label }: TransformEditorProps) {
  return (
    <TransformEditorProvider documentType={documentType}>
      <TransformEditorInner label={label} />
    </TransformEditorProvider>
  );
}

function TransformEditorInner({ label }: { label: string }) {
  const {
    loading,
    error,
    saving,
    save,
    reset,
    isCustom,
    dirty,
  } = useTransformEditor();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading transform…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3">
        <AlertCircle className="size-4 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  async function handleSave() {
    try {
      await save();
      toast.success('Transform saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleReset() {
    try {
      await reset();
      toast.success('Transform reset to defaults');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset');
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <FileCode2 className="size-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">
            Data transform
          </h2>
          {isCustom && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              Custom
            </span>
          )}
          {dirty && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              Unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TransformAIAssistButton />
          <TransformVersionHistoryButton />
          <LoadSampleDataButton />
          {isCustom && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleReset()}
              disabled={saving}
            >
              <RefreshCw className="mr-1 size-3.5" />
              Reset to defaults
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
          >
            {saving ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            Save transform
          </Button>
        </div>
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-3 divide-x divide-slate-200" style={{ height: '540px' }}>
        {/* Left: Schemas + merge tag reference */}
        <div className="flex flex-col overflow-hidden p-4">
          <SourceSchemaPanel />
        </div>

        {/* Center: JSONata editor + template library */}
        <div className="relative overflow-hidden p-4">
          <JsonataEditorPanel className="h-full" />
          <div className="absolute bottom-5 left-5">
            <JsonataTemplateLibrary />
          </div>
        </div>

        {/* Right: Preview */}
        <div className="overflow-hidden p-4">
          <TransformPreviewPanel className="h-full" />
        </div>
      </div>

      {/* Footer: merge tag reference */}
      <div className="border-t border-slate-200 px-5 py-4">
        <MergeTagReference />
      </div>
    </div>
  );
}

function SourceSchemaPanel() {
  const { sourceSchema, targetSchema } = useTransformEditor();

  return (
    <div className="flex h-full flex-col gap-3">
      <SchemaTreePanel
        title="Source schema"
        schema={sourceSchema}
        className="flex-1 min-h-0"
      />
      <SchemaTreePanel
        title="Target schema"
        schema={targetSchema}
        className="flex-1 min-h-0"
      />
    </div>
  );
}

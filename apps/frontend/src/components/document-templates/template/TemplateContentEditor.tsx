'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useTemplateEditor } from './TemplateEditorContext';

export function TemplateContentEditor() {
  const { htmlContent, setHtmlContent, hasTemplate } = useTemplateEditor();
  const editorRef = useRef<HTMLDivElement>(null);
  const internalUpdate = useRef(false);

  useEffect(() => {
    if (!editorRef.current) return;
    if (internalUpdate.current) {
      internalUpdate.current = false;
      return;
    }
    editorRef.current.innerHTML = htmlContent;
  }, [htmlContent]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    internalUpdate.current = true;
    setHtmlContent(editorRef.current.innerHTML);
  }, [setHtmlContent]);

  if (!hasTemplate) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-8">
        <div className="text-center">
          <p className="text-sm font-medium text-slate-500">No template assigned</p>
          <p className="mt-1 text-xs text-slate-400">
            Assign a .docx template above to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl bg-white shadow-lg">
        <div
          ref={editorRef}
          contentEditable
          className="word-document p-12 outline-none"
          style={{
            minHeight: '100%',
            lineHeight: '1.6',
            fontSize: '12pt',
            fontFamily: '"Times New Roman", "Georgia", serif',
            direction: 'ltr',
            unicodeBidi: 'normal',
          }}
          onInput={handleInput}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface TemplateEditorState {
  loading: boolean;
  saving: boolean;
  error: string | null;

  documentType: string;
  htmlContent: string;
  setHtmlContent: (html: string) => void;

  templateTags: string[];
  fileName: string | null;
  hasTemplate: boolean;

  dirty: boolean;

  save: () => Promise<void>;
  reload: () => Promise<void>;
}

interface ContentData {
  base64: string;
  fileName: string;
}

const TemplateEditorCtx = createContext<TemplateEditorState | null>(null);

export function useTemplateEditor() {
  const ctx = useContext(TemplateEditorCtx);
  if (!ctx) throw new Error('useTemplateEditor must be inside TemplateEditorProvider');
  return ctx;
}

export function TemplateEditorProvider({
  documentType,
  children,
}: {
  documentType: string;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [htmlContent, setHtmlContent] = useState('');
  const [templateTags, setTemplateTags] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hasTemplate, setHasTemplate] = useState(false);

  const savedHtmlRef = useRef('');

  const dirty = useMemo(
    () => htmlContent !== savedHtmlRef.current,
    [htmlContent],
  );

  const loadContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/document-templates/${encodeURIComponent(documentType)}/content`,
      );
      if (res.status === 404) {
        setHasTemplate(false);
        setHtmlContent('');
        setFileName(null);
        savedHtmlRef.current = '';
        return;
      }
      if (!res.ok) throw new Error('Failed to load template content');

      const data = (await res.json()) as ContentData;
      setHasTemplate(true);
      setFileName(data.fileName);

      const mammoth = await import('mammoth');
      const binaryString = atob(data.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
      setHtmlContent(result.value);
      savedHtmlRef.current = result.value;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [documentType]);

  const loadTags = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/document-templates/${encodeURIComponent(documentType)}/tags`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { tags: string[] };
      setTemplateTags(data.tags);
    } catch {
      // tags are informational — don't block on failures
    }
  }, [documentType]);

  const reload = useCallback(async () => {
    await loadContent();
    await loadTags();
  }, [loadContent, loadTags]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/document-templates/${encodeURIComponent(documentType)}/content`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: htmlContent }),
        },
      );
      if (!res.ok) throw new Error('Failed to save template');
      savedHtmlRef.current = htmlContent;
      await loadTags();
    } finally {
      setSaving(false);
    }
  }, [documentType, htmlContent, loadTags]);

  const value = useMemo<TemplateEditorState>(
    () => ({
      loading,
      saving,
      error,
      documentType,
      htmlContent,
      setHtmlContent,
      templateTags,
      fileName,
      hasTemplate,
      dirty,
      save,
      reload,
    }),
    [
      loading, saving, error, documentType, htmlContent, templateTags,
      fileName, hasTemplate, dirty, save, reload,
    ],
  );

  return (
    <TemplateEditorCtx.Provider value={value}>
      {children}
    </TemplateEditorCtx.Provider>
  );
}

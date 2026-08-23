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

export interface JsonSchemaObject {
  type: 'object';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaProperty;
  description?: string;
}

export interface JsonSchemaProperty {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
}

interface TransformData {
  jsonataRules: string | null;
  targetSchema: JsonSchemaObject | null;
  testData: Record<string, unknown> | null;
  isCustom: boolean;
  sourceSchema: JsonSchemaObject | null;
  defaultJsonataRules: string | null;
  defaultTargetSchema: JsonSchemaObject | null;
}

export interface TransformEditorState {
  loading: boolean;
  saving: boolean;
  error: string | null;

  documentType: string;
  sourceSchema: JsonSchemaObject | null;
  targetSchema: JsonSchemaObject | null;
  defaultJsonataRules: string;
  isCustom: boolean;

  jsonataRules: string;
  setJsonataRules: (rules: string) => void;

  testData: string;
  setTestData: (data: string) => void;

  previewResult: unknown;
  previewError: string | null;
  evaluating: boolean;

  save: () => Promise<void>;
  reset: () => Promise<void>;
  evaluate: () => void;

  dirty: boolean;
}

const TransformEditorCtx = createContext<TransformEditorState | null>(null);

export function useTransformEditor() {
  const ctx = useContext(TransformEditorCtx);
  if (!ctx) throw new Error('useTransformEditor must be inside TransformEditorProvider');
  return ctx;
}

export function TransformEditorProvider({
  documentType,
  children,
}: {
  documentType: string;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sourceSchema, setSourceSchema] = useState<JsonSchemaObject | null>(null);
  const [targetSchema, setTargetSchema] = useState<JsonSchemaObject | null>(null);
  const [defaultJsonataRules, setDefaultJsonataRules] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  const [jsonataRules, setJsonataRules] = useState('');
  const [testData, setTestData] = useState('');
  const [previewResult, setPreviewResult] = useState<unknown>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const savedRulesRef = useRef('');

  const dirty = useMemo(
    () => jsonataRules !== savedRulesRef.current,
    [jsonataRules],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/document-templates/transforms/${encodeURIComponent(documentType)}`,
      );
      if (!res.ok) throw new Error('Failed to load transform data');
      const data = (await res.json()) as TransformData;

      setSourceSchema(data.sourceSchema);
      setTargetSchema(data.targetSchema as JsonSchemaObject | null);
      setDefaultJsonataRules(data.defaultJsonataRules ?? '');
      setIsCustom(data.isCustom);

      const rules = data.jsonataRules ?? data.defaultJsonataRules ?? '';
      setJsonataRules(rules);
      savedRulesRef.current = data.isCustom ? (data.jsonataRules ?? '') : '';

      if (data.testData) {
        setTestData(JSON.stringify(data.testData, null, 2));
      } else {
        const sample = generateSampleFromSchema(data.sourceSchema);
        setTestData(JSON.stringify(sample, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [documentType]);

  useEffect(() => {
    void load();
  }, [load]);

  const evaluate = useCallback(async () => {
    if (!jsonataRules.trim()) {
      setPreviewResult(null);
      setPreviewError(null);
      return;
    }
    setEvaluating(true);
    setPreviewError(null);
    try {
      let sourceData: Record<string, unknown>;
      try {
        sourceData = JSON.parse(testData);
      } catch {
        setPreviewError('Test data is not valid JSON');
        return;
      }

      const res = await fetch(
        `/api/document-templates/transforms/${encodeURIComponent(documentType)}/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceData, jsonataRules }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        result?: unknown;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setPreviewError(data.message ?? `Preview failed (${res.status})`);
        setPreviewResult(null);
        return;
      }
      if (data.error) {
        setPreviewError(data.error);
        setPreviewResult(null);
        return;
      }
      setPreviewResult(data.result ?? {});
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
      setPreviewResult(null);
    } finally {
      setEvaluating(false);
    }
  }, [documentType, jsonataRules, testData]);

  const initialEvaluateRef = useRef(false);
  useEffect(() => {
    if (loading || initialEvaluateRef.current || !jsonataRules.trim() || !testData.trim()) {
      return;
    }
    initialEvaluateRef.current = true;
    void evaluate();
  }, [loading, jsonataRules, testData, evaluate]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      let parsedTestData: unknown = null;
      try {
        parsedTestData = JSON.parse(testData);
      } catch {
        /* leave null */
      }

      const res = await fetch(
        `/api/document-templates/transforms/${encodeURIComponent(documentType)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonataRules,
            targetSchema,
            testData: parsedTestData,
          }),
        },
      );
      if (!res.ok) throw new Error('Failed to save transform');
      savedRulesRef.current = jsonataRules;
      setIsCustom(true);
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  }, [documentType, jsonataRules, targetSchema, testData]);

  const reset = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/document-templates/transforms/${encodeURIComponent(documentType)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to reset transform');
      await load();
    } finally {
      setSaving(false);
    }
  }, [documentType, load]);

  const value = useMemo<TransformEditorState>(
    () => ({
      loading,
      saving,
      error,
      documentType,
      sourceSchema,
      targetSchema,
      defaultJsonataRules,
      isCustom,
      jsonataRules,
      setJsonataRules,
      testData,
      setTestData,
      previewResult,
      previewError,
      evaluating,
      save,
      reset,
      evaluate,
      dirty,
    }),
    [
      loading, saving, error, documentType, sourceSchema, targetSchema,
      defaultJsonataRules, isCustom, jsonataRules, testData,
      previewResult, previewError, evaluating, save, reset, evaluate, dirty,
    ],
  );

  return (
    <TransformEditorCtx.Provider value={value}>
      {children}
    </TransformEditorCtx.Provider>
  );
}

function generateSampleFromSchema(
  schema: JsonSchemaObject | null,
  parentKey = '',
): Record<string, unknown> {
  if (!schema?.properties) return {};
  const result: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (key === 'contacts' || key === 'claim_contacts') {
      result[key] = [
        {
          firstName: 'Jane',
          lastName: 'Insured',
          email: 'jane@example.com',
          homePhone: '07 2222 2222',
          mobilePhone: '0411 111 111',
          isInsured: true,
          isTenant: false,
        },
        {
          firstName: 'Alex',
          lastName: 'Tenant',
          homePhone: '07 4444 4444',
          isInsured: false,
          isTenant: true,
        },
      ];
      continue;
    }

    if (prop.type === 'string') {
      if (parentKey === 'organization' && key === 'name') {
        result[key] = 'Acme Co';
      } else if (key.toLowerCase().includes('date')) {
        result[key] = '2026-01-15';
      } else {
        result[key] = `sample_${key}`;
      }
    } else if (prop.type === 'number' || prop.type === 'integer') {
      result[key] = 0;
    } else if (prop.type === 'boolean') {
      result[key] = key === 'includePricing' || key === 'includeQuantities';
    } else if (prop.type === 'array' && prop.items) {
      const item =
        prop.items.type === 'object' && prop.items.properties
          ? generateSampleFromSchema(prop.items as JsonSchemaObject, key)
          : `sample_item`;
      result[key] = [item];
    } else if (prop.type === 'object' && prop.properties) {
      result[key] = generateSampleFromSchema(prop as JsonSchemaObject, key);
    } else if (prop.type === 'object') {
      if (key === 'rfqTo') {
        result[key] = {
          name: 'Supplier Co',
          email: 'supplier@example.com',
          company: 'Supplier Co',
          address: '1 Vendor Rd',
        };
      } else if (key === 'rfqFrom') {
        result[key] = { name: 'Acme Co' };
      } else if (key === 'address' && parentKey === 'job') {
        result[key] = { streetNumber: '42', streetName: 'Main St' };
      } else {
        result[key] = {};
      }
    } else {
      result[key] = null;
    }
  }
  return result;
}

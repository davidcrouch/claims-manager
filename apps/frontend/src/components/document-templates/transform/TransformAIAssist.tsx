'use client';

import { useCallback, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { buildAIContext, type AIContextPayload } from '@/lib/ai/use-ai-context';
import { useTransformEditor } from './TransformEditorContext';

export function TransformAIAssistButton() {
  const {
    documentType,
    sourceSchema,
    targetSchema,
    jsonataRules,
    testData,
    setJsonataRules,
  } = useTransformEditor();

  const [chatOpen, setChatOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AIContextPayload | undefined>();

  const handleOpen = useCallback(() => {
    const ctx = buildAIContext(
      'TransformEditor',
      { documentType },
      {
        entityType: 'document_template_transform',
        formState: {
          documentType,
          jsonataRules,
          sourceSchema,
          targetSchema,
          testData: testData ? safeParseJson(testData) : null,
        },
        summary: [
          `You are helping the user write JSONata transformation rules for the "${documentType}" document type.`,
          '',
          'The source schema (mapper output) defines the fields available as JSONata input.',
          'The target schema defines the simplified merge-field structure used in Word templates.',
          'JSONata rules transform source → target.',
          '',
          'When suggesting JSONata rules:',
          '- Always output the COMPLETE JSONata expression (not just a fragment)',
          '- Use the exact field names from the source schema',
          '- Match the target schema structure',
          '- Wrap expressions in a JSON object literal using JSONata syntax',
          '- Use `$` to reference the root input object',
          '',
          'When the user asks you to write or update rules, respond with the full JSONata expression in a code block.',
          'The user can copy it into the editor.',
          '',
          'Current JSONata rules:',
          '```jsonata',
          jsonataRules || '(none — using built-in defaults)',
          '```',
        ].join('\n'),
      },
    );
    setAiContext(ctx);
    setChatOpen(true);
  }, [documentType, jsonataRules, sourceSchema, targetSchema, testData]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleOpen}
        className="gap-1.5"
      >
        <Sparkles className="size-3.5" />
        AI assist
      </Button>
      <ChatDrawer
        open={chatOpen}
        onOpenChange={setChatOpen}
        initialContext={aiContext}
        besideCanvas
      />
    </>
  );
}

function safeParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

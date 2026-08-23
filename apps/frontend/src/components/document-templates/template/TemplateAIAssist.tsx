'use client';

import { useCallback, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { buildAIContext, type AIContextPayload } from '@/lib/ai/use-ai-context';
import { useTemplateEditor } from './TemplateEditorContext';

export function TemplateAIAssistButton() {
  const {
    documentType,
    htmlContent,
    templateTags,
  } = useTemplateEditor();

  const [chatOpen, setChatOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AIContextPayload | undefined>();

  const handleOpen = useCallback(() => {
    const ctx = buildAIContext(
      'TemplateEditor',
      { documentType },
      {
        entityType: 'document_template',
        formState: {
          documentType,
          templateTags,
          currentHtml: htmlContent.slice(0, 8000),
        },
        summary: [
          `You are helping the user edit a Word document template for the "${documentType}" document type.`,
          '',
          'This template uses the docx-templates engine syntax:',
          '- `<<fieldName>>` — insert a merge field value',
          '- `<<FOR item IN items>>...<<END-FOR item>>` — loop over an array',
          '- `<<IF condition>>...<<END-IF>>` — conditional section',
          '- JavaScript expressions are evaluated in template commands',
          '',
          templateTags.length > 0
            ? `Current template merge tags found in the document:\n${templateTags.map((t) => `  - <<${t}>>`).join('\n')}`
            : 'No merge tags have been found yet — the template may not be assigned or may be empty.',
          '',
          'When the user asks you to create or modify template content:',
          '- Output complete HTML content in a code block',
          '- Include docx-templates merge tags using `<<fieldName>>` syntax',
          '- Use semantic HTML (headings, paragraphs, tables, lists)',
          '- The user can copy your output into the editor',
          '',
          'Current template content (first 8000 chars):',
          '```html',
          htmlContent.slice(0, 8000) || '(empty — no template loaded)',
          '```',
        ].join('\n'),
      },
    );
    setAiContext(ctx);
    setChatOpen(true);
  }, [documentType, htmlContent, templateTags]);

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

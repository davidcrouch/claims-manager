'use client';

import { useCallback, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { listChatAgentsAction } from '@/app/(app)/chat/actions';
import { buildAIContext, type AIContextPayload } from '@/lib/ai/use-ai-context';

interface ReportBuilderButtonProps {
  documentType: string;
  label: string;
}

const REPORT_BUILDER_SLUG = 'report-builder';

export function ReportBuilderButton({ documentType, label }: ReportBuilderButtonProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AIContextPayload | undefined>();
  const [agentId, setAgentId] = useState<string | undefined>();

  const handleOpen = useCallback(async () => {
    let dataContextSummary = 'Data context definition not loaded.';
    let transformSummary = 'Transform not loaded.';
    let templateTagsSummary = 'Template tags not loaded.';
    let resolvedAgentId: string | undefined;

    try {
      const [ctxRes, transformRes, tagsRes, agents] = await Promise.all([
        fetch(`/api/document-templates/data-context/${encodeURIComponent(documentType)}`),
        fetch(`/api/document-templates/transforms/${encodeURIComponent(documentType)}`),
        fetch(`/api/document-templates/${encodeURIComponent(documentType)}/tags`).catch(
          () => null,
        ),
        listChatAgentsAction().catch(() => []),
      ]);

      const match = agents.find(
        (a) =>
          a.slug === REPORT_BUILDER_SLUG ||
          a.name?.toLowerCase().includes('report builder'),
      );
      resolvedAgentId = match?.id;

      if (ctxRes.ok) {
        const ctx = await ctxRes.json();
        if (!ctx.available) {
          dataContextSummary =
            'No data context definition for this type — built-in mapper only.';
        } else {
          const related = (ctx.definition?.relatedEntities ?? [])
            .map(
              (r: { slug: string; label: string; defaultEnabled: boolean }) =>
                `  - ${r.slug} (${r.label})${r.defaultEnabled ? ' [default on]' : ''}`,
            )
            .join('\n');
          dataContextSummary = [
            `Primary: ${ctx.definition?.primaryEntity?.label ?? 'unknown'}`,
            `Enabled slugs: ${(ctx.enabledSlugs ?? []).join(', ') || '(none)'}`,
            'Related entities:',
            related || '  (none)',
          ].join('\n');
        }
      }

      if (transformRes.ok) {
        const t = await transformRes.json();
        transformSummary = t.jsonataRules
          ? `Current JSONata:\n\`\`\`jsonata\n${String(t.jsonataRules).slice(0, 4000)}\n\`\`\``
          : 'No custom JSONata — using built-in defaults or pass-through.';
      }

      if (tagsRes?.ok) {
        const tags = await tagsRes.json();
        const list = Array.isArray(tags.tags) ? tags.tags : [];
        templateTagsSummary =
          list.length > 0
            ? `Current merge tags:\n${list.map((t: string) => `  - {${t}}`).join('\n')}`
            : 'No merge tags found in the assigned template.';
      }
    } catch {
      // Context is best-effort; chat still opens.
    }

    const ctx = buildAIContext(
      'ReportBuilder',
      { documentType },
      {
        entityType: 'document_template',
        formState: { documentType, label },
        summary: [
          `You are helping build the full report pipeline for "${label}" (${documentType}).`,
          '',
          'Pipeline parts: (1) data sources / related entities, (2) JSONata transform, (3) Word template with Docxtemplater tags.',
          '',
          'Docxtemplater syntax: {field}, {#items}...{/items}, {= expression}.',
          '',
          '## Data sources',
          dataContextSummary,
          '',
          '## Transform',
          transformSummary,
          '',
          '## Template',
          templateTagsSummary,
          '',
          'Prefer report-builder tools to list/update data context, set JSONata, and generate a test document.',
          'Confirm before saving changes.',
        ].join('\n'),
      },
    );
    setAiContext(ctx);
    setAgentId(resolvedAgentId);
    setChatOpen(true);
  }, [documentType, label]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void handleOpen()}
        className="gap-1.5"
      >
        <Sparkles className="size-3.5" />
        Report builder
      </Button>
      <ChatDrawer
        open={chatOpen}
        onOpenChange={setChatOpen}
        initialContext={aiContext}
        agentId={agentId}
        besideCanvas
      />
    </>
  );
}

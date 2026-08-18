'use client';

import { Bot, Layers, Package, Sparkles } from 'lucide-react';
import type { CapabilityPackPreview } from '@/lib/api-client';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
} from '@/components/forms/BottomFormDrawer';

interface CapabilityPackDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: CapabilityPackPreview | null;
  loading?: boolean;
  error?: string | null;
}

export function CapabilityPackDetailDrawer({
  open,
  onOpenChange,
  preview,
  loading = false,
  error = null,
}: CapabilityPackDetailDrawerProps) {
  const description = preview
    ? `${preview.packId} @ ${preview.version} · ${preview.source}`
    : loading
      ? 'Loading pack contents…'
      : 'Preview agents, skills, and integrations before install.';

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={preview?.name ?? 'Pack details'}
      description={description}
      icon={<Package className="h-5 w-5" />}
    >
      <BottomFormDrawerBody>
        <BottomFormDrawerError error={error} className="mt-0 mb-5" />

        {loading && !preview ? (
          <p className="text-sm text-muted-foreground">Loading pack contents…</p>
        ) : null}

        {!loading && !error && preview ? (
          <div className="space-y-8">
            {preview.description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {preview.description}
              </p>
            ) : null}

            <section className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                Integrations
              </h3>
              {preview.integrationRefs.length ? (
                <ul className="space-y-2 text-sm">
                  {preview.integrationRefs.map((name) => (
                    <li key={name} className="rounded-md border px-3 py-2.5">
                      {name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">None declared</p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
                Agents ({preview.agents.length})
              </h3>
              <ul className="space-y-3">
                {preview.agents.map((agent) => (
                  <li key={agent.slug} className="rounded-md border px-4 py-3">
                    <div className="text-sm font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">{agent.slug}</div>
                    {agent.description ? (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {agent.description}
                      </p>
                    ) : null}
                    {agent.enabledTools.length ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Tools: {agent.enabledTools.slice(0, 8).join(', ')}
                        {agent.enabledTools.length > 8
                          ? ` +${agent.enabledTools.length - 8} more`
                          : ''}
                      </p>
                    ) : null}
                    {agent.pinnedSkillSlugs.length ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pinned skills: {agent.pinnedSkillSlugs.join(', ')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Skills ({preview.skills.length})
              </h3>
              <ul className="space-y-3">
                {preview.skills.map((skill) => (
                  <li key={skill.slug} className="rounded-md border px-4 py-3">
                    <div className="text-sm font-medium">{skill.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {skill.slug} · {skill.category}
                    </div>
                    {skill.description ? (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {skill.description}
                      </p>
                    ) : null}
                    {skill.requiredTools.length ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Requires: {skill.requiredTools.join(', ')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            {preview.prompts.length ? (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prompts ({preview.prompts.length})
                </h3>
                <ul className="space-y-3">
                  {preview.prompts.map((prompt) => (
                    <li key={prompt.slug} className="rounded-md border px-4 py-3 text-sm">
                      <div className="font-medium">{prompt.name}</div>
                      <div className="text-xs text-muted-foreground">{prompt.slug}</div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </BottomFormDrawerBody>
    </BottomFormDrawer>
  );
}

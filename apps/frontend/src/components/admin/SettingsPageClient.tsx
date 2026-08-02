'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Settings,
  Plug,
  Bell,
  CreditCard,
  ToggleLeft,
  Bot,
  Sparkles,
  Server,
  Cable,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { cn } from '@/lib/utils';
import { FeaturesSettingsPanel } from './FeaturesSettingsPanel';
import type { FeatureDef } from '@/app/(app)/admin/settings/features-actions';

const TABS = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'features', label: 'Features', icon: ToggleLeft },
  { id: 'ai', label: 'AI & Integrations', icon: Bot },
  { id: 'connections', label: 'Connections', icon: Plug },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'billing', label: 'Billing', icon: CreditCard },
] as const;

const AI_LINKS = [
  {
    title: 'Agents',
    description: 'Configure AI personas, models, tools, and skills',
    href: '/admin/agents',
    icon: Bot,
  },
  {
    title: 'Skills',
    description: 'Reusable instruction sets with semantic matching',
    href: '/admin/skills',
    icon: Sparkles,
  },
  {
    title: 'MCP Servers',
    description: 'Manage MCP integrations and discovery',
    href: '/admin/mcp-servers',
    icon: Server,
  },
  {
    title: 'MCP Connections',
    description: 'User and org credentials for MCP tools',
    href: '/mcp-connections',
    icon: Cable,
  },
  {
    title: 'AI Audit',
    description: 'Token usage, models, and message audits',
    href: '/admin/ai-audit',
    icon: BarChart3,
  },
] as const;

interface Props {
  initialTab: string;
  features: FeatureDef[];
  featuresError?: string | null;
  canManageFeatures: boolean;
}

export function SettingsPageClient({
  initialTab,
  features,
  featuresError,
  canManageFeatures,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') ?? initialTab;

  function switchTab(tabId: string) {
    router.push(`/admin/settings?tab=${tabId}`);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={Settings}
          title="Settings"
          total={0}
          accent="slate"
        />
      </SetPageHeader>

      <div className="px-6 pt-1">
        <div className="flex flex-wrap gap-0 border-b border-slate-200">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchTab(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-md',
                  active
                    ? 'border-slate-600 bg-slate-50 text-slate-800'
                    : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 pt-4" style={{ minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'general' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Organisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Organisation Name</label>
                    <input type="text" disabled placeholder="Your organisation name" className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">ABN / Business Number</label>
                    <input type="text" disabled placeholder="Business registration number" className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Contact Email</label>
                    <input type="email" disabled placeholder="admin@example.com" className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <input type="tel" disabled placeholder="+61 ..." className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <input type="text" disabled placeholder="Organisation address" className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Organisation settings will be editable once the settings API is connected.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'features' && (
          <FeaturesSettingsPanel
            initialFeatures={features}
            initialError={featuresError}
            canManage={canManageFeatures}
          />
        )}

        {activeTab === 'ai' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AI_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-lg border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:text-blue-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                </Link>
              );
            })}
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10">
                <Plug className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Connections have moved to their own page.
                </p>
                <a
                  href="/connections"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                >
                  Go to Connections
                </a>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Email Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {['New claim received', 'Job status changed', 'Invoice submitted', 'Work order issued', 'Task overdue'].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                    <span className="text-sm">{item}</span>
                    <div className="h-5 w-9 rounded-full bg-muted/50" title="Toggle will be functional once the notifications API is connected" />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Notification preferences will be configurable once the notifications API is connected.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Current Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Subscription details will appear here once billing is configured.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

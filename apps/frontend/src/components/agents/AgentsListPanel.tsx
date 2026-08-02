'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AI_PROVIDER_LABELS, type Agent } from '@/lib/ai/types';
import { listAgentsAction, deleteAgentAction } from '@/app/(app)/admin/agents/actions';
import { CreateAgentDrawer } from './CreateAgentDrawer';
import { AgentConfigDrawer } from './AgentConfigDrawer';

export function AgentsListPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const rows = await listAgentsAction();
    setAgents(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openAgent = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
    setDrawerOpen(true);
  }, []);

  const handleSaved = useCallback((savedAgent: Agent) => {
    setAgents((current) =>
      current.map((agent) => (agent.id === savedAgent.id ? savedAgent : agent)),
    );
    setSelectedAgent(savedAgent);
  }, []);

  async function handleDelete(agent: Agent, e: React.MouseEvent) {
    e.stopPropagation();
    if (agent.isDefault || agent.type === 'system') return;
    if (!window.confirm(`Delete agent "${agent.name}"?`)) return;
    const result = await deleteAgentAction(agent.id);
    if (result.success) {
      setAgents((current) => current.filter((a) => a.id !== agent.id));
      if (selectedAgent?.id === agent.id) {
        setDrawerOpen(false);
        setSelectedAgent(null);
      }
    } else {
      alert(result.error ?? 'Delete failed');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <CreateAgentDrawer onCreated={(agent) => setAgents((c) => [...c, agent])} />
      </div>

      {agents.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
          No agents configured yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 font-medium text-slate-600">Provider</th>
                <th className="px-4 py-3 font-medium text-slate-600">Model</th>
                <th className="px-4 py-3 font-medium text-slate-600">Temperature</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.map((agent) => (
                <tr
                  key={agent.id}
                  className="cursor-pointer hover:bg-slate-50/50"
                  onClick={() => openAgent(agent)}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                      <Bot className="h-4 w-4 text-slate-400" />
                      {agent.name}
                      {agent.isDefault && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          Default
                        </span>
                      )}
                      {agent.type === 'system' && (
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                          System
                        </span>
                      )}
                      {agent.chatEnabled === false && (
                        <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                          Hidden from Chat
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {AI_PROVIDER_LABELS[agent.provider] ?? agent.provider}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{agent.model}</td>
                  <td className="px-4 py-3 text-slate-600">{agent.temperature}</td>
                  <td className="px-4 py-3 text-right">
                    {!agent.isDefault && agent.type !== 'system' && (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={(e) => void handleDelete(agent, e)}
                        title="Delete agent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AgentConfigDrawer
        agent={selectedAgent}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSaved={handleSaved}
      />
    </>
  );
}

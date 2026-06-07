'use client';

import { useEffect, useState } from 'react';
import { ListTodo, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { fetchJobTasksAction } from '@/app/(app)/jobs/[id]/actions';
import { formatDate, PhaseUnavailable } from '@/components/shared/detail';
import { TaskFormDrawer } from '@/components/forms/TaskFormDrawer';
import type { Task, LookupRef } from '@/types/api';

function refName(value: string | LookupRef | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value.name ?? value.externalReference ?? '—';
}

export function JobTasksTab({ jobId }: { jobId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseUnavailable, setPhaseUnavailable] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchJobTasksAction(jobId);
      if (cancelled) return;
      setTasks(res.data);
      setPhaseUnavailable(res.phaseUnavailable);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, refreshKey]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (phaseUnavailable) {
    return <PhaseUnavailable phase="Phase 2" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          Tasks ({tasks.length})
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3 w-3" />
          Create Task
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        {tasks.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            No tasks linked to this job.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Priority</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Due date</th>
                  <th className="px-4 py-2">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tasks.map((t) => {
                  const statusName = refName(t.status);
                  return (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">{t.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {refName(t.taskType)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {refName(t.priority)}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={statusName} />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(t.dueDate)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {t.assigneeName ?? t.assignedToUserId ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <TaskFormDrawer
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) setRefreshKey((k) => k + 1);
        }}
        jobId={jobId}
      />
    </Card>
  );
}

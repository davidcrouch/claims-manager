'use client';

import { useState } from 'react';
import { Loader2, Search, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Skill } from '@/lib/ai/types';
import { testMatchAction } from '@/app/(app)/admin/skills/actions';

interface SkillTestPanelProps {
  skill: Skill;
}

export function SkillTestPanel({ skill }: SkillTestPanelProps) {
  const [testMessage, setTestMessage] = useState('');
  const [matchResults, setMatchResults] = useState<Array<{ id: string; name: string; similarity: number }> | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const handleMatchTest = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestError(null);
    setMatchResults(null);

    const result = await testMatchAction(testMessage);
    setTesting(false);
    if (result.error) {
      setTestError(result.error);
    } else {
      setMatchResults(result.matches ?? []);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Search className="h-4 w-4 text-slate-400" />
          Match Test
        </h3>
        <p className="mb-4 text-xs text-slate-500">
          Enter a message to test whether this skill would be surfaced by semantic matching.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleMatchTest()}
            className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            placeholder="Type a message to test matching..."
          />
          <Button
            size="sm"
            onClick={handleMatchTest}
            disabled={testing || !testMessage.trim()}
            className="gap-1.5"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Test
          </Button>
        </div>

        {testError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {testError}
          </div>
        )}

        {matchResults !== null && (
          <div className="mt-4 space-y-2">
            {matchResults.length === 0 ? (
              <p className="text-xs text-slate-500">No skills matched this message.</p>
            ) : (
              matchResults.map((match) => (
                <div
                  key={match.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
                    match.id === skill.id
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="font-medium">{match.name}</span>
                  <span className="font-mono">{(match.similarity * 100).toFixed(1)}%</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

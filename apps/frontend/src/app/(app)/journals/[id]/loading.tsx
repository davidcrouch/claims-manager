import { Loader2 } from 'lucide-react';

export default function JournalDetailLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-sm font-medium text-slate-900">Loading journal…</p>
    </div>
  );
}

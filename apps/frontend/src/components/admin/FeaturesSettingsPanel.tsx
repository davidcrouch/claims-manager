'use client';

import { useCallback, useState, useTransition } from 'react';
import { Loader2, Plus, Search, ToggleLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { cn } from '@/lib/utils';
import {
  createFeatureAction,
  deleteFeatureAction,
  updateFeatureAction,
  type FeatureDef,
} from '@/app/(app)/admin/settings/features-actions';

interface Props {
  initialFeatures: FeatureDef[];
  initialError?: string | null;
  canManage: boolean;
}

export function FeaturesSettingsPanel({
  initialFeatures,
  initialError,
  canManage,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [features, setFeatures] = useState(initialFeatures);
  const [searchText, setSearchText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(initialError ?? null);

  const [formKey, setFormKey] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDefault, setFormDefault] = useState(true);

  const filtered = features.filter((f) => {
    if (!searchText) return true;
    const lower = searchText.toLowerCase();
    return (
      f.featureKey.toLowerCase().includes(lower) ||
      (f.label ?? '').toLowerCase().includes(lower) ||
      (f.description ?? '').toLowerCase().includes(lower)
    );
  });

  const resetForm = useCallback(() => {
    setFormKey('');
    setFormLabel('');
    setFormDescription('');
    setFormDefault(true);
    setFormError(null);
    setShowAddForm(false);
    setEditingId(null);
  }, []);

  const startEdit = useCallback((f: FeatureDef) => {
    setEditingId(f.id);
    setFormKey(f.featureKey);
    setFormLabel(f.label ?? '');
    setFormDescription(f.description ?? '');
    setFormDefault(f.defaultEnabled);
    setFormError(null);
    setShowAddForm(false);
  }, []);

  const handleAdd = useCallback(() => {
    setFormError(null);
    if (!formKey.trim() || !formLabel.trim()) {
      setFormError('Feature key and label are required');
      return;
    }
    startTransition(async () => {
      const result = await createFeatureAction({
        featureKey: formKey.trim(),
        label: formLabel.trim(),
        description: formDescription.trim() || undefined,
        defaultEnabled: formDefault,
      });
      if (result.error || !result.feature) {
        setFormError(result.error ?? 'Failed to create feature');
        return;
      }
      setFeatures((prev) => [...prev, result.feature!]);
      resetForm();
    });
  }, [formKey, formLabel, formDescription, formDefault, resetForm]);

  const handleUpdate = useCallback(() => {
    if (!editingId) return;
    setFormError(null);
    startTransition(async () => {
      const result = await updateFeatureAction(editingId, {
        label: formLabel.trim() || undefined,
        description: formDescription.trim() || undefined,
        defaultEnabled: formDefault,
      });
      if (result.error || !result.feature) {
        setFormError(result.error ?? 'Failed to update feature');
        return;
      }
      setFeatures((prev) => prev.map((f) => (f.id === editingId ? result.feature! : f)));
      resetForm();
    });
  }, [editingId, formLabel, formDescription, formDefault, resetForm]);

  const handleDelete = useCallback((featureId: string) => {
    if (!confirm('Delete this feature definition? All grants will also be removed.')) return;
    startTransition(async () => {
      const result = await deleteFeatureAction(featureId);
      if (!result.success) {
        setFormError(result.error ?? 'Failed to delete feature');
        return;
      }
      setFeatures((prev) => prev.filter((f) => f.id !== featureId));
    });
  }, []);

  const handleDefaultToggle = useCallback((feature: FeatureDef) => {
    startTransition(async () => {
      const result = await updateFeatureAction(feature.id, {
        defaultEnabled: !feature.defaultEnabled,
      });
      if (result.error || !result.feature) {
        setFormError(result.error ?? 'Failed to toggle default');
        return;
      }
      setFeatures((prev) => prev.map((f) => (f.id === feature.id ? result.feature! : f)));
    });
  }, []);

  return (
    <div className="space-y-4">
      <SetHeaderActions>
        {canManage && (
          <Button
            size="default"
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            disabled={isPending}
            className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Feature
          </Button>
        )}
      </SetHeaderActions>

      <div className="flex items-center gap-2">
        <ToggleLeft className="h-5 w-5 text-slate-500" />
        <h2 className="text-lg font-semibold text-slate-800">Features</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {features.length}
        </span>
      </div>

      <p className="text-xs text-slate-500">
        Default-enabled features are included in new sessions. Re-login after changing defaults
        to refresh your token.
      </p>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search features…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {showAddForm && (
        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-medium text-slate-800">New Feature</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              placeholder="Feature key (e.g. ai.chat)"
              value={formKey}
              onChange={(e) => setFormKey(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Label"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              placeholder="Description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={formDefault}
              onChange={(e) => setFormDefault(e.target.checked)}
              className="rounded border-slate-300"
            />
            Enabled by default
          </label>
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={isPending}>
              {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {formError && !showAddForm && !editingId && (
        <p className="text-xs text-red-600">{formError}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Feature</th>
              <th className="px-3 py-2 text-center">Default</th>
              {canManage && <th className="px-3 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 3 : 2} className="px-3 py-8 text-center text-slate-400">
                  No features found
                </td>
              </tr>
            ) : (
              filtered.map((feature) => (
                <tr key={feature.id} className="hover:bg-slate-50">
                  {editingId === feature.id ? (
                    <td className="px-3 py-2" colSpan={canManage ? 3 : 2}>
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            placeholder="Label"
                            value={formLabel}
                            onChange={(e) => setFormLabel(e.target.value)}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                          />
                          <input
                            placeholder="Description"
                            value={formDescription}
                            onChange={(e) => setFormDescription(e.target.value)}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={formDefault}
                            onChange={(e) => setFormDefault(e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          Default enabled
                        </label>
                        {formError && <p className="text-xs text-red-600">{formError}</p>}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleUpdate} disabled={isPending}>
                            {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={resetForm}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2">
                        <div>
                          <span className="font-mono text-xs text-blue-600">{feature.featureKey}</span>
                          <div className="text-slate-800">{feature.label ?? feature.featureKey}</div>
                          {feature.description && (
                            <div className="text-xs text-slate-500">{feature.description}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          disabled={!canManage || isPending}
                          onClick={() => handleDefaultToggle(feature)}
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                            feature.defaultEnabled
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                            (!canManage || isPending) && 'cursor-default opacity-70',
                          )}
                        >
                          {feature.defaultEnabled ? 'On' : 'Off'}
                        </button>
                      </td>
                      {canManage && (
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(feature)}
                              disabled={isPending}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(feature.id)}
                              disabled={isPending}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

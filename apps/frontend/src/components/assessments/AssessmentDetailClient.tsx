'use client';

import { useCallback, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  Home,
  MessageSquare,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { PrintButton } from '@/components/shared/PrintButton';
import { updateAssessmentAction } from '@/app/(app)/assessments/actions';
import type { Assessment } from '@/types/api';

export interface AssessmentDetailClientProps {
  assessment: Assessment;
}

const CLAIM_RECOMMENDATIONS = ['Approve', 'Decline', 'Refer', 'Pending'];
const MAKE_SAFE_TYPES = ['Tarp', 'Board Up', 'Temporary Fence', 'Other'];
const DESIGN_TYPES = ['Standard', 'Custom', 'Heritage', 'Multi-storey'];
const CONSTRUCTION_TYPES = ['Brick Veneer', 'Double Brick', 'Weatherboard', 'Fibro', 'Concrete', 'Steel Frame', 'Other'];
const ROOF_TYPES = ['Tile', 'Metal', 'Slate', 'Flat', 'Colorbond', 'Other'];
const BUILDING_TYPES = ['House', 'Unit', 'Townhouse', 'Duplex', 'Commercial', 'Other'];

const EMPTY_PLACEHOLDER = '__empty__';

const VALID_TABS = [
  'building',
  'general',
  'hazards',
  'accommodation',
  'other',
] as const;

type TabValue = (typeof VALID_TABS)[number];

type FormData = Omit<
  Assessment,
  | 'id'
  | 'tenantId'
  | 'createdByUserId'
  | 'updatedByUserId'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
>;

function normaliseTab(raw: string | null): TabValue {
  if (!raw) return 'building';
  return VALID_TABS.find((t) => t === raw) ?? 'building';
}

function toFormData(a: Assessment): FormData {
  const {
    id: _,
    tenantId: _t,
    createdByUserId: _c,
    updatedByUserId: _u,
    createdAt: _ca,
    updatedAt: _ua,
    deletedAt: _da,
    ...rest
  } = a;
  return rest;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string) => void;
}) {
  const items: Record<string, string> = { [EMPTY_PLACEHOLDER]: '' };
  for (const opt of options) {
    items[opt] = opt;
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-500">{label}</Label>
      <Select
        value={value || EMPTY_PLACEHOLDER}
        onValueChange={(v) => onChange(!v || v === EMPTY_PLACEHOLDER ? '' : v)}
        items={items}
      >
        <SelectTrigger className="h-9 w-full">
          <SelectValue placeholder="Select...">
            {(selected: string | null) =>
              !selected || selected === EMPTY_PLACEHOLDER ? '' : (items[selected] ?? selected)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_PLACEHOLDER}>-- None --</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CheckField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal text-slate-700">
        {label}
      </Label>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  multiline,
  type,
  placeholder,
}: {
  label: string;
  value: string | number | null;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-500">{label}</Label>
      {multiline ? (
        <Textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="text-sm"
        />
      ) : (
        <Input
          type={type ?? 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 text-sm"
        />
      )}
    </div>
  );
}

function TabPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

const DETAIL_TABS: Array<{ id: TabValue; label: string; icon: typeof Building2 }> = [
  { id: 'building', label: 'Building Structure', icon: Building2 },
  { id: 'general', label: 'General Questions', icon: ClipboardCheck },
  { id: 'hazards', label: 'Site Hazards', icon: AlertTriangle },
  { id: 'accommodation', label: 'Temporary Accommodation', icon: Home },
  { id: 'other', label: 'Other', icon: MessageSquare },
];

export function AssessmentDetailClient({ assessment }: AssessmentDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = normaliseTab(searchParams.get('tab'));
  const [form, setForm] = useState<FormData>(toFormData(assessment));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const onTabChange = useCallback(
    (value: TabValue) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value === 'building') {
        sp.delete('tab');
      } else {
        sp.set('tab', value);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const update = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAssessmentAction(assessment.id, {
        ...form,
        squares: form.squares != null && form.squares !== '' ? form.squares : null,
        squareMetres: form.squareMetres != null && form.squareMetres !== '' ? form.squareMetres : null,
      } as Partial<Assessment>);
      setSaved(true);
      router.refresh();
    } catch (err) {
      console.error('AssessmentDetailClient.handleSave:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <SetHeaderActions>
        <Button
          size="default"
          onClick={handleSave}
          disabled={saving}
          className="h-9 gap-1.5 bg-blue-600 text-white hover:bg-blue-500"
        >
          <Save className="size-4" />
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
        </Button>
        <PrintButton
          documentType="assessment"
          entityId={assessment.id}
          jobId={assessment.jobId ?? undefined}
        />
        <ArchiveEntityButton
          entityType="assessment"
          entityId={assessment.id}
          statusName={assessment.status}
          entityLabel={assessment.name}
          redirectTo="/assessments"
          className="mr-3"
        />
      </SetHeaderActions>

      <div className="flex items-center border-b border-slate-200">
        <div className="flex flex-wrap gap-0">
          {DETAIL_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`-mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-600'
                    : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4 pb-12">
        {activeTab === 'building' && (
          <TabPanel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                label="Claim Recommendation"
                value={form.claimRecommendation}
                options={CLAIM_RECOMMENDATIONS}
                onChange={(v) => update('claimRecommendation', v || null)}
              />
              <SelectField
                label="Design Type"
                value={form.designType}
                options={DESIGN_TYPES}
                onChange={(v) => update('designType', v || null)}
              />
              <SelectField
                label="Construction"
                value={form.construction}
                options={CONSTRUCTION_TYPES}
                onChange={(v) => update('construction', v || null)}
              />
              <SelectField
                label="Roof Type"
                value={form.roofType}
                options={ROOF_TYPES}
                onChange={(v) => update('roofType', v || null)}
              />
              <SelectField
                label="Building Type"
                value={form.buildingType}
                options={BUILDING_TYPES}
                onChange={(v) => update('buildingType', v || null)}
              />
              <SelectField
                label="Make Safe Type"
                value={form.makeSafeType}
                options={MAKE_SAFE_TYPES}
                onChange={(v) => update('makeSafeType', v || null)}
              />
              <TextField
                label="Squares"
                value={form.squares}
                onChange={(v) => update('squares', v || null)}
                type="number"
                placeholder="0"
              />
              <TextField
                label="Building Age (years)"
                value={form.buildingAge}
                onChange={(v) => update('buildingAge', v ? parseInt(v, 10) : null)}
                type="number"
                placeholder="0"
              />
              <TextField
                label="Square Metres"
                value={form.squareMetres}
                onChange={(v) => update('squareMetres', v || null)}
                type="number"
                placeholder="0"
              />
              <TextField
                label="Date Booked"
                value={form.dateBooked}
                onChange={(v) => update('dateBooked', v || null)}
                type="date"
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              <CheckField
                id="make-safe"
                label="Make Safe"
                checked={form.makeSafe}
                onChange={(v) => update('makeSafe', v)}
              />
              <CheckField
                id="overall-condition"
                label="Overall Condition Acceptable"
                checked={form.overallConditionAcceptable}
                onChange={(v) => update('overallConditionAcceptable', v)}
              />
              <CheckField
                id="iag-inspection"
                label="IAG Inspection Required"
                checked={form.iagInspectionRequired}
                onChange={(v) => update('iagInspectionRequired', v)}
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'general' && (
          <TabPanel>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Make-safe Completion Date"
                value={form.makeSafeCompletionDate}
                onChange={(v) => update('makeSafeCompletionDate', v || null)}
                type="date"
              />
              <TextField
                label="Date Main Roof Repaired"
                value={form.dateMainRoofRepaired}
                onChange={(v) => update('dateMainRoofRepaired', v || null)}
                type="date"
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              <CheckField
                id="main-roof-damage"
                label="Main Roof Damage"
                checked={form.mainRoofDamage}
                onChange={(v) => update('mainRoofDamage', v)}
              />
              <CheckField
                id="habitable"
                label="Habitable"
                checked={form.habitable}
                onChange={(v) => update('habitable', v)}
              />
              <CheckField
                id="mould"
                label="Mould"
                checked={form.mould}
                onChange={(v) => update('mould', v)}
              />
              <CheckField
                id="asbestos"
                label="Asbestos on Site"
                checked={form.asbestosOnSite}
                onChange={(v) => update('asbestosOnSite', v)}
              />
              <CheckField
                id="detached-garage"
                label="Detached Garage"
                checked={form.detachedGarage}
                onChange={(v) => update('detachedGarage', v)}
              />
              <CheckField
                id="sheds"
                label="Sheds"
                checked={form.sheds}
                onChange={(v) => update('sheds', v)}
              />
              <CheckField
                id="swimming-pool"
                label="Swimming Pool"
                checked={form.swimmingPool}
                onChange={(v) => update('swimmingPool', v)}
              />
              <CheckField
                id="detached-granny-flat"
                label="Detached Granny Flat"
                checked={form.detachedGrannyFlat}
                onChange={(v) => update('detachedGrannyFlat', v)}
              />
              <CheckField
                id="damage-listed-event"
                label="Damage Caused by Listed Event"
                checked={form.damageCausedByListedEvent}
                onChange={(v) => update('damageCausedByListedEvent', v)}
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'hazards' && (
          <TabPanel>
            <div className="space-y-4">
              {(
                [
                  {
                    id: 'hazard-pool-fencing',
                    label: 'Pool Fencing',
                    checkedKey: 'hazardPoolFencing' as const,
                    commentKey: 'hazardPoolFencingComment' as const,
                    commentLabel: 'What is the pool fencing hazard?',
                  },
                  {
                    id: 'hazard-electrical-gas',
                    label: 'Electrical / Gas',
                    checkedKey: 'hazardElectricalGas' as const,
                    commentKey: 'hazardElectricalGasComment' as const,
                    commentLabel: 'What is the electrical / gas hazard?',
                  },
                  {
                    id: 'hazard-sewerage',
                    label: 'Sewerage',
                    checkedKey: 'hazardSewerage' as const,
                    commentKey: 'hazardSewerageComment' as const,
                    commentLabel: 'What is the sewerage hazard?',
                  },
                  {
                    id: 'hazard-structural',
                    label: 'Structural',
                    checkedKey: 'hazardStructural' as const,
                    commentKey: 'hazardStructuralComment' as const,
                    commentLabel: 'What is the structural hazard?',
                  },
                ] as const
              ).map((hazard) => (
                <div key={hazard.id} className="space-y-4">
                  <CheckField
                    id={hazard.id}
                    label={hazard.label}
                    checked={form[hazard.checkedKey]}
                    onChange={(v) => update(hazard.checkedKey, v)}
                  />
                  <div className="pl-7">
                    <TextField
                      label={hazard.commentLabel}
                      value={form[hazard.commentKey]}
                      onChange={(v) => update(hazard.commentKey, v || null)}
                      multiline
                      placeholder="Describe the hazard..."
                    />
                  </div>
                </div>
              ))}

              <TextField
                label="Other Hazards"
                value={form.hazardOther}
                onChange={(v) => update('hazardOther', v || null)}
                multiline
                placeholder="Describe any other hazards..."
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'accommodation' && (
          <TabPanel>
            <div className="space-y-4">
              <CheckField
                id="temp-accom-immediately"
                label="Is temporary accommodation required immediately?"
                checked={form.tempAccomRequiredImmediately}
                onChange={(v) => update('tempAccomRequiredImmediately', v)}
              />
              {form.tempAccomRequiredImmediately && (
                <div className="pl-7">
                  <TextField
                    label="Estimated time for immediate temporary accommodation (days)"
                    value={form.tempAccomImmediateEstimateDays}
                    onChange={(v) =>
                      update('tempAccomImmediateEstimateDays', v ? parseInt(v, 10) : null)
                    }
                    type="number"
                    placeholder="0"
                  />
                </div>
              )}

              <TextField
                label="What temporary repairs are required to make home livable?"
                value={form.tempRepairsToMakeLivable}
                onChange={(v) => update('tempRepairsToMakeLivable', v || null)}
                multiline
                placeholder="Describe temporary repairs needed..."
              />

              <CheckField
                id="temp-accom-during-repairs"
                label="Is temporary accommodation required during repairs?"
                checked={form.tempAccomRequiredDuringRepairs}
                onChange={(v) => update('tempAccomRequiredDuringRepairs', v)}
              />
              {form.tempAccomRequiredDuringRepairs && (
                <div className="pl-7">
                  <TextField
                    label="Estimated time for temp accommodation during repairs (days)"
                    value={form.tempAccomRepairsEstimateDays}
                    onChange={(v) =>
                      update('tempAccomRepairsEstimateDays', v ? parseInt(v, 10) : null)
                    }
                    type="number"
                    placeholder="0"
                  />
                </div>
              )}

              <TextField
                label="Work to be completed when insured is in accommodation"
                value={form.workWhileInAccommodation}
                onChange={(v) => update('workWhileInAccommodation', v || null)}
                multiline
                placeholder="Describe work scope..."
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'other' && (
          <TabPanel>
            <div className="grid grid-cols-1 gap-4">
              <TextField
                label="Client Discussion"
                value={form.clientDiscussion}
                onChange={(v) => update('clientDiscussion', v || null)}
                multiline
                placeholder="Notes from client discussion..."
              />
              <TextField
                label="Resultant Damage"
                value={form.resultantDamage}
                onChange={(v) => update('resultantDamage', v || null)}
                multiline
                placeholder="Describe resultant damage..."
              />
              <TextField
                label="Cause of Damage"
                value={form.causeOfDamage}
                onChange={(v) => update('causeOfDamage', v || null)}
                multiline
                placeholder="Describe cause of damage..."
              />
              <TextField
                label="Maintenance Related Issues"
                value={form.maintenanceRelatedIssues}
                onChange={(v) => update('maintenanceRelatedIssues', v || null)}
                multiline
                placeholder="Describe any maintenance issues..."
              />
              <TextField
                label="Comments"
                value={form.comments}
                onChange={(v) => update('comments', v || null)}
                multiline
                placeholder="Additional comments..."
              />
              <TextField
                label="Variances of Scope"
                value={form.variancesOfScope}
                onChange={(v) => update('variancesOfScope', v || null)}
                multiline
                placeholder="Describe any variances..."
              />
            </div>
          </TabPanel>
        )}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  Home,
  Save,
  Send,
  ShieldAlert,
  Stethoscope,
  Users,
  Wrench,
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
import { AddressAutocompleteInput } from '@/components/shared/AddressAutocompleteInput';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import {
  DetailAssignee,
  resolveDetailAssignee,
} from '@/components/shared/DetailAssignee';
import { PrintButton } from '@/components/shared/PrintButton';
import { updateAssessmentAction } from '@/app/(app)/assessments/actions';
import { AssessmentPublishDrawer } from './drawers/AssessmentPublishDrawer';
import {
  ASSESSMENT_SECTIONS,
  BUILDING_TYPES,
  CLAIM_RECOMMENDATIONS,
  CONSTRUCTION_TYPES,
  DAMAGE_COVERED_OPTIONS,
  DESIGN_TYPES,
  MAKE_SAFE_TYPES,
  OCCUPANCY_TYPES,
  REPAIR_DURATION_UNITS,
  ROOF_TYPES,
  TA_REQUIRED_OPTIONS,
  asBool,
  asStr,
  isAssessmentLocked,
  sectionsFromAssessment,
  type AssessmentSections,
} from './assessment-sections';
import type { Assessment, AssessmentSectionKey, Claim, Job } from '@/types/api';

export interface AssessmentDetailClientProps {
  assessment: Assessment;
  job?: Job | null;
  claim?: Claim | null;
}

const EMPTY_PLACEHOLDER = '__empty__';

const VALID_TABS = [
  'attendance',
  'building',
  'habitability',
  'hazards',
  'damage',
  'makeSafe',
  'temporaryAccommodation',
  'specialists',
  'recommendation',
] as const;

type TabValue = (typeof VALID_TABS)[number];

function normaliseTab(raw: string | null): TabValue {
  if (!raw) return 'attendance';
  return VALID_TABS.find((t) => t === raw) ?? 'attendance';
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-500">{label}</Label>
      <Select
        value={value || EMPTY_PLACEHOLDER}
        onValueChange={(v) => onChange(!v || v === EMPTY_PLACEHOLDER ? '' : v)}
        disabled={disabled}
      >
        <SelectTrigger className="h-9 w-full" disabled={disabled}>
          <SelectValue placeholder="Select..." />
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
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(!!v)}
      />
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
  disabled,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
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
          disabled={disabled}
          className="text-sm"
        />
      ) : (
        <Input
          type={type ?? 'text'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-9 text-sm"
        />
      )}
    </div>
  );
}

function TabPanel({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <fieldset
      disabled={disabled}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm disabled:opacity-80"
    >
      {children}
    </fieldset>
  );
}

const DETAIL_TABS: Array<{ id: TabValue; label: string; icon: typeof Building2 }> = [
  { id: 'attendance', label: 'Attendance', icon: Users },
  { id: 'building', label: 'Building', icon: Building2 },
  { id: 'habitability', label: 'Habitability', icon: Home },
  { id: 'hazards', label: 'Hazards', icon: AlertTriangle },
  { id: 'damage', label: 'Damage & Cause', icon: ShieldAlert },
  { id: 'makeSafe', label: 'Make Safe', icon: Wrench },
  { id: 'temporaryAccommodation', label: 'Temp Accommodation', icon: Home },
  { id: 'specialists', label: 'Specialists', icon: Stethoscope },
  { id: 'recommendation', label: 'Recommendation', icon: ClipboardCheck },
];

export function AssessmentDetailClient({ assessment, job, claim }: AssessmentDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = normaliseTab(searchParams.get('tab'));
  const [sections, setSections] = useState<AssessmentSections>(() =>
    sectionsFromAssessment(assessment),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const locked = isAssessmentLocked(assessment.status);
  const assignee = resolveDetailAssignee({ job });

  const onTabChange = useCallback(
    (value: TabValue) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value === 'attendance') sp.delete('tab');
      else sp.set('tab', value);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setKey = useCallback(
    (section: AssessmentSectionKey, key: string, value: unknown) => {
      if (locked) return;
      setSections((prev) => ({
        ...prev,
        [section]: { ...prev[section], [key]: value },
      }));
      setSaved(false);
    },
    [locked],
  );

  const persistForm = async (): Promise<boolean> => {
    if (locked) return false;
    setSaving(true);
    try {
      const payload: Partial<Assessment> = { name: assessment.name };
      for (const key of ASSESSMENT_SECTIONS) {
        payload[key] = sections[key];
      }
      await updateAssessmentAction(assessment.id, payload);
      setSaved(true);
      router.refresh();
      return true;
    } catch (err) {
      console.error('AssessmentDetailClient.persistForm:', err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPublish = async () => {
    if (locked) return;
    const ok = await persistForm();
    if (ok) setPublishOpen(true);
  };

  const att = sections.attendance;
  const bld = sections.building;
  const hab = sections.habitability;
  const haz = sections.hazards;
  const dmg = sections.damage;
  const ms = sections.makeSafe;
  const ta = sections.temporaryAccommodation;
  const sp = sections.specialists;
  const rec = sections.recommendation;
  const hazardDetails =
    haz.hazardDetails && typeof haz.hazardDetails === 'object'
      ? (haz.hazardDetails as Record<string, unknown>)
      : {};

  const setHazardDetail = (key: string, field: 'flagged' | 'comment', value: unknown) => {
    const current =
      hazardDetails[key] && typeof hazardDetails[key] === 'object'
        ? (hazardDetails[key] as Record<string, unknown>)
        : {};
    setKey('hazards', 'hazardDetails', {
      ...hazardDetails,
      [key]: { ...current, [field]: value },
    });
  };

  const hazardEntry = (key: string) =>
    hazardDetails[key] && typeof hazardDetails[key] === 'object'
      ? (hazardDetails[key] as Record<string, unknown>)
      : {};

  return (
    <div className="flex flex-col">
      <SetHeaderActions>
        {!locked && (
          <Button
            size="default"
            onClick={() => void persistForm()}
            disabled={saving}
            className="h-9 gap-1.5 bg-blue-600 text-white hover:bg-blue-500"
          >
            <Save className="size-4" />
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </Button>
        )}
        {!locked && (
          <Button
            size="default"
            onClick={() => void handleOpenPublish()}
            disabled={saving || !assessment.jobId}
            className="h-9 gap-1.5 bg-amber-600 text-white hover:bg-amber-500"
          >
            <Send className="size-4" />
            Publish
          </Button>
        )}
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

      <div className="flex w-full flex-wrap items-center gap-x-4 border-b border-slate-200">
        <div className="flex min-w-0 flex-1 flex-wrap gap-0">
          {DETAIL_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`-mb-px inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
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
        <DetailAssignee
          assigneeName={assignee.assigneeName}
          assignedToUserId={assignee.assignedToUserId}
          fromJob={assignee.fromJob}
          createdByUserId={assessment.createdByUserId}
          updatedByUserId={assessment.updatedByUserId}
          provider={job?.provider}
        />
      </div>

      <div className="pt-4 pb-12">
        {locked && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            This assessment has been published and can no longer be edited.
          </div>
        )}
        {activeTab === 'attendance' && (
          <TabPanel disabled={locked}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CheckField
                id="address-attended"
                label="Risk address attended"
                checked={asBool(att.addressAttended)}
                onChange={(v) => setKey('attendance', 'addressAttended', v)}
              />
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-500">Other address</Label>
                  <AddressAutocompleteInput
                    id="assessment-other-address"
                    value={asStr(att.otherAddress)}
                    onChange={(v) => setKey('attendance', 'otherAddress', v)}
                    placeholder="Search or enter address…"
                    name="assessment-other-address"
                  />
                </div>
              <TextField
                label="Site attendance date"
                value={asStr(att.siteAttendanceDate).slice(0, 16)}
                onChange={(v) => setKey('attendance', 'siteAttendanceDate', v)}
                type="datetime-local"
              />
              <TextField
                label="Persons attending"
                value={asStr(att.personsAttending)}
                onChange={(v) => setKey('attendance', 'personsAttending', v)}
              />
              <TextField
                label="Builder / estimator name"
                value={asStr(att.builderEstimatorName) || (job?.assigneeName ?? '')}
                onChange={(v) => setKey('attendance', 'builderEstimatorName', v)}
              />
              <TextField
                label="Builder / estimator phone"
                value={asStr(att.builderEstimatorPhone)}
                onChange={(v) => setKey('attendance', 'builderEstimatorPhone', v)}
              />
              <CheckField
                id="insurer-assessor-attended"
                label="Insurance assessor attended"
                checked={asBool(att.insuranceAssessorAttended)}
                onChange={(v) => setKey('attendance', 'insuranceAssessorAttended', v)}
              />
              <TextField
                label="Insurance assessor name"
                value={asStr(att.insuranceAssessorName)}
                onChange={(v) => setKey('attendance', 'insuranceAssessorName', v)}
              />
              <TextField
                label="Insurance assessor phone"
                value={asStr(att.insuranceAssessorPhone)}
                onChange={(v) => setKey('attendance', 'insuranceAssessorPhone', v)}
              />
              <SelectField
                label="Occupancy type"
                value={asStr(att.occupancyType)}
                options={OCCUPANCY_TYPES}
                onChange={(v) => setKey('attendance', 'occupancyType', v)}
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'building' && (
          <TabPanel disabled={locked}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextField
                label="House m²"
                value={asStr(bld.houseM2)}
                onChange={(v) => setKey('building', 'houseM2', v ? Number(v) : '')}
                type="number"
              />
              <TextField
                label="Estimated build year"
                value={asStr(bld.estimatedBuildYear)}
                onChange={(v) => setKey('building', 'estimatedBuildYear', v)}
              />
              <SelectField
                label="Building type"
                value={asStr(bld.buildingType)}
                options={BUILDING_TYPES}
                onChange={(v) => setKey('building', 'buildingType', v)}
              />
              <SelectField
                label="Design type"
                value={asStr(bld.designType)}
                options={DESIGN_TYPES}
                onChange={(v) => setKey('building', 'designType', v)}
              />
              <SelectField
                label="Construction"
                value={asStr(bld.constructionType)}
                options={CONSTRUCTION_TYPES}
                onChange={(v) => setKey('building', 'constructionType', v)}
              />
              <SelectField
                label="Roof type"
                value={asStr(bld.roofType)}
                options={ROOF_TYPES}
                onChange={(v) => setKey('building', 'roofType', v)}
              />
              <TextField
                label="Additional structures"
                value={asStr(bld.additionalStructures)}
                onChange={(v) => setKey('building', 'additionalStructures', v)}
              />
              <TextField
                label="Other structures"
                value={asStr(bld.otherStructures)}
                onChange={(v) => setKey('building', 'otherStructures', v)}
              />
              <CheckField
                id="main-roof-damage"
                label="Main house roof damage"
                checked={asBool(bld.mainHouseRoofDamage)}
                onChange={(v) => setKey('building', 'mainHouseRoofDamage', v)}
              />
              <CheckField
                id="property-condition"
                label="Overall condition acceptable"
                checked={asBool(bld.propertyCondition)}
                onChange={(v) => setKey('building', 'propertyCondition', v)}
              />
              <CheckField
                id="furniture-removal"
                label="Furniture removal / storage"
                checked={asBool(bld.furnitureRemovalStorage)}
                onChange={(v) => setKey('building', 'furnitureRemovalStorage', v)}
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'habitability' && (
          <TabPanel disabled={locked}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CheckField
                id="habitable"
                label="Habitable"
                checked={asBool(hab.habitable)}
                onChange={(v) => setKey('habitability', 'habitable', v)}
              />
              <TextField
                label="Uninhabitable reason"
                value={asStr(hab.uninhabitableReason)}
                onChange={(v) => setKey('habitability', 'uninhabitableReason', v)}
                multiline
              />
              <TextField
                label="Other uninhabitable reason"
                value={asStr(hab.otherUninhabitableReason)}
                onChange={(v) => setKey('habitability', 'otherUninhabitableReason', v)}
                multiline
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'hazards' && (
          <TabPanel disabled={locked}>
            <div className="space-y-4">
              {(
                [
                  ['poolFencing', 'Pool fencing'],
                  ['electrical', 'Electrical / Gas'],
                  ['sewerage', 'Sewerage'],
                  ['structural', 'Structural'],
                ] as const
              ).map(([key, label]) => {
                const entry = hazardEntry(key);
                return (
                  <div key={key} className="space-y-2">
                    <CheckField
                      id={`hazard-${key}`}
                      label={label}
                      checked={asBool(entry.flagged)}
                      onChange={(v) => setHazardDetail(key, 'flagged', v)}
                    />
                    <div className="pl-7">
                      <TextField
                        label={`What is the ${label.toLowerCase()} hazard?`}
                        value={asStr(entry.comment)}
                        onChange={(v) => setHazardDetail(key, 'comment', v)}
                        multiline
                      />
                    </div>
                  </div>
                );
              })}
              <TextField
                label="Safety hazards (summary for NRMA)"
                value={asStr(haz.safetyHazards)}
                onChange={(v) => setKey('hazards', 'safetyHazards', v)}
                multiline
              />
              <TextField
                label="Environmental hazards"
                value={asStr(haz.environmentalHazards)}
                onChange={(v) => setKey('hazards', 'environmentalHazards', v)}
                multiline
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'damage' && (
          <TabPanel disabled={locked}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Damage observed"
                value={asStr(dmg.damageObserved)}
                onChange={(v) => setKey('damage', 'damageObserved', v)}
                multiline
              />
              <TextField
                label="Cause of damage"
                value={asStr(dmg.causeOfDamage)}
                onChange={(v) => setKey('damage', 'causeOfDamage', v)}
                multiline
              />
              <SelectField
                label="Damage caused by listed event"
                value={asStr(dmg.hasDamageCoveredByPolicy)}
                options={DAMAGE_COVERED_OPTIONS}
                onChange={(v) => setKey('damage', 'hasDamageCoveredByPolicy', v)}
              />
              <CheckField
                id="preexisting-maint"
                label="Pre-existing maintenance issues"
                checked={asBool(dmg.preExistingMaintenanceIssues)}
                onChange={(v) => setKey('damage', 'preExistingMaintenanceIssues', v)}
              />
              <TextField
                label="Pre-existing related damage"
                value={asStr(dmg.preExistingRelateDamage)}
                onChange={(v) => setKey('damage', 'preExistingRelateDamage', v)}
                multiline
              />
              <TextField
                label="Maintenance defect issues"
                value={asStr(dmg.maintenanceDefectIssues)}
                onChange={(v) => setKey('damage', 'maintenanceDefectIssues', v)}
                multiline
              />
              <TextField
                label="Works required to address related damage"
                value={asStr(dmg.worksRequiredToAddressDamage)}
                onChange={(v) => setKey('damage', 'worksRequiredToAddressDamage', v)}
                multiline
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'makeSafe' && (
          <TabPanel disabled={locked}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CheckField
                id="ms-required"
                label="Make safe required (site finding)"
                checked={asBool(ms.makeSafeRequired)}
                onChange={(v) => setKey('makeSafe', 'makeSafeRequired', v)}
              />
              <SelectField
                label="Make safe type"
                value={asStr(ms.makeSafeType)}
                options={MAKE_SAFE_TYPES}
                onChange={(v) => setKey('makeSafe', 'makeSafeType', v)}
              />
              <TextField
                label="Make-safe completion date"
                value={asStr(ms.dateMakeSafeCompleted).slice(0, 10)}
                onChange={(v) => setKey('makeSafe', 'dateMakeSafeCompleted', v)}
                type="date"
              />
              <TextField
                label="Date main roof repaired"
                value={asStr(ms.dateMainRoofRepaired).slice(0, 10)}
                onChange={(v) => setKey('makeSafe', 'dateMainRoofRepaired', v)}
                type="date"
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'temporaryAccommodation' && (
          <TabPanel disabled={locked}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                label="Temporary accommodation / loss of rent required"
                value={asStr(ta.required)}
                options={TA_REQUIRED_OPTIONS}
                onChange={(v) => setKey('temporaryAccommodation', 'required', v)}
              />
              <TextField
                label="Estimated amount"
                value={asStr(ta.estimatedAmount)}
                onChange={(v) =>
                  setKey('temporaryAccommodation', 'estimatedAmount', v ? Number(v) : '')
                }
                type="number"
              />
              <TextField
                label="Estimated duration"
                value={asStr(ta.estimatedDuration)}
                onChange={(v) => setKey('temporaryAccommodation', 'estimatedDuration', v)}
                placeholder="e.g. 14 Days"
              />
              <CheckField
                id="ta-immediate"
                label="Required immediately"
                checked={asBool(ta.requiredImmediately)}
                onChange={(v) => setKey('temporaryAccommodation', 'requiredImmediately', v)}
              />
              <TextField
                label="Immediate estimate (days)"
                value={asStr(ta.immediateEstimateDays)}
                onChange={(v) =>
                  setKey(
                    'temporaryAccommodation',
                    'immediateEstimateDays',
                    v ? parseInt(v, 10) : '',
                  )
                }
                type="number"
              />
              <CheckField
                id="ta-repairs"
                label="Required during repairs"
                checked={asBool(ta.requiredDuringRepairs)}
                onChange={(v) => setKey('temporaryAccommodation', 'requiredDuringRepairs', v)}
              />
              <TextField
                label="During-repairs estimate (days)"
                value={asStr(ta.repairsEstimateDays)}
                onChange={(v) =>
                  setKey(
                    'temporaryAccommodation',
                    'repairsEstimateDays',
                    v ? parseInt(v, 10) : '',
                  )
                }
                type="number"
              />
              <TextField
                label="Temporary repairs to make livable"
                value={asStr(ta.tempRepairsToMakeLivable)}
                onChange={(v) => setKey('temporaryAccommodation', 'tempRepairsToMakeLivable', v)}
                multiline
              />
              <TextField
                label="Work while in accommodation"
                value={asStr(ta.workWhileInAccommodation)}
                onChange={(v) => setKey('temporaryAccommodation', 'workWhileInAccommodation', v)}
                multiline
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'specialists' && (
          <TabPanel disabled={locked}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CheckField
                id="specialist-required"
                label="Specialist required"
                checked={asBool(sp.specialistRequired)}
                onChange={(v) => setKey('specialists', 'specialistRequired', v)}
              />
              <TextField
                label="Specialist type"
                value={asStr(sp.specialistType)}
                onChange={(v) => setKey('specialists', 'specialistType', v)}
              />
            </div>
          </TabPanel>
        )}

        {activeTab === 'recommendation' && (
          <TabPanel disabled={locked}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                label="Claim recommendation"
                value={asStr(rec.claimRecommendation)}
                options={CLAIM_RECOMMENDATIONS}
                onChange={(v) => setKey('recommendation', 'claimRecommendation', v)}
              />
              <TextField
                label="Cost estimate for repairs"
                value={asStr(rec.costEstimateForRepairs)}
                onChange={(v) =>
                  setKey('recommendation', 'costEstimateForRepairs', v ? Number(v) : '')
                }
                type="number"
              />
              <TextField
                label="Estimated repair time"
                value={asStr(rec.estimatedRepairTime)}
                onChange={(v) =>
                  setKey('recommendation', 'estimatedRepairTime', v ? Number(v) : '')
                }
                type="number"
              />
              <SelectField
                label="Estimated repair duration unit"
                value={asStr(rec.estimatedRepairDuration)}
                options={REPAIR_DURATION_UNITS}
                onChange={(v) => setKey('recommendation', 'estimatedRepairDuration', v)}
              />
              <CheckField
                id="insured-advised"
                label="Insured has been advised"
                checked={asBool(rec.hasInsuredAdvised)}
                onChange={(v) => setKey('recommendation', 'hasInsuredAdvised', v)}
              />
              <CheckField
                id="client-willing"
                label="Client willing to proceed"
                checked={asBool(rec.clientWillingToProceed)}
                onChange={(v) => setKey('recommendation', 'clientWillingToProceed', v)}
              />
              <CheckField
                id="customer-arranged"
                label="Customer arranged repairs"
                checked={asBool(rec.customerArrangedRepairs)}
                onChange={(v) => setKey('recommendation', 'customerArrangedRepairs', v)}
              />
              <TextField
                label="Arranged repair comments"
                value={asStr(rec.arrangedRepairComments)}
                onChange={(v) => setKey('recommendation', 'arrangedRepairComments', v)}
                multiline
              />
              <TextField
                label="Client discussions"
                value={asStr(rec.clientDiscussions)}
                onChange={(v) => setKey('recommendation', 'clientDiscussions', v)}
                multiline
              />
              <TextField
                label="Special notes"
                value={asStr(rec.specialNotes)}
                onChange={(v) => setKey('recommendation', 'specialNotes', v)}
                multiline
              />
              <TextField
                label="Conclusion"
                value={asStr(rec.conclusion)}
                onChange={(v) => setKey('recommendation', 'conclusion', v)}
                multiline
              />
              <TextField
                label="Builder licences"
                value={asStr(rec.builderLicenses)}
                onChange={(v) => setKey('recommendation', 'builderLicenses', v)}
              />
            </div>
          </TabPanel>
        )}
      </div>

      <AssessmentPublishDrawer
        open={publishOpen}
        onOpenChange={setPublishOpen}
        assessment={{ ...assessment, ...sections }}
        job={job}
        claim={claim}
      />
    </div>
  );
}

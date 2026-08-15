'use client';

import { DAMAGE_COVERED_OPTIONS } from '../assessment-sections';
import { TabPanel, CheckField, TextField, SelectField, asBool, asStr, type TabFormProps } from './shared';

export function DamageTabForm({ data, onChange, locked }: TabFormProps) {
  return (
    <TabPanel disabled={locked}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Damage observed"
          value={asStr(data.damageObserved)}
          onChange={(v) => onChange('damageObserved', v)}
          multiline
        />
        <TextField
          label="Cause of damage"
          value={asStr(data.causeOfDamage)}
          onChange={(v) => onChange('causeOfDamage', v)}
          multiline
        />
        <SelectField
          label="Damage caused by listed event"
          value={asStr(data.hasDamageCoveredByPolicy)}
          options={DAMAGE_COVERED_OPTIONS}
          onChange={(v) => onChange('hasDamageCoveredByPolicy', v)}
        />
        <CheckField
          id="preexisting-maint"
          label="Pre-existing maintenance issues"
          checked={asBool(data.preExistingMaintenanceIssues)}
          onChange={(v) => onChange('preExistingMaintenanceIssues', v)}
        />
        <TextField
          label="Pre-existing related damage"
          value={asStr(data.preExistingRelateDamage)}
          onChange={(v) => onChange('preExistingRelateDamage', v)}
          multiline
        />
        <TextField
          label="Maintenance defect issues"
          value={asStr(data.maintenanceDefectIssues)}
          onChange={(v) => onChange('maintenanceDefectIssues', v)}
          multiline
        />
        <TextField
          label="Works required to address related damage"
          value={asStr(data.worksRequiredToAddressDamage)}
          onChange={(v) => onChange('worksRequiredToAddressDamage', v)}
          multiline
        />
      </div>
    </TabPanel>
  );
}

'use client';

import { MAKE_SAFE_TYPES } from '../assessment-sections';
import { TabPanel, CheckField, TextField, SelectField, asBool, asStr, type TabFormProps } from './shared';

export function MakeSafeTabForm({ data, onChange, locked }: TabFormProps) {
  return (
    <TabPanel disabled={locked}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CheckField
          id="ms-required"
          label="Make safe required (site finding)"
          checked={asBool(data.makeSafeRequired)}
          onChange={(v) => onChange('makeSafeRequired', v)}
        />
        <SelectField
          label="Make safe type"
          value={asStr(data.makeSafeType)}
          options={MAKE_SAFE_TYPES}
          onChange={(v) => onChange('makeSafeType', v)}
        />
        <TextField
          label="Make-safe completion date"
          value={asStr(data.dateMakeSafeCompleted).slice(0, 10)}
          onChange={(v) => onChange('dateMakeSafeCompleted', v)}
          type="date"
        />
        <TextField
          label="Date main roof repaired"
          value={asStr(data.dateMainRoofRepaired).slice(0, 10)}
          onChange={(v) => onChange('dateMainRoofRepaired', v)}
          type="date"
        />
      </div>
    </TabPanel>
  );
}

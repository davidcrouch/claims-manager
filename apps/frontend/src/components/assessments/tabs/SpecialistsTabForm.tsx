'use client';

import { TabPanel, CheckField, TextField, asBool, asStr, type TabFormProps } from './shared';

export function SpecialistsTabForm({ data, onChange, locked }: TabFormProps) {
  return (
    <TabPanel disabled={locked}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CheckField
          id="specialist-required"
          label="Specialist required"
          checked={asBool(data.specialistRequired)}
          onChange={(v) => onChange('specialistRequired', v)}
        />
        <TextField
          label="Specialist type"
          value={asStr(data.specialistType)}
          onChange={(v) => onChange('specialistType', v)}
        />
      </div>
    </TabPanel>
  );
}

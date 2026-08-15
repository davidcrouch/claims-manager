'use client';

import { TabPanel, CheckField, TextField, asBool, asStr, type TabFormProps } from './shared';

export function HabitabilityTabForm({ data, onChange, locked }: TabFormProps) {
  return (
    <TabPanel disabled={locked}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CheckField
          id="habitable"
          label="Habitable"
          checked={asBool(data.habitable)}
          onChange={(v) => onChange('habitable', v)}
        />
        <TextField
          label="Uninhabitable reason"
          value={asStr(data.uninhabitableReason)}
          onChange={(v) => onChange('uninhabitableReason', v)}
          multiline
        />
        <TextField
          label="Other uninhabitable reason"
          value={asStr(data.otherUninhabitableReason)}
          onChange={(v) => onChange('otherUninhabitableReason', v)}
          multiline
        />
      </div>
    </TabPanel>
  );
}

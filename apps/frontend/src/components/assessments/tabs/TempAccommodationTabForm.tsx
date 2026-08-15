'use client';

import { TA_REQUIRED_OPTIONS } from '../assessment-sections';
import { TabPanel, CheckField, TextField, SelectField, asBool, asStr, type TabFormProps } from './shared';

export function TempAccommodationTabForm({ data, onChange, locked }: TabFormProps) {
  return (
    <TabPanel disabled={locked}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Temporary accommodation / loss of rent required"
          value={asStr(data.required)}
          options={TA_REQUIRED_OPTIONS}
          onChange={(v) => onChange('required', v)}
        />
        <TextField
          label="Estimated amount"
          value={asStr(data.estimatedAmount)}
          onChange={(v) => onChange('estimatedAmount', v ? Number(v) : '')}
          type="number"
        />
        <TextField
          label="Estimated duration"
          value={asStr(data.estimatedDuration)}
          onChange={(v) => onChange('estimatedDuration', v)}
          placeholder="e.g. 14 Days"
        />
        <CheckField
          id="ta-immediate"
          label="Required immediately"
          checked={asBool(data.requiredImmediately)}
          onChange={(v) => onChange('requiredImmediately', v)}
        />
        <TextField
          label="Immediate estimate (days)"
          value={asStr(data.immediateEstimateDays)}
          onChange={(v) => onChange('immediateEstimateDays', v ? parseInt(v, 10) : '')}
          type="number"
        />
        <CheckField
          id="ta-repairs"
          label="Required during repairs"
          checked={asBool(data.requiredDuringRepairs)}
          onChange={(v) => onChange('requiredDuringRepairs', v)}
        />
        <TextField
          label="During-repairs estimate (days)"
          value={asStr(data.repairsEstimateDays)}
          onChange={(v) => onChange('repairsEstimateDays', v ? parseInt(v, 10) : '')}
          type="number"
        />
        <TextField
          label="Temporary repairs to make livable"
          value={asStr(data.tempRepairsToMakeLivable)}
          onChange={(v) => onChange('tempRepairsToMakeLivable', v)}
          multiline
        />
        <TextField
          label="Work while in accommodation"
          value={asStr(data.workWhileInAccommodation)}
          onChange={(v) => onChange('workWhileInAccommodation', v)}
          multiline
        />
      </div>
    </TabPanel>
  );
}

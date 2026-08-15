'use client';

import { TabPanel, CheckField, TextField, asBool, asStr, type TabFormProps } from './shared';

const HAZARD_GROUPS: Array<[string, string]> = [
  ['poolFencing', 'Pool fencing'],
  ['electrical', 'Electrical / Gas'],
  ['sewerage', 'Sewerage'],
  ['structural', 'Structural'],
];

function hazardEntry(details: Record<string, unknown>, key: string): Record<string, unknown> {
  const entry = details[key];
  return entry && typeof entry === 'object' && !Array.isArray(entry)
    ? (entry as Record<string, unknown>)
    : {};
}

export function HazardsTabForm({ data, onChange, locked }: TabFormProps) {
  const hazardDetails =
    data.hazardDetails && typeof data.hazardDetails === 'object'
      ? (data.hazardDetails as Record<string, unknown>)
      : {};

  const setHazardDetail = (key: string, field: 'flagged' | 'comment', value: unknown) => {
    const current = hazardEntry(hazardDetails, key);
    onChange('hazardDetails', {
      ...hazardDetails,
      [key]: { ...current, [field]: value },
    });
  };

  return (
    <TabPanel disabled={locked}>
      <div className="space-y-4">
        {HAZARD_GROUPS.map(([key, label]) => {
          const entry = hazardEntry(hazardDetails, key);
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
          value={asStr(data.safetyHazards)}
          onChange={(v) => onChange('safetyHazards', v)}
          multiline
        />
        <TextField
          label="Environmental hazards"
          value={asStr(data.environmentalHazards)}
          onChange={(v) => onChange('environmentalHazards', v)}
          multiline
        />
      </div>
    </TabPanel>
  );
}

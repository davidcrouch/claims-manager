'use client';

import { Label } from '@/components/ui/label';
import { AddressAutocompleteInput } from '@/components/shared/AddressAutocompleteInput';
import { OCCUPANCY_TYPES } from '../assessment-sections';
import { TabPanel, CheckField, TextField, SelectField, asBool, asStr, type TabFormProps } from './shared';

export function AttendanceTabForm({ data, onChange, locked }: TabFormProps) {
  return (
    <TabPanel disabled={locked}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CheckField
          id="address-attended"
          label="Risk address attended"
          checked={asBool(data.addressAttended)}
          onChange={(v) => onChange('addressAttended', v)}
        />
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-500">Other address</Label>
          <AddressAutocompleteInput
            id="assessment-other-address"
            value={asStr(data.otherAddress)}
            onChange={(v) => onChange('otherAddress', v)}
            placeholder="Search or enter address…"
            name="assessment-other-address"
          />
        </div>
        <TextField
          label="Site attendance date"
          value={asStr(data.siteAttendanceDate).slice(0, 16)}
          onChange={(v) => onChange('siteAttendanceDate', v)}
          type="datetime-local"
        />
        <TextField
          label="Persons attending"
          value={asStr(data.personsAttending)}
          onChange={(v) => onChange('personsAttending', v)}
        />
        <TextField
          label="Builder / estimator name"
          value={asStr(data.builderEstimatorName)}
          onChange={(v) => onChange('builderEstimatorName', v)}
        />
        <TextField
          label="Builder / estimator phone"
          value={asStr(data.builderEstimatorPhone)}
          onChange={(v) => onChange('builderEstimatorPhone', v)}
        />
        <CheckField
          id="insurer-assessor-attended"
          label="Insurance assessor attended"
          checked={asBool(data.insuranceAssessorAttended)}
          onChange={(v) => onChange('insuranceAssessorAttended', v)}
        />
        <TextField
          label="Insurance assessor name"
          value={asStr(data.insuranceAssessorName)}
          onChange={(v) => onChange('insuranceAssessorName', v)}
        />
        <TextField
          label="Insurance assessor phone"
          value={asStr(data.insuranceAssessorPhone)}
          onChange={(v) => onChange('insuranceAssessorPhone', v)}
        />
        <SelectField
          label="Occupancy type"
          value={asStr(data.occupancyType)}
          options={OCCUPANCY_TYPES}
          onChange={(v) => onChange('occupancyType', v)}
        />
      </div>
    </TabPanel>
  );
}

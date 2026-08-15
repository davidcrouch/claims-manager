'use client';

import { CLAIM_RECOMMENDATIONS, REPAIR_DURATION_UNITS } from '../assessment-sections';
import { TabPanel, CheckField, TextField, SelectField, asBool, asStr, type TabFormProps } from './shared';

export function RecommendationTabForm({ data, onChange, locked }: TabFormProps) {
  return (
    <TabPanel disabled={locked}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="Claim recommendation"
          value={asStr(data.claimRecommendation)}
          options={CLAIM_RECOMMENDATIONS}
          onChange={(v) => onChange('claimRecommendation', v)}
        />
        <TextField
          label="Cost estimate for repairs"
          value={asStr(data.costEstimateForRepairs)}
          onChange={(v) => onChange('costEstimateForRepairs', v ? Number(v) : '')}
          type="number"
        />
        <TextField
          label="Estimated repair time"
          value={asStr(data.estimatedRepairTime)}
          onChange={(v) => onChange('estimatedRepairTime', v ? Number(v) : '')}
          type="number"
        />
        <SelectField
          label="Estimated repair duration unit"
          value={asStr(data.estimatedRepairDuration)}
          options={REPAIR_DURATION_UNITS}
          onChange={(v) => onChange('estimatedRepairDuration', v)}
        />
        <CheckField
          id="insured-advised"
          label="Insured has been advised"
          checked={asBool(data.hasInsuredAdvised)}
          onChange={(v) => onChange('hasInsuredAdvised', v)}
        />
        <CheckField
          id="client-willing"
          label="Client willing to proceed"
          checked={asBool(data.clientWillingToProceed)}
          onChange={(v) => onChange('clientWillingToProceed', v)}
        />
        <CheckField
          id="customer-arranged"
          label="Customer arranged repairs"
          checked={asBool(data.customerArrangedRepairs)}
          onChange={(v) => onChange('customerArrangedRepairs', v)}
        />
        <TextField
          label="Arranged repair comments"
          value={asStr(data.arrangedRepairComments)}
          onChange={(v) => onChange('arrangedRepairComments', v)}
          multiline
        />
        <TextField
          label="Client discussions"
          value={asStr(data.clientDiscussions)}
          onChange={(v) => onChange('clientDiscussions', v)}
          multiline
        />
        <TextField
          label="Special notes"
          value={asStr(data.specialNotes)}
          onChange={(v) => onChange('specialNotes', v)}
          multiline
        />
        <TextField
          label="Conclusion"
          value={asStr(data.conclusion)}
          onChange={(v) => onChange('conclusion', v)}
          multiline
        />
        <TextField
          label="Builder licences"
          value={asStr(data.builderLicenses)}
          onChange={(v) => onChange('builderLicenses', v)}
        />
      </div>
    </TabPanel>
  );
}

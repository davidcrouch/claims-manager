'use client';

import {
  BUILDING_TYPES,
  CONSTRUCTION_TYPES,
  DESIGN_TYPES,
  ROOF_TYPES,
} from '../assessment-sections';
import { TabPanel, CheckField, TextField, SelectField, asBool, asStr, type TabFormProps } from './shared';

export function BuildingTabForm({ data, onChange, locked }: TabFormProps) {
  return (
    <TabPanel disabled={locked}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label="House m²"
          value={asStr(data.houseM2)}
          onChange={(v) => onChange('houseM2', v ? Number(v) : '')}
          type="number"
        />
        <TextField
          label="Estimated build year"
          value={asStr(data.estimatedBuildYear)}
          onChange={(v) => onChange('estimatedBuildYear', v)}
        />
        <SelectField
          label="Building type"
          value={asStr(data.buildingType)}
          options={BUILDING_TYPES}
          onChange={(v) => onChange('buildingType', v)}
        />
        <SelectField
          label="Design type"
          value={asStr(data.designType)}
          options={DESIGN_TYPES}
          onChange={(v) => onChange('designType', v)}
        />
        <SelectField
          label="Construction"
          value={asStr(data.constructionType)}
          options={CONSTRUCTION_TYPES}
          onChange={(v) => onChange('constructionType', v)}
        />
        <SelectField
          label="Roof type"
          value={asStr(data.roofType)}
          options={ROOF_TYPES}
          onChange={(v) => onChange('roofType', v)}
        />
        <TextField
          label="Additional structures"
          value={asStr(data.additionalStructures)}
          onChange={(v) => onChange('additionalStructures', v)}
        />
        <TextField
          label="Other structures"
          value={asStr(data.otherStructures)}
          onChange={(v) => onChange('otherStructures', v)}
        />
        <CheckField
          id="main-roof-damage"
          label="Main house roof damage"
          checked={asBool(data.mainHouseRoofDamage)}
          onChange={(v) => onChange('mainHouseRoofDamage', v)}
        />
        <CheckField
          id="property-condition"
          label="Overall condition acceptable"
          checked={asBool(data.propertyCondition)}
          onChange={(v) => onChange('propertyCondition', v)}
        />
        <CheckField
          id="furniture-removal"
          label="Furniture removal / storage"
          checked={asBool(data.furnitureRemovalStorage)}
          onChange={(v) => onChange('furnitureRemovalStorage', v)}
        />
      </div>
    </TabPanel>
  );
}

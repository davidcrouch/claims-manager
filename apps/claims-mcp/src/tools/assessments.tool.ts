import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';

type Dict = Record<string, unknown>;

function asDict(value: unknown): Dict {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : {};
}

function compact(section: Dict): Dict | undefined {
  const out: Dict = {};
  for (const [key, value] of Object.entries(section)) {
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function additionalStructuresFromFlags(flags: {
  detachedGarage?: boolean;
  sheds?: boolean;
  swimmingPool?: boolean;
  detachedGrannyFlat?: boolean;
}): string {
  return [
    flags.detachedGarage ? 'Detached Garage' : null,
    flags.sheds ? 'Sheds' : null,
    flags.swimmingPool ? 'Swimming Pool' : null,
    flags.detachedGrannyFlat ? 'Granny Flat' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function flagsFromAdditionalStructures(value: unknown): {
  detachedGarage: boolean;
  sheds: boolean;
  swimmingPool: boolean;
  detachedGrannyFlat: boolean;
} {
  const text = value == null ? '' : String(value);
  return {
    detachedGarage: text.includes('Garage'),
    sheds: text.includes('Shed'),
    swimmingPool: text.includes('Pool'),
    detachedGrannyFlat: text.includes('Granny'),
  };
}

function hazardEntry(details: Dict, key: string): Dict {
  const entry = details[key];
  return asDict(entry);
}

export function registerAssessmentsTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'get_assessment',
    '[Category: Assessments] Get a single assessment by ID, returning all JSONB section fields across every tab.',
    {
      id: z.string().describe('Assessment UUID'),
    },
    async ({ id }) => {
      try {
        const result = await api.request(`/assessments/${id}`);
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'search_assessments',
    '[Category: Assessments] Search assessments with optional job filter and pagination.',
    {
      jobId: z.string().optional().describe('Filter by job UUID'),
      status: z.string().optional().describe('Filter by status'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
    },
    async ({ jobId, status, page }) => {
      try {
        const result = await api.request('/assessments', {
          query: { jobId, status, page: page ?? 1 },
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'open_assessment_building',
    '[Category: Assessments] Open the Building Structure drawer for an assessment. Collects building details: claim recommendation, design type, construction, roof type, building type, make-safe, squares, building age, square metres, and date booked.',
    {
      assessmentId: z.string().describe('Assessment UUID'),
    },
    async ({ assessmentId }) => {
      try {
        const result = await api.request(`/assessments/${assessmentId}`);
        return toolResult({
          action: 'open_drawer',
          drawer: 'AssessmentBuildingDrawer',
          assessmentId,
          data: result,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'open_assessment_general',
    '[Category: Assessments] Open the General Questions drawer for an assessment. Collects general inspection findings: make-safe completion date, roof repair date, habitability, mould, asbestos, garage, sheds, pool, granny flat, and listed-event damage.',
    {
      assessmentId: z.string().describe('Assessment UUID'),
    },
    async ({ assessmentId }) => {
      try {
        const result = await api.request(`/assessments/${assessmentId}`);
        return toolResult({
          action: 'open_drawer',
          drawer: 'AssessmentGeneralDrawer',
          assessmentId,
          data: result,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'open_assessment_hazards',
    '[Category: Assessments] Open the Hazards drawer for an assessment. Collects hazard information: pool fencing, electrical/gas, sewerage, structural, and other hazards.',
    {
      assessmentId: z.string().describe('Assessment UUID'),
    },
    async ({ assessmentId }) => {
      try {
        const result = await api.request(`/assessments/${assessmentId}`);
        return toolResult({
          action: 'open_drawer',
          drawer: 'AssessmentHazardsDrawer',
          assessmentId,
          data: result,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'open_assessment_accommodation',
    '[Category: Assessments] Open the Temporary Accommodation drawer for an assessment. Collects temporary accommodation needs: immediate accommodation, repairs to make livable, accommodation during repairs, and work scope while insured is in accommodation.',
    {
      assessmentId: z.string().describe('Assessment UUID'),
    },
    async ({ assessmentId }) => {
      try {
        const result = await api.request(`/assessments/${assessmentId}`);
        return toolResult({
          action: 'open_drawer',
          drawer: 'AssessmentAccommodationDrawer',
          assessmentId,
          data: result,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'open_assessment_other',
    '[Category: Assessments] Open the Other Details drawer for an assessment. Collects narrative fields: client discussion, resultant damage, cause of damage, maintenance issues, comments, and scope variances.',
    {
      assessmentId: z.string().describe('Assessment UUID'),
    },
    async ({ assessmentId }) => {
      try {
        const result = await api.request(`/assessments/${assessmentId}`);
        return toolResult({
          action: 'open_drawer',
          drawer: 'AssessmentOtherDrawer',
          assessmentId,
          data: result,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'update_assessment_building',
    '[Category: Assessments] Update Building Structure fields on an assessment.',
    {
      assessmentId: z.string().describe('Assessment UUID'),
      claimRecommendation: z.enum(['Approve', 'Decline', 'Refer', 'Pending']).optional(),
      designType: z.enum(['Standard', 'Custom', 'Heritage', 'Multi-storey']).optional(),
      construction: z.enum(['Brick Veneer', 'Double Brick', 'Weatherboard', 'Fibro', 'Concrete', 'Steel Frame', 'Other']).optional(),
      roofType: z.enum(['Tile', 'Metal', 'Slate', 'Flat', 'Colorbond', 'Other']).optional(),
      buildingType: z.enum(['House', 'Unit', 'Townhouse', 'Duplex', 'Commercial', 'Other']).optional(),
      makeSafeType: z.enum(['Tarp', 'Board Up', 'Temporary Fence', 'Other']).optional(),
      squares: z.string().optional().describe('Number of squares'),
      buildingAge: z.number().int().optional().describe('Building age in years'),
      squareMetres: z.string().optional().describe('Area in square metres'),
      dateBooked: z.string().optional().describe('Date booked (ISO format)'),
      makeSafe: z.boolean().optional(),
      overallConditionAcceptable: z.boolean().optional(),
      iagInspectionRequired: z.boolean().optional(),
    },
    async ({ assessmentId, ...fields }) => {
      try {
        const body: Dict = {};
        const building = compact({
          designType: fields.designType,
          constructionType: fields.construction,
          roofType: fields.roofType,
          buildingType: fields.buildingType,
          squares: fields.squares,
          estimatedBuildYear: fields.buildingAge != null ? String(fields.buildingAge) : undefined,
          houseM2: fields.squareMetres != null ? Number(fields.squareMetres) || fields.squareMetres : undefined,
          propertyCondition: fields.overallConditionAcceptable,
        });
        const recommendation = compact({
          claimRecommendation: fields.claimRecommendation,
        });
        const makeSafe = compact({
          makeSafeType: fields.makeSafeType,
          makeSafeRequired: fields.makeSafe,
        });
        const attendance = compact({
          siteAttendanceDate: fields.dateBooked,
          insuranceAssessorAttended: fields.iagInspectionRequired,
        });
        if (building) body.building = building;
        if (recommendation) body.recommendation = recommendation;
        if (makeSafe) body.makeSafe = makeSafe;
        if (attendance) body.attendance = attendance;
        const result = await api.request(`/assessments/${assessmentId}`, {
          method: 'PATCH',
          body,
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'update_assessment_general',
    '[Category: Assessments] Update General Questions fields on an assessment.',
    {
      assessmentId: z.string().describe('Assessment UUID'),
      makeSafeCompletionDate: z.string().optional().describe('Make-safe completion date (ISO)'),
      dateMainRoofRepaired: z.string().optional().describe('Date main roof repaired (ISO)'),
      mainRoofDamage: z.boolean().optional(),
      habitable: z.boolean().optional(),
      mould: z.boolean().optional(),
      asbestosOnSite: z.boolean().optional(),
      detachedGarage: z.boolean().optional(),
      sheds: z.boolean().optional(),
      swimmingPool: z.boolean().optional(),
      detachedGrannyFlat: z.boolean().optional(),
      damageCausedByListedEvent: z.boolean().optional(),
    },
    async ({ assessmentId, ...fields }) => {
      try {
        const existing = asDict(await api.request(`/assessments/${assessmentId}`));
        const bld = asDict(existing.building);
        const flags = flagsFromAdditionalStructures(bld.additionalStructures);
        if (fields.detachedGarage !== undefined) flags.detachedGarage = fields.detachedGarage;
        if (fields.sheds !== undefined) flags.sheds = fields.sheds;
        if (fields.swimmingPool !== undefined) flags.swimmingPool = fields.swimmingPool;
        if (fields.detachedGrannyFlat !== undefined) flags.detachedGrannyFlat = fields.detachedGrannyFlat;

        const body: Dict = {};
        const makeSafe = compact({
          dateMakeSafeCompleted: fields.makeSafeCompletionDate,
          dateMainRoofRepaired: fields.dateMainRoofRepaired,
        });
        const building = compact({
          mainHouseRoofDamage: fields.mainRoofDamage,
          additionalStructures:
            fields.detachedGarage !== undefined ||
            fields.sheds !== undefined ||
            fields.swimmingPool !== undefined ||
            fields.detachedGrannyFlat !== undefined
              ? additionalStructuresFromFlags(flags)
              : undefined,
        });
        const habitability = compact({ habitable: fields.habitable });
        const extras = compact({
          mould: fields.mould,
          asbestosOnSite: fields.asbestosOnSite,
        });
        const damage = compact({
          hasDamageCoveredByPolicy:
            fields.damageCausedByListedEvent === undefined
              ? undefined
              : fields.damageCausedByListedEvent
                ? 'Yes'
                : 'No',
        });
        const hazards = compact({
          environmentalHazards: fields.mould === true ? 'Mould' : fields.mould === false ? undefined : undefined,
          safetyHazards: fields.asbestosOnSite === true ? 'Asbestos' : undefined,
        });
        if (makeSafe) body.makeSafe = makeSafe;
        if (building) body.building = building;
        if (habitability) body.habitability = habitability;
        if (extras) body.extras = extras;
        if (damage) body.damage = damage;
        if (hazards) body.hazards = hazards;
        const result = await api.request(`/assessments/${assessmentId}`, {
          method: 'PATCH',
          body,
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'update_assessment_hazards',
    '[Category: Assessments] Update Hazards fields on an assessment.',
    {
      assessmentId: z.string().describe('Assessment UUID'),
      hazardPoolFencing: z.boolean().optional(),
      hazardPoolFencingComment: z.string().optional().describe('Comment for pool fencing hazard'),
      hazardElectricalGas: z.boolean().optional(),
      hazardElectricalGasComment: z.string().optional().describe('Comment for electrical/gas hazard'),
      hazardSewerage: z.boolean().optional(),
      hazardSewerageComment: z.string().optional().describe('Comment for sewerage hazard'),
      hazardStructural: z.boolean().optional(),
      hazardStructuralComment: z.string().optional().describe('Comment for structural hazard'),
      hazardOther: z.string().optional().describe('Free-text description of other hazards'),
    },
    async ({ assessmentId, ...fields }) => {
      try {
        const existing = asDict(await api.request(`/assessments/${assessmentId}`));
        const haz = asDict(existing.hazards);
        const details = asDict(haz.hazardDetails);
        const pool = hazardEntry(details, 'poolFencing');
        const electrical = hazardEntry(details, 'electrical');
        const sewerage = hazardEntry(details, 'sewerage');
        const structural = hazardEntry(details, 'structural');
        if (fields.hazardPoolFencing !== undefined) pool.flagged = fields.hazardPoolFencing;
        if (fields.hazardPoolFencingComment !== undefined) pool.comment = fields.hazardPoolFencingComment;
        if (fields.hazardElectricalGas !== undefined) electrical.flagged = fields.hazardElectricalGas;
        if (fields.hazardElectricalGasComment !== undefined) electrical.comment = fields.hazardElectricalGasComment;
        if (fields.hazardSewerage !== undefined) sewerage.flagged = fields.hazardSewerage;
        if (fields.hazardSewerageComment !== undefined) sewerage.comment = fields.hazardSewerageComment;
        if (fields.hazardStructural !== undefined) structural.flagged = fields.hazardStructural;
        if (fields.hazardStructuralComment !== undefined) structural.comment = fields.hazardStructuralComment;
        if (fields.hazardOther !== undefined) details.other = fields.hazardOther;
        details.poolFencing = pool;
        details.electrical = electrical;
        details.sewerage = sewerage;
        details.structural = structural;

        const safetyParts = [
          pool.flagged ? `Pool fencing${pool.comment ? `: ${String(pool.comment)}` : ''}` : null,
          electrical.flagged ? `Electrical / Gas${electrical.comment ? `: ${String(electrical.comment)}` : ''}` : null,
          sewerage.flagged ? `Sewerage${sewerage.comment ? `: ${String(sewerage.comment)}` : ''}` : null,
          structural.flagged ? `Structural${structural.comment ? `: ${String(structural.comment)}` : ''}` : null,
          details.other ? String(details.other) : null,
        ].filter(Boolean);

        const result = await api.request(`/assessments/${assessmentId}`, {
          method: 'PATCH',
          body: {
            hazards: {
              hazardDetails: details,
              safetyHazards: safetyParts.join('; ') || undefined,
            },
          },
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'update_assessment_accommodation',
    '[Category: Assessments] Update Temporary Accommodation fields on an assessment.',
    {
      assessmentId: z.string().describe('Assessment UUID'),
      tempAccomRequiredImmediately: z.boolean().optional(),
      tempAccomImmediateEstimateDays: z.number().int().optional().describe('Days of immediate temp accommodation'),
      tempRepairsToMakeLivable: z.string().optional().describe('Description of temp repairs to make home livable'),
      tempAccomRequiredDuringRepairs: z.boolean().optional(),
      tempAccomRepairsEstimateDays: z.number().int().optional().describe('Days of temp accommodation during repairs'),
      workWhileInAccommodation: z.string().optional().describe('Work scope while insured is in accommodation'),
    },
    async ({ assessmentId, ...fields }) => {
      try {
        const existing = asDict(await api.request(`/assessments/${assessmentId}`));
        const ta = asDict(existing.temporaryAccommodation);
        const requiredImmediately = fields.tempAccomRequiredImmediately ?? ta.requiredImmediately === true;
        const requiredDuringRepairs = fields.tempAccomRequiredDuringRepairs ?? ta.requiredDuringRepairs === true;
        const immediateDays = fields.tempAccomImmediateEstimateDays ?? ta.immediateEstimateDays;
        const repairDays = fields.tempAccomRepairsEstimateDays ?? ta.repairsEstimateDays;
        const duration = repairDays ?? immediateDays;
        const result = await api.request(`/assessments/${assessmentId}`, {
          method: 'PATCH',
          body: {
            temporaryAccommodation: compact({
              required:
                requiredImmediately || requiredDuringRepairs
                  ? 'Yes, Temporary Accommodation'
                  : 'No',
              requiredImmediately: fields.tempAccomRequiredImmediately,
              immediateEstimateDays: fields.tempAccomImmediateEstimateDays,
              tempRepairsToMakeLivable: fields.tempRepairsToMakeLivable,
              requiredDuringRepairs: fields.tempAccomRequiredDuringRepairs,
              repairsEstimateDays: fields.tempAccomRepairsEstimateDays,
              workWhileInAccommodation: fields.workWhileInAccommodation,
              estimatedDuration: duration != null ? `${duration} Days` : undefined,
            }),
          },
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'update_assessment_other',
    '[Category: Assessments] Update Other Details fields on an assessment.',
    {
      assessmentId: z.string().describe('Assessment UUID'),
      clientDiscussion: z.string().optional().describe('Notes from client discussion'),
      resultantDamage: z.string().optional().describe('Description of resultant damage'),
      causeOfDamage: z.string().optional().describe('Description of damage cause'),
      maintenanceRelatedIssues: z.string().optional().describe('Maintenance-related issues'),
      comments: z.string().optional().describe('Additional comments'),
      variancesOfScope: z.string().optional().describe('Variances of scope'),
    },
    async ({ assessmentId, ...fields }) => {
      try {
        const body: Dict = {};
        const recommendation = compact({
          clientDiscussions: fields.clientDiscussion,
          specialNotes: fields.comments,
          conclusion: fields.variancesOfScope,
        });
        const damage = compact({
          damageObserved: fields.resultantDamage,
          causeOfDamage: fields.causeOfDamage,
          maintenanceDefectIssues: fields.maintenanceRelatedIssues,
        });
        if (recommendation) body.recommendation = recommendation;
        if (damage) body.damage = damage;
        const result = await api.request(`/assessments/${assessmentId}`, {
          method: 'PATCH',
          body,
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}

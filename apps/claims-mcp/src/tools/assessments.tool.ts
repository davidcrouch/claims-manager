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
    '[Category: operations] Get a single assessment by ID, returning all JSONB section fields across every tab.',
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
    '[Category: operations] Search assessments with optional job filter and pagination.',
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

  // ── Tab-aligned tool triplets (open / fill / update) ──

  // Helper: register an open/fill/update triplet for a single assessment tab section
  function registerTabTools(opts: {
    tab: string;
    sectionKey: string;
    drawerName: string;
    description: string;
    fillSchema: z.ZodRawShape;
  }) {
    const { tab, sectionKey, drawerName, description, fillSchema } = opts;

    server.tool(
      `open_assessment_${tab}`,
      `[Category: operations] Open the ${description} tab form for an assessment.`,
      { assessmentId: z.string().describe('Assessment UUID') },
      async ({ assessmentId }) => {
        try {
          const result = await api.request(`/assessments/${assessmentId}`);
          return toolResult({
            action: 'open_drawer',
            drawer: drawerName,
            assessmentId,
            data: result,
          });
        } catch (err) {
          return toolError(err);
        }
      },
    );

    server.tool(
      `fill_assessment_${tab}`,
      `[Category: operations] Fill fields on the open ${description} tab form. Call after each user answer so the canvas form updates live. Pass only the fields just provided.`,
      { assessmentId: z.string().optional().describe('Assessment UUID'), ...fillSchema },
      async (fields) => {
        return toolResult({
          action: 'fill_drawer',
          drawer: drawerName,
          fields,
        });
      },
    );

    server.tool(
      `update_assessment_${tab}`,
      `[Category: operations] Save ${description} section fields on an assessment via PATCH.`,
      { assessmentId: z.string().describe('Assessment UUID'), ...fillSchema },
      async ({ assessmentId, ...fields }) => {
        try {
          const sectionData = compact(fields);
          const result = await api.request(`/assessments/${assessmentId}`, {
            method: 'PATCH',
            body: { [sectionKey]: sectionData },
          });
          return toolResult(result);
        } catch (err) {
          return toolError(err);
        }
      },
    );
  }

  // 1. Attendance
  registerTabTools({
    tab: 'attendance',
    sectionKey: 'attendance',
    drawerName: 'AssessmentAttendanceDrawer',
    description: 'Attendance',
    fillSchema: {
      addressAttended: z.boolean().optional().describe('Risk address attended'),
      otherAddress: z.string().optional().describe('Other address if not risk address'),
      siteAttendanceDate: z.string().optional().describe('Site attendance date-time (ISO)'),
      personsAttending: z.string().optional().describe('Persons attending'),
      builderEstimatorName: z.string().optional().describe('Builder / estimator name'),
      builderEstimatorPhone: z.string().optional().describe('Builder / estimator phone'),
      insuranceAssessorAttended: z.boolean().optional().describe('Insurance assessor attended'),
      insuranceAssessorName: z.string().optional().describe('Insurance assessor name'),
      insuranceAssessorPhone: z.string().optional().describe('Insurance assessor phone'),
      occupancyType: z.enum(['Vacant', 'Occupied', 'Partially Occupied']).optional(),
    },
  });

  // 2. Building
  registerTabTools({
    tab: 'building',
    sectionKey: 'building',
    drawerName: 'AssessmentBuildingTabDrawer',
    description: 'Building',
    fillSchema: {
      houseM2: z.number().optional().describe('House area in m²'),
      estimatedBuildYear: z.string().optional().describe('Estimated build year'),
      buildingType: z.enum(['House', 'Unit', 'Townhouse', 'Duplex', 'Commercial', 'Other']).optional(),
      designType: z.enum(['Standard', 'Custom', 'Heritage', 'Multi-storey']).optional(),
      constructionType: z.enum(['Brick Veneer', 'Double Brick', 'Weatherboard', 'Fibro', 'Concrete', 'Steel Frame', 'Other']).optional(),
      roofType: z.enum(['Tile', 'Metal', 'Slate', 'Flat', 'Colorbond', 'Other']).optional(),
      additionalStructures: z.string().optional().describe('Additional structures'),
      otherStructures: z.string().optional().describe('Other structures'),
      mainHouseRoofDamage: z.boolean().optional().describe('Main house roof damage'),
      propertyCondition: z.boolean().optional().describe('Overall condition acceptable'),
      furnitureRemovalStorage: z.boolean().optional().describe('Furniture removal / storage'),
    },
  });

  // 3. Habitability
  registerTabTools({
    tab: 'habitability',
    sectionKey: 'habitability',
    drawerName: 'AssessmentHabitabilityDrawer',
    description: 'Habitability',
    fillSchema: {
      habitable: z.boolean().optional().describe('Is the property habitable'),
      uninhabitableReason: z.string().optional().describe('Uninhabitable reason'),
      otherUninhabitableReason: z.string().optional().describe('Other uninhabitable reason'),
    },
  });

  // 4. Hazards (custom update to handle nested hazardDetails)
  server.tool(
    'open_assessment_hazards',
    '[Category: operations] Open the Hazards tab form for an assessment.',
    { assessmentId: z.string().describe('Assessment UUID') },
    async ({ assessmentId }) => {
      try {
        const result = await api.request(`/assessments/${assessmentId}`);
        return toolResult({
          action: 'open_drawer',
          drawer: 'AssessmentHazardsTabDrawer',
          assessmentId,
          data: result,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  const hazardsFillSchema = {
    assessmentId: z.string().optional().describe('Assessment UUID'),
    poolFencingFlagged: z.boolean().optional(),
    poolFencingComment: z.string().optional(),
    electricalFlagged: z.boolean().optional(),
    electricalComment: z.string().optional(),
    sewerageFlagged: z.boolean().optional(),
    sewerageComment: z.string().optional(),
    structuralFlagged: z.boolean().optional(),
    structuralComment: z.string().optional(),
    safetyHazards: z.string().optional().describe('Safety hazards summary'),
    environmentalHazards: z.string().optional().describe('Environmental hazards'),
  };

  server.tool(
    'fill_assessment_hazards',
    '[Category: operations] Fill fields on the open Hazards tab form. Call after each user answer so the canvas form updates live.',
    hazardsFillSchema,
    async (fields) => {
      const hazardDetails: Dict = {};
      if (fields.poolFencingFlagged !== undefined || fields.poolFencingComment !== undefined) {
        hazardDetails.poolFencing = compact({ flagged: fields.poolFencingFlagged, comment: fields.poolFencingComment });
      }
      if (fields.electricalFlagged !== undefined || fields.electricalComment !== undefined) {
        hazardDetails.electrical = compact({ flagged: fields.electricalFlagged, comment: fields.electricalComment });
      }
      if (fields.sewerageFlagged !== undefined || fields.sewerageComment !== undefined) {
        hazardDetails.sewerage = compact({ flagged: fields.sewerageFlagged, comment: fields.sewerageComment });
      }
      if (fields.structuralFlagged !== undefined || fields.structuralComment !== undefined) {
        hazardDetails.structural = compact({ flagged: fields.structuralFlagged, comment: fields.structuralComment });
      }
      const fillFields: Dict = {};
      if (Object.keys(hazardDetails).length) fillFields.hazardDetails = hazardDetails;
      if (fields.safetyHazards !== undefined) fillFields.safetyHazards = fields.safetyHazards;
      if (fields.environmentalHazards !== undefined) fillFields.environmentalHazards = fields.environmentalHazards;
      return toolResult({
        action: 'fill_drawer',
        drawer: 'AssessmentHazardsTabDrawer',
        fields: { assessmentId: fields.assessmentId, ...fillFields },
      });
    },
  );

  server.tool(
    'update_assessment_hazards',
    '[Category: operations] Save Hazards section fields on an assessment via PATCH.',
    {
      assessmentId: z.string().describe('Assessment UUID'),
      poolFencingFlagged: z.boolean().optional(),
      poolFencingComment: z.string().optional(),
      electricalFlagged: z.boolean().optional(),
      electricalComment: z.string().optional(),
      sewerageFlagged: z.boolean().optional(),
      sewerageComment: z.string().optional(),
      structuralFlagged: z.boolean().optional(),
      structuralComment: z.string().optional(),
      safetyHazards: z.string().optional().describe('Safety hazards summary'),
      environmentalHazards: z.string().optional().describe('Environmental hazards'),
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
        if (fields.poolFencingFlagged !== undefined) pool.flagged = fields.poolFencingFlagged;
        if (fields.poolFencingComment !== undefined) pool.comment = fields.poolFencingComment;
        if (fields.electricalFlagged !== undefined) electrical.flagged = fields.electricalFlagged;
        if (fields.electricalComment !== undefined) electrical.comment = fields.electricalComment;
        if (fields.sewerageFlagged !== undefined) sewerage.flagged = fields.sewerageFlagged;
        if (fields.sewerageComment !== undefined) sewerage.comment = fields.sewerageComment;
        if (fields.structuralFlagged !== undefined) structural.flagged = fields.structuralFlagged;
        if (fields.structuralComment !== undefined) structural.comment = fields.structuralComment;
        details.poolFencing = pool;
        details.electrical = electrical;
        details.sewerage = sewerage;
        details.structural = structural;

        const body: Dict = {
          hazards: {
            hazardDetails: details,
            safetyHazards: fields.safetyHazards ?? haz.safetyHazards,
            environmentalHazards: fields.environmentalHazards ?? haz.environmentalHazards,
          },
        };
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

  // 5. Damage & Cause
  registerTabTools({
    tab: 'damage',
    sectionKey: 'damage',
    drawerName: 'AssessmentDamageDrawer',
    description: 'Damage & Cause',
    fillSchema: {
      damageObserved: z.string().optional().describe('Damage observed'),
      causeOfDamage: z.string().optional().describe('Cause of damage'),
      hasDamageCoveredByPolicy: z.enum(['Yes', 'No', 'Partial']).optional().describe('Damage caused by listed event'),
      preExistingMaintenanceIssues: z.boolean().optional().describe('Pre-existing maintenance issues'),
      preExistingRelateDamage: z.string().optional().describe('Pre-existing related damage'),
      maintenanceDefectIssues: z.string().optional().describe('Maintenance defect issues'),
      worksRequiredToAddressDamage: z.string().optional().describe('Works required to address related damage'),
    },
  });

  // 6. Make Safe
  registerTabTools({
    tab: 'makeSafe',
    sectionKey: 'makeSafe',
    drawerName: 'AssessmentMakeSafeDrawer',
    description: 'Make Safe',
    fillSchema: {
      makeSafeRequired: z.boolean().optional().describe('Make safe required'),
      makeSafeType: z.enum(['Tarp', 'Board Up', 'Temporary Fence', 'Other']).optional(),
      dateMakeSafeCompleted: z.string().optional().describe('Make-safe completion date (ISO)'),
      dateMainRoofRepaired: z.string().optional().describe('Date main roof repaired (ISO)'),
    },
  });

  // 7. Temp Accommodation
  registerTabTools({
    tab: 'tempAccommodation',
    sectionKey: 'temporaryAccommodation',
    drawerName: 'AssessmentTempAccommodationDrawer',
    description: 'Temp Accommodation',
    fillSchema: {
      required: z.enum(['No', 'Yes, Temporary Accommodation', 'Yes, Loss of Rent']).optional(),
      estimatedAmount: z.number().optional().describe('Estimated amount'),
      estimatedDuration: z.string().optional().describe('Estimated duration e.g. "14 Days"'),
      requiredImmediately: z.boolean().optional(),
      immediateEstimateDays: z.number().int().optional(),
      requiredDuringRepairs: z.boolean().optional(),
      repairsEstimateDays: z.number().int().optional(),
      tempRepairsToMakeLivable: z.string().optional().describe('Temporary repairs to make livable'),
      workWhileInAccommodation: z.string().optional().describe('Work while in accommodation'),
    },
  });

  // 8. Specialists
  registerTabTools({
    tab: 'specialists',
    sectionKey: 'specialists',
    drawerName: 'AssessmentSpecialistsDrawer',
    description: 'Specialists',
    fillSchema: {
      specialistRequired: z.boolean().optional().describe('Specialist required'),
      specialistType: z.string().optional().describe('Specialist type'),
    },
  });

  // 9. Recommendation
  registerTabTools({
    tab: 'recommendation',
    sectionKey: 'recommendation',
    drawerName: 'AssessmentRecommendationDrawer',
    description: 'Recommendation',
    fillSchema: {
      claimRecommendation: z.enum(['Approve', 'Decline', 'Refer', 'Pending']).optional(),
      costEstimateForRepairs: z.number().optional().describe('Cost estimate for repairs'),
      estimatedRepairTime: z.number().optional().describe('Estimated repair time'),
      estimatedRepairDuration: z.enum(['Days', 'Weeks', 'Months']).optional(),
      hasInsuredAdvised: z.boolean().optional().describe('Insured has been advised'),
      clientWillingToProceed: z.boolean().optional().describe('Client willing to proceed'),
      customerArrangedRepairs: z.boolean().optional().describe('Customer arranged repairs'),
      arrangedRepairComments: z.string().optional().describe('Arranged repair comments'),
      clientDiscussions: z.string().optional().describe('Client discussions'),
      specialNotes: z.string().optional().describe('Special notes'),
      conclusion: z.string().optional().describe('Conclusion'),
      builderLicenses: z.string().optional().describe('Builder licences'),
    },
  });

  server.tool(
    'open_create_assessment',
    '[Category: operations] Open the Create Assessment form drawer in canvas. Use this when the user wants to create a new assessment — it presents a guided creation form with job context pre-filled.',
    {
      jobId: z.string().optional().describe('Job UUID to pre-fill on the form'),
    },
    async ({ jobId }) => {
      try {
        let jobData: unknown = undefined;
        if (jobId) {
          jobData = await api.request(`/jobs/${jobId}`).catch(() => undefined);
        }
        return toolResult({
          action: 'open_drawer',
          drawer: 'AssessmentCreateDrawer',
          jobId,
          data: { jobId, job: jobData },
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'fill_create_assessment',
    '[Category: operations] Fill fields on the open Create Assessment form. Call after each user answer so the canvas form updates live. Pass only fields the user just provided.',
    {
      jobId: z.string().optional().describe('Job UUID'),
      name: z.string().optional().describe('Assessment name'),
      claimRecommendation: z
        .enum(['Approve', 'Decline', 'Refer', 'Pending'])
        .optional(),
      designType: z
        .enum(['Standard', 'Custom', 'Heritage', 'Multi-storey'])
        .optional(),
      construction: z
        .enum([
          'Brick Veneer',
          'Double Brick',
          'Weatherboard',
          'Fibro',
          'Concrete',
          'Steel Frame',
          'Other',
        ])
        .optional(),
      roofType: z
        .enum(['Tile', 'Metal', 'Slate', 'Flat', 'Colorbond', 'Other'])
        .optional(),
      buildingType: z
        .enum(['House', 'Unit', 'Townhouse', 'Duplex', 'Commercial', 'Other'])
        .optional(),
      makeSafe: z.boolean().optional().describe('Make safe required'),
      makeSafeType: z
        .enum(['Tarp', 'Board Up', 'Temporary Fence', 'Other'])
        .optional(),
      comments: z.string().optional().describe('Initial comments / special notes'),
    },
    async (fields) => {
      return toolResult({
        action: 'fill_drawer',
        drawer: 'AssessmentCreateDrawer',
        fields,
      });
    },
  );

  server.tool(
    'create_assessment',
    '[Category: operations] Create a new assessment. Pass API create DTO fields as data.',
    {
      data: z.record(z.unknown()).describe('CreateAssessmentDto payload'),
    },
    async ({ data }) => {
      try {
        return toolResult(await api.request('/assessments', { method: 'POST', body: data }));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'update_assessment',
    '[Category: operations] Patch an assessment with arbitrary UpdateAssessmentDto fields.',
    {
      id: z.string().describe('Assessment UUID'),
      data: z.record(z.unknown()).describe('UpdateAssessmentDto payload'),
    },
    async ({ id, data }) => {
      try {
        return toolResult(
          await api.request(`/assessments/${id}`, { method: 'PATCH', body: data }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'validate_assessment',
    '[Category: operations] Validate an assessment for completeness before printing.',
    {
      id: z.string().describe('Assessment UUID'),
    },
    async ({ id }) => {
      try {
        return toolResult(
          await api.request(`/assessments/${id}/validate`, { method: 'POST' }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'open_print_assessment',
    '[Category: operations] Open the Print report drawer for an assessment. This generates the assessment detail PDF via the report generator. Do not publish assessments to NRMA.',
    {
      id: z.string().describe('Assessment UUID'),
      jobId: z.string().optional().describe('Job UUID for the job-folder save destination'),
    },
    async ({ id, jobId }) => {
      try {
        let resolvedJobId = jobId;
        if (!resolvedJobId) {
          const assessment = (await api.request(`/assessments/${id}`).catch(() => null)) as
            | { jobId?: string }
            | null;
          if (assessment?.jobId) resolvedJobId = assessment.jobId;
        }
        return toolResult({
          action: 'open_drawer',
          drawer: 'AssessmentPrintDrawer',
          documentType: 'assessment',
          id,
          entityId: id,
          jobId: resolvedJobId,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'publish_assessment',
    '[Category: operations] Not supported. Crunchwork does not accept Field Assessment reports. Ask the user to print instead (open_print_assessment).',
    {
      id: z.string().describe('Assessment UUID'),
    },
    async () => {
      return toolError(
        new Error(
          'Publishing assessments to NRMA is not supported. Ask the user to print the assessment instead.',
        ),
      );
    },
  );

  server.tool(
    'delete_assessment',
    '[Category: operations] Soft-delete an assessment. Destructive.',
    {
      id: z.string().describe('Assessment UUID'),
    },
    async ({ id }) => {
      try {
        return toolResult(
          await api.request(`/assessments/${id}`, { method: 'DELETE' }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}

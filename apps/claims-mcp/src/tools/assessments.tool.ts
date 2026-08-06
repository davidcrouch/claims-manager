import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';

export function registerAssessmentsTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'get_assessment',
    '[Category: Assessments] Get a single assessment by ID, returning all fields across every tab.',
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
        const result = await api.request(`/assessments/${assessmentId}`, {
          method: 'PATCH',
          body: fields,
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
        const result = await api.request(`/assessments/${assessmentId}`, {
          method: 'PATCH',
          body: fields,
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
        const result = await api.request(`/assessments/${assessmentId}`, {
          method: 'PATCH',
          body: fields,
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
        const result = await api.request(`/assessments/${assessmentId}`, {
          method: 'PATCH',
          body: fields,
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
        const result = await api.request(`/assessments/${assessmentId}`, {
          method: 'PATCH',
          body: fields,
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}

/**
 * Seed assessment tab skills for a tenant.
 * Each skill teaches the AI agent how to gather information for a specific
 * assessment tab and when to open the corresponding drawer.
 * Idempotent — upserts by name.
 */
import { and, eq } from 'drizzle-orm';
import type { SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';

const LOG = '[seeds/assessment-skills]';

interface SkillDef {
  name: string;
  description: string;
  category: string;
  triggerHints: string[];
  instructionPrompt: string;
  requiredToolRefs: Array<{ integration: string; tool: string }>;
}

const JOURNAL_TOOL_REFS: Array<{ integration: string; tool: string }> = [
  { integration: 'Claims Operations', tool: 'get_job' },
  { integration: 'Claims Operations', tool: 'list_journals' },
  { integration: 'Claims Operations', tool: 'get_journal' },
  { integration: 'Claims Operations', tool: 'list_journal_pages' },
  { integration: 'Claims Operations', tool: 'get_journal_page' },
  { integration: 'Claims Operations', tool: 'get_journal_page_attachment_download' },
];

const JOURNAL_REVIEW_BLOCK = `Journal review (do this before answering form questions):
  a. Call list_journals with jobId (or list_journals_by_entity with entityType=job).
  b. Show the user a short list of journals (name/title, date, page count).
  c. Ask which journal(s) apply — wait for their selection. If only one, confirm first.
  d. For each selected journal: call list_journal_pages, then get_journal_page for each entry.
     Read body/notes and content blocks.
  e. For photo attachments: call get_journal_page_attachment_download. Use filenames, captions,
     and metadata. If you cannot visually inspect the image, ask the user what it shows.`;

const ASSESSMENT_SKILLS: SkillDef[] = [
  {
    name: 'Assessment – Attendance',
    description: 'Collect attendance details by reviewing job journals (entries, notes, photos), then filling the form.',
    category: 'assessments',
    triggerHints: ['attendance assessment', 'site attendance', 'who attended', 'occupancy type'],
    instructionPrompt: `You are helping the user complete the Attendance tab of a site assessment.

Workflow:
1. Confirm assessmentId. Call open_assessment_attendance and get_assessment. Resolve jobId. Call get_job.
2. ${JOURNAL_REVIEW_BLOCK}
3. Using job data + journal entries/notes/photos, infer Attendance answers. Call
   fill_assessment_attendance with all inferred fields.
4. Present a short review of what you filled and the evidence source. Ask only for unknowns.
   After each user answer, call fill_assessment_attendance.
5. Field checklist: Risk address attended, Other address, Site attendance date, Persons attending,
   Builder/estimator name+phone, Insurance assessor attended+name+phone, Occupancy type.
6. Ask user to review canvas form. Save with update_assessment_attendance on confirmation.
Rules: Never invent people, phones, or dates. Prefer journal evidence; if unsure, ask.`,
    requiredToolRefs: [
      { integration: 'Claims Operations', tool: 'open_assessment_attendance' },
      { integration: 'Claims Operations', tool: 'fill_assessment_attendance' },
      { integration: 'Claims Operations', tool: 'update_assessment_attendance' },
      { integration: 'Claims Operations', tool: 'get_assessment' },
      ...JOURNAL_TOOL_REFS,
    ],
  },
  {
    name: 'Assessment – Building',
    description: 'Collect building details by reviewing job journals (entries, notes, photos), then filling the form.',
    category: 'assessments',
    triggerHints: ['building assessment', 'construction type', 'roof type assessment', 'design type'],
    instructionPrompt: `You are helping the user complete the Building tab of a site assessment.

Workflow:
1. Confirm assessmentId. Call open_assessment_building and get_assessment. Resolve jobId. Call get_job.
2. ${JOURNAL_REVIEW_BLOCK}
3. Using job data + journal entries/notes/photos, infer Building answers. Call
   fill_assessment_building with all inferred fields.
4. Present a short review. Ask only for unknowns. After each user answer, call fill_assessment_building.
5. Field checklist: House m², Estimated build year, Building type, Design type, Construction,
   Roof type, Additional structures, Other structures, Main house roof damage, Overall condition,
   Furniture removal/storage.
6. Ask user to review canvas form. Save with update_assessment_building on confirmation.
Rules: Never invent measurements or construction details. Prefer journal evidence; if unsure, ask.`,
    requiredToolRefs: [
      { integration: 'Claims Operations', tool: 'open_assessment_building' },
      { integration: 'Claims Operations', tool: 'fill_assessment_building' },
      { integration: 'Claims Operations', tool: 'update_assessment_building' },
      { integration: 'Claims Operations', tool: 'get_assessment' },
      ...JOURNAL_TOOL_REFS,
    ],
  },
  {
    name: 'Assessment – Habitability',
    description: 'Collect habitability details by reviewing job journals (entries, notes, photos), then filling the form.',
    category: 'assessments',
    triggerHints: ['habitability assessment', 'habitable', 'uninhabitable'],
    instructionPrompt: `You are helping the user complete the Habitability tab of a site assessment.

Workflow:
1. Confirm assessmentId. Call open_assessment_habitability and get_assessment. Resolve jobId. Call get_job.
2. ${JOURNAL_REVIEW_BLOCK}
3. Using job data + journal entries/notes/photos, infer Habitability answers. Call
   fill_assessment_habitability with all inferred fields.
4. Present a short review. Ask only for unknowns. After each answer, call fill_assessment_habitability.
5. Field checklist: Habitable (yes/no), Uninhabitable reason, Other uninhabitable reason.
6. Ask user to review canvas form. Save with update_assessment_habitability on confirmation.
Rules: Prefer journal evidence. If unsure whether habitable, ask.`,
    requiredToolRefs: [
      { integration: 'Claims Operations', tool: 'open_assessment_habitability' },
      { integration: 'Claims Operations', tool: 'fill_assessment_habitability' },
      { integration: 'Claims Operations', tool: 'update_assessment_habitability' },
      { integration: 'Claims Operations', tool: 'get_assessment' },
      ...JOURNAL_TOOL_REFS,
    ],
  },
  {
    name: 'Assessment – Hazards',
    description: 'Collect hazards by reviewing job journals (entries, notes, photos), then filling the form.',
    category: 'assessments',
    triggerHints: ['hazard assessment', 'site hazards', 'pool fencing', 'electrical hazard', 'structural hazard'],
    instructionPrompt: `You are helping the user complete the Hazards tab of a site assessment.

Workflow:
1. Confirm assessmentId. Call open_assessment_hazards and get_assessment. Resolve jobId. Call get_job.
2. ${JOURNAL_REVIEW_BLOCK}
3. Using job data + journal entries/notes/photos, infer Hazards answers. Call
   fill_assessment_hazards with all inferred fields.
4. Present a short review. Ask only for unknowns. After each answer, call fill_assessment_hazards.
5. Field checklist: Pool fencing (flagged+comment), Electrical/Gas (flagged+comment),
   Sewerage (flagged+comment), Structural (flagged+comment), Safety hazards summary,
   Environmental hazards.
6. Ask user to review canvas form. Save with update_assessment_hazards on confirmation.
Rules: Do not invent hazards. If journals are silent on a category, ask.`,
    requiredToolRefs: [
      { integration: 'Claims Operations', tool: 'open_assessment_hazards' },
      { integration: 'Claims Operations', tool: 'fill_assessment_hazards' },
      { integration: 'Claims Operations', tool: 'update_assessment_hazards' },
      { integration: 'Claims Operations', tool: 'get_assessment' },
      ...JOURNAL_TOOL_REFS,
    ],
  },
  {
    name: 'Assessment – Damage & Cause',
    description: 'Collect damage and cause details by reviewing job journals (entries, notes, photos), then filling the form.',
    category: 'assessments',
    triggerHints: ['damage assessment', 'cause of damage', 'damage observed', 'maintenance issues'],
    instructionPrompt: `You are helping the user complete the Damage & Cause tab of a site assessment.

Workflow:
1. Confirm assessmentId. Call open_assessment_damage and get_assessment. Resolve jobId. Call get_job.
2. ${JOURNAL_REVIEW_BLOCK}
3. Using job data + journal entries/notes/photos, infer Damage answers. Call
   fill_assessment_damage with all inferred fields.
4. Present a short review. Ask only for unknowns. After each answer, call fill_assessment_damage.
5. Field checklist: Damage observed, Cause of damage, Damage caused by listed event (Yes/No/Partial),
   Pre-existing maintenance issues, Pre-existing related damage, Maintenance defect issues,
   Works required to address related damage.
6. Ask user to review canvas form. Save with update_assessment_damage on confirmation.
Rules: Distinguish event damage from pre-existing issues. If unclear, ask.`,
    requiredToolRefs: [
      { integration: 'Claims Operations', tool: 'open_assessment_damage' },
      { integration: 'Claims Operations', tool: 'fill_assessment_damage' },
      { integration: 'Claims Operations', tool: 'update_assessment_damage' },
      { integration: 'Claims Operations', tool: 'get_assessment' },
      ...JOURNAL_TOOL_REFS,
    ],
  },
  {
    name: 'Assessment – Make Safe',
    description: 'Collect make-safe details by reviewing job journals (entries, notes, photos), then filling the form.',
    category: 'assessments',
    triggerHints: ['make safe assessment', 'tarp board up', 'roof repair date'],
    instructionPrompt: `You are helping the user complete the Make Safe tab of a site assessment.

Workflow:
1. Confirm assessmentId. Call open_assessment_makeSafe and get_assessment. Resolve jobId. Call get_job.
2. ${JOURNAL_REVIEW_BLOCK}
3. Using job data + journal entries/notes/photos, infer Make Safe answers. Call
   fill_assessment_makeSafe with all inferred fields.
4. Present a short review. Ask only for unknowns. After each answer, call fill_assessment_makeSafe.
5. Field checklist: Make safe required (yes/no), Make safe type, Make-safe completion date,
   Date main roof repaired.
6. Ask user to review canvas form. Save with update_assessment_makeSafe on confirmation.
Rules: Do not invent dates. Prefer journal evidence; if unsure, ask.`,
    requiredToolRefs: [
      { integration: 'Claims Operations', tool: 'open_assessment_makeSafe' },
      { integration: 'Claims Operations', tool: 'fill_assessment_makeSafe' },
      { integration: 'Claims Operations', tool: 'update_assessment_makeSafe' },
      { integration: 'Claims Operations', tool: 'get_assessment' },
      ...JOURNAL_TOOL_REFS,
    ],
  },
  {
    name: 'Assessment – Temp Accommodation',
    description: 'Collect temporary accommodation details by reviewing job journals (entries, notes, photos), then filling the form.',
    category: 'assessments',
    triggerHints: ['temporary accommodation', 'temp accom', 'loss of rent', 'accommodation during repairs'],
    instructionPrompt: `You are helping the user complete the Temp Accommodation tab of a site assessment.

Workflow:
1. Confirm assessmentId. Call open_assessment_tempAccommodation and get_assessment. Resolve jobId. Call get_job.
2. ${JOURNAL_REVIEW_BLOCK}
3. Using job data + journal entries/notes/photos, infer TA answers. Call
   fill_assessment_tempAccommodation with all inferred fields.
4. Present a short review. Ask only for unknowns. After each answer, call fill_assessment_tempAccommodation.
5. Field checklist: TA/loss of rent required, Estimated amount, Estimated duration,
   Required immediately + estimate days, Required during repairs + estimate days,
   Temporary repairs to make livable, Work while in accommodation.
6. Ask user to review canvas form. Save with update_assessment_tempAccommodation on confirmation.
Rules: Do not invent dollar amounts or day counts. Prefer journal evidence; if unsure, ask.`,
    requiredToolRefs: [
      { integration: 'Claims Operations', tool: 'open_assessment_tempAccommodation' },
      { integration: 'Claims Operations', tool: 'fill_assessment_tempAccommodation' },
      { integration: 'Claims Operations', tool: 'update_assessment_tempAccommodation' },
      { integration: 'Claims Operations', tool: 'get_assessment' },
      ...JOURNAL_TOOL_REFS,
    ],
  },
  {
    name: 'Assessment – Specialists',
    description: 'Collect specialist requirements by reviewing job journals (entries, notes, photos), then filling the form.',
    category: 'assessments',
    triggerHints: ['specialist assessment', 'specialist required', 'specialist type'],
    instructionPrompt: `You are helping the user complete the Specialists tab of a site assessment.

Workflow:
1. Confirm assessmentId. Call open_assessment_specialists and get_assessment. Resolve jobId. Call get_job.
2. ${JOURNAL_REVIEW_BLOCK}
3. Using job data + journal entries/notes/photos, infer Specialist answers. Call
   fill_assessment_specialists with all inferred fields.
4. Present a short review. Ask only for unknowns. After each answer, call fill_assessment_specialists.
5. Field checklist: Specialist required (yes/no), Specialist type.
6. Ask user to review canvas form. Save with update_assessment_specialists on confirmation.
Rules: If journals only hint at a specialist, confirm with user. Do not assume.`,
    requiredToolRefs: [
      { integration: 'Claims Operations', tool: 'open_assessment_specialists' },
      { integration: 'Claims Operations', tool: 'fill_assessment_specialists' },
      { integration: 'Claims Operations', tool: 'update_assessment_specialists' },
      { integration: 'Claims Operations', tool: 'get_assessment' },
      ...JOURNAL_TOOL_REFS,
    ],
  },
  {
    name: 'Assessment – Recommendation',
    description: 'Collect recommendation details by reviewing job journals (entries, notes, photos), then filling the form.',
    category: 'assessments',
    triggerHints: ['recommendation assessment', 'claim recommendation', 'cost estimate repairs', 'builder licences'],
    instructionPrompt: `You are helping the user complete the Recommendation tab of a site assessment.

Workflow:
1. Confirm assessmentId. Call open_assessment_recommendation and get_assessment. Resolve jobId. Call get_job.
2. ${JOURNAL_REVIEW_BLOCK}
3. Using job data + journal entries/notes/photos + earlier tabs, infer Recommendation answers. Call
   fill_assessment_recommendation with all inferred fields.
4. Present a short review. Ask only for unknowns. After each answer, call fill_assessment_recommendation.
5. Field checklist: Claim recommendation (Approve/Decline/Refer/Pending), Cost estimate,
   Estimated repair time + duration unit, Insured has been advised, Client willing to proceed,
   Customer arranged repairs + comments, Client discussions, Special notes, Conclusion,
   Builder licences.
6. Ask user to review canvas form. Save with update_assessment_recommendation on confirmation.
Rules: Do not invent cost estimates or recommendations. Prefer evidence; if unsure, ask.`,
    requiredToolRefs: [
      { integration: 'Claims Operations', tool: 'open_assessment_recommendation' },
      { integration: 'Claims Operations', tool: 'fill_assessment_recommendation' },
      { integration: 'Claims Operations', tool: 'update_assessment_recommendation' },
      { integration: 'Claims Operations', tool: 'get_assessment' },
      ...JOURNAL_TOOL_REFS,
    ],
  },
];

export async function seedAssessmentSkillsForTenant(params: {
  db: SeedDb;
  tenantId: string;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const logger = params.logger ?? {
    info: (m: string) => console.log(m),
    warn: (m: string) => console.warn(m),
    error: (m: string) => console.error(m),
  };
  const { db, tenantId } = params;

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  logger.info(`${LOG} seeding assessment skills for tenant=${tenantId}`);

  for (const def of ASSESSMENT_SKILLS) {
    const [existing] = await db
      .select()
      .from(schema.skill)
      .where(
        and(
          eq(schema.skill.tenantId, tenantId),
          eq(schema.skill.name, def.name),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(schema.skill)
        .set({
          description: def.description,
          triggerHints: def.triggerHints,
          instructionPrompt: def.instructionPrompt,
          requiredToolRefs: def.requiredToolRefs,
          category: def.category,
          updatedAt: new Date(),
        })
        .where(eq(schema.skill.id, existing.id));
      updated++;
      logger.info(`${LOG} updated skill "${def.name}"`);
    } else {
      await db.insert(schema.skill).values({
        tenantId,
        name: def.name,
        description: def.description,
        triggerHints: def.triggerHints,
        instructionPrompt: def.instructionPrompt,
        requiredToolRefs: def.requiredToolRefs,
        inputSchema: null,
        outputSchema: null,
        invocationMode: 'inline',
        includeHistory: true,
        historyMessageCount: 10,
        category: def.category,
        visibility: 'org',
      });
      inserted++;
      logger.info(`${LOG} inserted skill "${def.name}"`);
    }
  }

  logger.info(`${LOG} done: inserted=${inserted} updated=${updated} skipped=${skipped}`);
  return { inserted, updated, skipped };
}

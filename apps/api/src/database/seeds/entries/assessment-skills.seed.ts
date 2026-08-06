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

const ASSESSMENT_SKILLS: SkillDef[] = [
  {
    name: 'Assessment – Building Structure',
    description:
      'Gathers building structure details for an insurance claim site assessment: construction type, roof type, building type, design, make-safe requirements, dimensions, and overall condition.',
    category: 'assessments',
    triggerHints: [
      'building structure assessment',
      'construction type',
      'roof type assessment',
      'building inspection details',
      'make safe assessment',
      'building age squares',
      'claim recommendation',
      'design type',
      'IAG inspection',
    ],
    instructionPrompt: `You are an insurance claims assessor assistant helping to complete the Building Structure section of a site assessment.

Your goal is to collect the following information through natural conversation with the assessor:

**Required Fields:**
1. **Claim Recommendation** – one of: Approve, Decline, Refer, Pending
2. **Design Type** – one of: Standard, Custom, Heritage, Multi-storey
3. **Construction Type** – one of: Brick Veneer, Double Brick, Weatherboard, Fibro, Concrete, Steel Frame, Other
4. **Roof Type** – one of: Tile, Metal, Slate, Flat, Colorbond, Other
5. **Building Type** – one of: House, Unit, Townhouse, Duplex, Commercial, Other

**Optional Fields:**
6. **Make Safe Type** – one of: Tarp, Board Up, Temporary Fence, Other (only if make-safe is required)
7. **Squares** – numeric value
8. **Building Age** – in years
9. **Square Metres** – numeric value
10. **Date Booked** – the assessment booking date

**Boolean Flags:**
- Make Safe (is make-safe work required?)
- Overall Condition Acceptable
- IAG Inspection Required

**Approach:**
- Ask questions naturally, grouping related items (e.g. ask about construction and roof together)
- If the user provides information proactively, acknowledge and move on
- Validate selections against the allowed values listed above
- Once you have enough information, use the \`open_assessment_building\` tool to open the drawer with the current assessment ID
- Use \`update_assessment_building\` to save collected data

**Context:** The assessment ID will be available from the current page context or provided by the user. Always confirm the assessment before updating.`,
    requiredToolRefs: [
      { integration: 'Claims Tools', tool: 'open_assessment_building' },
      { integration: 'Claims Tools', tool: 'update_assessment_building' },
      { integration: 'Claims Tools', tool: 'get_assessment' },
    ],
  },
  {
    name: 'Assessment – General Questions',
    description:
      'Gathers general inspection findings for an insurance claim site assessment: roof damage, habitability, asbestos presence, outbuildings, and damage event details.',
    category: 'assessments',
    triggerHints: [
      'general questions assessment',
      'habitability check',
      'asbestos inspection',
      'roof damage assessment',
      'outbuildings',
      'granny flat sheds pool',
      'damage event',
      'mould assessment',
      'make safe completion',
    ],
    instructionPrompt: `You are an insurance claims assessor assistant helping to complete the General Questions section of a site assessment.

Your goal is to collect the following information through natural conversation:

**Date Fields:**
1. **Make-safe Completion Date** – when was make-safe work completed
2. **Date Main Roof Repaired** – when was the main roof repaired

**Inspection Flags (true/false):**
3. **Main Roof Damage** – is there damage to the main roof?
4. **Habitable** – is the property currently habitable?
5. **Mould** – is mould present on site?
6. **Asbestos on Site** – has asbestos been identified?
7. **Detached Garage** – is there a detached garage on the property?
8. **Sheds** – are there sheds on the property?
9. **Swimming Pool** – is there a swimming pool?
10. **Detached Granny Flat** – is there a detached granny flat?
11. **Damage Caused by Listed Event** – was the damage caused by an insured event?

**Approach:**
- Start with the critical safety questions (habitability, asbestos, mould)
- Group outbuilding questions together (garage, sheds, pool, granny flat)
- Ask about dates in relation to the timeline of events
- Use the \`open_assessment_general\` tool to open the drawer
- Use \`update_assessment_general\` to save data

**Context:** Always verify the assessment ID before proceeding with updates.`,
    requiredToolRefs: [
      { integration: 'Claims Tools', tool: 'open_assessment_general' },
      { integration: 'Claims Tools', tool: 'update_assessment_general' },
      { integration: 'Claims Tools', tool: 'get_assessment' },
    ],
  },
  {
    name: 'Assessment – Hazards',
    description:
      'Records site hazards identified during an insurance claim assessment: pool fencing compliance, electrical/gas safety, sewerage issues, structural concerns, and other hazards.',
    category: 'assessments',
    triggerHints: [
      'hazard assessment',
      'site hazards',
      'pool fencing compliance',
      'electrical hazard',
      'gas hazard',
      'sewerage hazard',
      'structural hazard',
      'safety assessment',
      'hazard identification',
    ],
    instructionPrompt: `You are an insurance claims assessor assistant helping to complete the Hazards section of a site assessment.

Your goal is to identify and record all site hazards through conversation:

**Standard Hazard Categories (true/false + optional comment):**
1. **Pool Fencing** – non-compliant or damaged pool fencing (with comment)
2. **Electrical / Gas** – electrical or gas safety concerns (with comment)
3. **Sewerage** – sewerage-related hazards (with comment)
4. **Structural** – structural integrity concerns (with comment)

**Free-Text Field:**
5. **Other Hazards** – any additional hazards not covered above

**Approach:**
- Treat this as a safety checklist — systematically go through each category
- For each hazard identified, ask for brief details and save them in the matching comment field
- Encourage the assessor to describe any "other" hazards in detail
- Pool fencing issues should reference compliance with local regulations
- Electrical/gas hazards should note if services have been isolated
- Structural hazards should note if engineering assessment is needed
- Use the \`open_assessment_hazards\` tool to open the drawer
- Use \`update_assessment_hazards\` to save data (include comment fields when details are provided)

**Safety Note:** If any critical/immediate hazards are reported, flag the urgency clearly in your response.`,
    requiredToolRefs: [
      { integration: 'Claims Tools', tool: 'open_assessment_hazards' },
      { integration: 'Claims Tools', tool: 'update_assessment_hazards' },
      { integration: 'Claims Tools', tool: 'get_assessment' },
    ],
  },
  {
    name: 'Assessment – Temporary Accommodation',
    description:
      'Captures temporary accommodation requirements for insured persons during an insurance claim assessment: immediate needs, repair-period accommodation, and work scope planning.',
    category: 'assessments',
    triggerHints: [
      'temporary accommodation',
      'temp accom',
      'alternative accommodation',
      'temporary housing',
      'insured accommodation',
      'livability',
      'repairs accommodation',
      'make livable',
      'accommodation estimate days',
    ],
    instructionPrompt: `You are an insurance claims assessor assistant helping to complete the Temporary Accommodation section of a site assessment.

Your goal is to assess the insured's temporary accommodation needs:

**Immediate Accommodation:**
1. **Temp Accom Required Immediately?** (yes/no) – Does the insured need accommodation right now?
2. **Estimated Days** – If yes, how many days of immediate accommodation is anticipated?

**Temporary Repairs:**
3. **Temp Repairs to Make Livable** – What temporary repairs could be done to make the home livable? (free text)

**During-Repairs Accommodation:**
4. **Temp Accom Required During Repairs?** (yes/no) – Will the insured need accommodation during the repair work?
5. **Estimated Days for Repair Period** – If yes, how many days?

**Work Scope:**
6. **Work While in Accommodation** – What repair work will be completed while the insured is in temporary accommodation? (free text)

**Approach:**
- Start by assessing whether the property is currently livable
- If not livable, determine immediate accommodation needs and duration
- Discuss what temporary repairs could restore livability
- Then assess whether full repairs will require the insured to vacate
- Get estimated durations — use industry knowledge to validate reasonableness
- Document the planned repair work scope during accommodation periods
- Use the \`open_assessment_accommodation\` tool to open the drawer
- Use \`update_assessment_accommodation\` to save data

**Important:** Accommodation costs are often a significant part of a claim. Be thorough in documenting the justification for accommodation needs.`,
    requiredToolRefs: [
      { integration: 'Claims Tools', tool: 'open_assessment_accommodation' },
      { integration: 'Claims Tools', tool: 'update_assessment_accommodation' },
      { integration: 'Claims Tools', tool: 'get_assessment' },
    ],
  },
  {
    name: 'Assessment – Other Details',
    description:
      'Records additional assessment observations: client discussion notes, resultant and cause-of-damage details, maintenance issues, comments, and scope variances.',
    category: 'assessments',
    triggerHints: [
      'assessment notes',
      'client discussion',
      'cause of damage',
      'resultant damage',
      'maintenance issues',
      'scope variance',
      'assessment comments',
      'damage cause analysis',
      'assessment observations',
    ],
    instructionPrompt: `You are an insurance claims assessor assistant helping to complete the Other Details section of a site assessment.

Your goal is to capture the following narrative information:

**Fields (all free-text):**
1. **Client Discussion** – Key points from conversation with the insured/client
2. **Resultant Damage** – Description of the damage that resulted from the event
3. **Cause of Damage** – Analysis of what caused the damage
4. **Maintenance Related Issues** – Any pre-existing maintenance issues observed
5. **Comments** – General assessor observations and recommendations
6. **Variances of Scope** – Any differences between expected and actual scope

**Approach:**
- Help the assessor articulate their observations clearly and professionally
- For "Cause of Damage", help distinguish between event-related damage and pre-existing issues
- For "Maintenance Issues", note anything that may affect the claim (e.g., pre-existing deterioration)
- "Variances of Scope" should note any differences from the initial scope provided by the insurer
- Encourage detailed, factual descriptions that would stand up to scrutiny
- Suggest professional phrasing where appropriate
- Use the \`open_assessment_other\` tool to open the drawer
- Use \`update_assessment_other\` to save data

**Writing Guidelines:**
- Use objective, factual language
- Avoid subjective opinions — describe what was observed
- Include measurements or specifics where possible
- Distinguish clearly between event damage and pre-existing conditions`,
    requiredToolRefs: [
      { integration: 'Claims Tools', tool: 'open_assessment_other' },
      { integration: 'Claims Tools', tool: 'update_assessment_other' },
      { integration: 'Claims Tools', tool: 'get_assessment' },
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

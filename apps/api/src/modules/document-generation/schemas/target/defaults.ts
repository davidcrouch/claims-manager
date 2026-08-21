import type { DocumentType } from '../../types/document-types';

interface TransformDefault {
  jsonataRules: string;
  targetSchema: Record<string, unknown>;
}

const listTargetSchema = (itemProperties: Record<string, unknown>) => ({
  type: 'object',
  properties: {
    company: { type: 'string', description: 'Company name' },
    title: { type: 'string', description: 'Report title' },
    date: { type: 'string', description: 'Report date' },
    count: { type: 'string', description: 'Total item count' },
    items: {
      type: 'array',
      items: { type: 'object', properties: itemProperties },
    },
  },
  required: ['company', 'title', 'date', 'count', 'items'],
});

const listJsonata = (itemExpr: string) =>
  `{\n  "company": company_name,\n  "title": report_title,\n  "date": report_date,\n  "count": total_count,\n  "items": items.(${itemExpr})\n}`;

const itemTargetProps = {
  name: { type: 'string' },
  description: { type: 'string' },
  category: { type: 'string' },
  quantity: { type: 'string' },
  unit_cost: { type: 'string' },
  tax: { type: 'string' },
  total: { type: 'string' },
  note: { type: 'string', description: 'Line item notes' },
};

const comboTargetProps = {
  name: { type: 'string' },
  description: { type: 'string' },
  quantity: { type: 'string' },
  subtotal: { type: 'string' },
  note: { type: 'string' },
  items: { type: 'array', items: { type: 'object', properties: itemTargetProps } },
};

const scopeTargetProps = {
  name: { type: 'string', description: 'Scope name' },
  description: { type: 'string' },
  quantity: { type: 'string' },
  subtotal: { type: 'string' },
  note: { type: 'string' },
  items: { type: 'array', items: { type: 'object', properties: itemTargetProps } },
  combos: { type: 'array', items: { type: 'object', properties: comboTargetProps } },
};

const groupedDocSchema = (prefix: string, extraProps: Record<string, unknown> = {}) => ({
  type: 'object',
  properties: {
    company: { type: 'string', description: 'Company name' },
    [`${prefix}_number`]: { type: 'string', description: `${prefix} number` },
    name: { type: 'string', description: `${prefix} name` },
    date: { type: 'string', description: 'Primary date' },
    note: { type: 'string', description: 'Notes / comments' },
    to: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, address: { type: 'string' } } },
    from: { type: 'object', properties: { name: { type: 'string' }, address: { type: 'string' } } },
    for_name: { type: 'string', description: 'Prepared for' },
    subtotal: { type: 'string' },
    tax: { type: 'string' },
    total: { type: 'string' },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          note: { type: 'string' },
          subtotal: { type: 'string' },
          items: { type: 'array', items: { type: 'object', properties: itemTargetProps } },
          combos: { type: 'array', items: { type: 'object', properties: comboTargetProps } },
          scopes: { type: 'array', items: { type: 'object', properties: scopeTargetProps } },
        },
      },
    },
    ...extraProps,
  },
});

const itemJsonata = `{ "name": item_name, "description": item_description, "category": item_category, "quantity": item_quantity, "unit_cost": item_unit_cost, "tax": item_tax, "total": item_total, "note": item_note }`;

const comboJsonata = `{ "name": combo_name, "description": combo_description, "quantity": combo_quantity, "subtotal": combo_subtotal, "note": combo_note, "items": items.(${itemJsonata}) }`;

const scopeJsonata = `{ "name": scope_name, "description": scope_description, "quantity": scope_quantity, "subtotal": scope_subtotal, "note": scope_note, "items": items.(${itemJsonata}), "combos": combos.(${comboJsonata}) }`;

const groupedItemsJsonata = `groups.{ "name": group_name, "note": group_note, "subtotal": group_subtotal, "items": items.(${itemJsonata}), "combos": combos.(${comboJsonata}), "scopes": scopes.(${scopeJsonata}) }`;

/** Groups live under `_context.groups` for data-context document types. */
const groupedItemsJsonataCtx = `_context.groups.{ "name": group_name, "note": group_note, "subtotal": group_subtotal, "items": items.(${itemJsonata}), "combos": combos.(${comboJsonata}), "scopes": scopes.(${scopeJsonata}) }`;

export const TRANSFORM_DEFAULTS: Record<DocumentType, TransformDefault> = {
  // ── Detail: Grouped financial documents (data-context source) ────────

  quote: {
    jsonataRules: `{
  "company": _context.organization.name,
  "quote_number": _context.quote.quoteNumber,
  "name": _context.quote.name,
  "date": $formatDate(_context.quote.quoteDate),
  "reference": _context.quote.reference,
  "note": _context.quote.note,
  "expires_in_days": $str(_context.quote.expiresInDays),
  "start_date": $formatDate(_context.quote.estimatedStartDate),
  "completion_date": $formatDate(_context.quote.estimatedCompletionDate),
  "to": {
    "name": _context.quote.quoteToName ? _context.quote.quoteToName : _context.quote.quoteTo.name,
    "email": _context.quote.quoteToEmail ? _context.quote.quoteToEmail : _context.quote.quoteTo.email,
    "address": _context.quote.quoteTo.address
  },
  "from": { "name": _context.quote.quoteFrom.name, "address": _context.quote.quoteFrom.address },
  "for_name": _context.quote.quoteForName ? _context.quote.quoteForName : _context.quote.quoteFor.name,
  "subtotal": $formatCurrency(_context.quote.subTotal),
  "tax": $formatCurrency(_context.quote.totalTax),
  "total": $formatCurrency(_context.quote.totalAmount),
  "groups": ${groupedItemsJsonataCtx}
}`,
    targetSchema: groupedDocSchema('quote', {
      reference: { type: 'string' },
      expires_in_days: { type: 'string' },
      start_date: { type: 'string' },
      completion_date: { type: 'string' },
    }),
  },

  purchase_order: {
    jsonataRules: `{
  "company": _context.organization.name,
  "po_number": _context.purchase_order.purchaseOrderNumber,
  "name": _context.purchase_order.name,
  "start_date": $formatDate(_context.purchase_order.startDate),
  "end_date": $formatDate(_context.purchase_order.endDate),
  "note": _context.purchase_order.note,
  "to": {
    "name": _context.purchase_order.poTo.name,
    "email": _context.purchase_order.poToEmail,
    "address": _context.purchase_order.poTo.address
  },
  "from": { "name": _context.purchase_order.poFrom.name, "address": _context.purchase_order.poFrom.address },
  "for_name": _context.purchase_order.poForName ? _context.purchase_order.poForName : _context.purchase_order.poFor.name,
  "total": $formatCurrency(_context.purchase_order.totalAmount),
  "adjusted_total": $formatCurrency(_context.purchase_order.adjustedTotal),
  "groups": ${groupedItemsJsonataCtx}
}`,
    targetSchema: groupedDocSchema('po', { adjusted_total: { type: 'string' } }),
  },

  work_order: {
    jsonataRules: `{
  "company": _context.organization.name,
  "wo_number": _context.work_order.workOrderNumber,
  "name": _context.work_order.name,
  "start_date": $formatDate(_context.work_order.startDate),
  "end_date": $formatDate(_context.work_order.endDate),
  "note": _context.work_order.note,
  "scope": _context.work_order.scopeOfWork,
  "to": {
    "name": _context.work_order.woTo.name,
    "email": _context.work_order.woToEmail,
    "address": _context.work_order.woTo.address
  },
  "from": { "name": _context.work_order.woFrom.name, "address": _context.work_order.woFrom.address },
  "for_name": _context.work_order.woForName ? _context.work_order.woForName : _context.work_order.woFor.name,
  "total": $formatCurrency(_context.work_order.totalAmount),
  "adjusted_total": $formatCurrency(_context.work_order.adjustedTotal),
  "groups": ${groupedItemsJsonataCtx}
}`,
    targetSchema: groupedDocSchema('wo', { scope: { type: 'string' }, adjusted_total: { type: 'string' } }),
  },

  proposal: {
    jsonataRules: `{
  "company": _context.organization.name,
  "proposal_number": _context.proposal.proposalNumber,
  "name": _context.proposal.name,
  "reference": _context.proposal.reference,
  "date": $formatDate(_context.proposal.proposalDate),
  "received_date": $formatDate(_context.proposal.receivedDate),
  "note": _context.proposal.note,
  "to": {
    "name": _context.proposal.proposalToName ? _context.proposal.proposalToName : _context.proposal.proposalTo.name,
    "email": _context.proposal.proposalToEmail
  },
  "from": { "name": _context.proposal.proposalFromName },
  "for_name": _context.proposal.proposalFor.name,
  "subtotal": $formatCurrency(_context.proposal.subTotal),
  "tax": $formatCurrency(_context.proposal.totalTax),
  "total": $formatCurrency(_context.proposal.totalAmount),
  "groups": ${groupedItemsJsonataCtx}
}`,
    targetSchema: groupedDocSchema('proposal', { reference: { type: 'string' }, received_date: { type: 'string' } }),
  },

  rfq: {
    jsonataRules: `{
  "company": _context.organization.name,
  "rfq_number": _context.rfq.rfqNumber,
  "name": _context.rfq.name,
  "note": _context.rfq.note,
  "sent_date": $formatDate(_context.rfq.sentDate),
  "due_date": $formatDate(_context.rfq.dueDate),
  "received_date": $formatDate(_context.rfq.receivedDate),
  "include_pricing": $yn(_context.rfq.includePricing),
  "include_quantities": $yn(_context.rfq.includeQuantities),
  "to": {
    "name": _context.rfq.rfqToName ? _context.rfq.rfqToName : _context.rfq.rfqTo.name,
    "email": _context.rfq.rfqToEmail ? _context.rfq.rfqToEmail : _context.rfq.rfqTo.email
  },
  "from": { "name": _context.rfq.rfqFrom.name },
  "groups": ${groupedItemsJsonataCtx}
}`,
    targetSchema: groupedDocSchema('rfq', {
      sent_date: { type: 'string' }, due_date: { type: 'string' }, received_date: { type: 'string' },
      include_pricing: { type: 'string' }, include_quantities: { type: 'string' },
    }),
  },

  // ── Detail: Flat financial documents ─────────────────────────────────

  invoice: {
    jsonataRules: `{
  "company": _context.organization.name,
  "number": _context.invoice.invoiceNumber,
  "date": $formatDate(_context.invoice.issueDate),
  "received": $formatDate(_context.invoice.receivedDate),
  "notes": _context.invoice.comments,
  "subtotal": $formatCurrency(_context.invoice.subTotal),
  "tax": $formatCurrency(_context.invoice.totalTax),
  "total": $formatCurrency(_context.invoice.totalAmount),
  "excess": $formatCurrency(_context.invoice.excessAmount),
  "po": {
    "number": _context.purchase_order.purchaseOrderNumber,
    "name": _context.purchase_order.name
  }
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' }, number: { type: 'string' },
        date: { type: 'string' }, received: { type: 'string' }, notes: { type: 'string' },
        subtotal: { type: 'string' }, tax: { type: 'string' }, total: { type: 'string' },
        excess: { type: 'string' },
        po: { type: 'object', properties: { number: { type: 'string' }, name: { type: 'string' } } },
      },
    },
  },

  bill: {
    jsonataRules: `{
  "company": _context.organization.name,
  "number": _context.bill.billNumber,
  "invoice_number": _context.invoice.invoiceNumber,
  "po_number": _context.purchase_order.purchaseOrderNumber,
  "issue_date": $formatDate(_context.bill.issueDate),
  "received_date": $formatDate(_context.bill.receivedDate),
  "due_date": $formatDate(_context.bill.dueDate),
  "payment_date": $formatDate(_context.bill.paymentDate),
  "notes": _context.bill.comments,
  "subtotal": $formatCurrency(_context.bill.subTotal),
  "tax": $formatCurrency(_context.bill.totalTax),
  "total": $formatCurrency(_context.bill.totalAmount)
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' }, number: { type: 'string' },
        invoice_number: { type: 'string' }, po_number: { type: 'string' },
        issue_date: { type: 'string' }, received_date: { type: 'string' },
        due_date: { type: 'string' }, payment_date: { type: 'string' },
        notes: { type: 'string' }, subtotal: { type: 'string' }, tax: { type: 'string' }, total: { type: 'string' },
      },
    },
  },

  // ── Detail: Entity documents ─────────────────────────────────────────

  job_details: {
    jsonataRules: `{
  "company": _context.organization.name,
  "name": _context.job.name,
  "reference": _context.job.externalReference ? _context.job.externalReference : _context.job.externalJobId,
  "status": _context.job.statusName,
  "type": _context.job.jobTypeName,
  "request_date": $formatDate(_context.job.requestDate),
  "excess": $formatCurrency(_context.job.excess),
  "make_safe": $yn(_context.job.makeSafeRequired),
  "instructions": _context.job.jobInstructions,
  "address": _context.job.address,
  "suburb": _context.job.addressSuburb,
  "state": _context.job.addressState,
  "postcode": _context.job.addressPostcode,
  "claim": {
    "number": _context.claim.claimNumber,
    "reference": _context.claim.externalReference,
    "date_of_loss": $formatDate(_context.claim.dateOfLoss),
    "incident": _context.claim.incidentDescription
  },
  "scope": _context.job.jobInstructions,
  "date": $formatDate($now())
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' }, name: { type: 'string' }, reference: { type: 'string' },
        status: { type: 'string' }, type: { type: 'string' }, request_date: { type: 'string' },
        excess: { type: 'string' }, make_safe: { type: 'string' }, instructions: { type: 'string' },
        address: { type: 'string' }, suburb: { type: 'string' }, state: { type: 'string' }, postcode: { type: 'string' },
        claim: { type: 'object', properties: {
          number: { type: 'string' }, reference: { type: 'string' }, date_of_loss: { type: 'string' }, incident: { type: 'string' },
        }},
        scope: { type: 'string' }, date: { type: 'string' },
      },
    },
  },

  scope_of_work: {
    jsonataRules: `{
  "company": _context.organization.name,
  "name": _context.job.name,
  "reference": _context.job.externalReference ? _context.job.externalReference : _context.job.externalJobId,
  "status": _context.job.statusName,
  "type": _context.job.jobTypeName,
  "request_date": $formatDate(_context.job.requestDate),
  "excess": $formatCurrency(_context.job.excess),
  "make_safe": $yn(_context.job.makeSafeRequired),
  "instructions": _context.job.jobInstructions,
  "address": _context.job.address,
  "suburb": _context.job.addressSuburb,
  "state": _context.job.addressState,
  "postcode": _context.job.addressPostcode,
  "claim": {
    "number": _context.claim.claimNumber,
    "reference": _context.claim.externalReference,
    "date_of_loss": $formatDate(_context.claim.dateOfLoss),
    "incident": _context.claim.incidentDescription
  },
  "scope": _context.job.jobInstructions,
  "date": $formatDate($now())
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' }, name: { type: 'string' }, reference: { type: 'string' },
        status: { type: 'string' }, type: { type: 'string' }, request_date: { type: 'string' },
        excess: { type: 'string' }, make_safe: { type: 'string' }, instructions: { type: 'string' },
        address: { type: 'string' }, suburb: { type: 'string' }, state: { type: 'string' }, postcode: { type: 'string' },
        claim: { type: 'object', properties: {
          number: { type: 'string' }, reference: { type: 'string' }, date_of_loss: { type: 'string' }, incident: { type: 'string' },
        }},
        scope: { type: 'string' }, date: { type: 'string' },
      },
    },
  },

  claim: {
    jsonataRules: `{
  "company": _context.organization.name,
  "number": _context.claim.claimNumber,
  "reference": _context.claim.externalReference,
  "status": $str(_context.claim.statusLookupId),
  "lodgement_date": $formatDate(_context.claim.lodgementDate),
  "date_of_loss": $formatDate(_context.claim.dateOfLoss),
  "incident": _context.claim.incidentDescription,
  "address": _context.claim.address,
  "policy": { "number": _context.claim.policyNumber, "name": _context.claim.policyName },
  "abn": _context.claim.abn,
  "vulnerable": $yn(_context.claim.vulnerableCustomer),
  "total_loss": $yn(_context.claim.totalLoss),
  "contentious": $yn(_context.claim.contentiousClaim),
  "date": $formatDate($now())
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' }, number: { type: 'string' }, reference: { type: 'string' },
        status: { type: 'string' }, lodgement_date: { type: 'string' }, date_of_loss: { type: 'string' },
        incident: { type: 'string' }, address: { type: 'string' },
        policy: { type: 'object', properties: { number: { type: 'string' }, name: { type: 'string' } } },
        abn: { type: 'string' }, vulnerable: { type: 'string' }, total_loss: { type: 'string' },
        contentious: { type: 'string' }, date: { type: 'string' },
      },
    },
  },

  contact: {
    jsonataRules: `{
  "company": company_name,
  "first_name": first_name,
  "last_name": last_name,
  "full_name": full_name,
  "email": email,
  "phone": { "mobile": mobile_phone, "home": home_phone, "work": work_phone },
  "notes": notes,
  "date": report_date
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' }, first_name: { type: 'string' }, last_name: { type: 'string' },
        full_name: { type: 'string' }, email: { type: 'string' },
        phone: { type: 'object', properties: { mobile: { type: 'string' }, home: { type: 'string' }, work: { type: 'string' } } },
        notes: { type: 'string' }, date: { type: 'string' },
      },
    },
  },

  task: {
    jsonataRules: `{
  "company": company_name,
  "name": task_name,
  "description": description,
  "status": status,
  "priority": priority,
  "due_date": due_date,
  "completed_at": completed_at,
  "date": report_date
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' },
        status: { type: 'string' }, priority: { type: 'string' }, due_date: { type: 'string' },
        completed_at: { type: 'string' }, date: { type: 'string' },
      },
    },
  },

  appointment: {
    jsonataRules: `{
  "company": company_name,
  "name": appointment_name,
  "location": location,
  "start": start_date,
  "end": end_date,
  "status": status,
  "date": report_date
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' }, name: { type: 'string' }, location: { type: 'string' },
        start: { type: 'string' }, end: { type: 'string' }, status: { type: 'string' }, date: { type: 'string' },
      },
    },
  },

  message: {
    jsonataRules: `{
  "company": company_name,
  "subject": subject,
  "body": body,
  "ack_required": acknowledgement_required,
  "ack_at": acknowledged_at,
  "created": created_at,
  "date": report_date
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' },
        ack_required: { type: 'string' }, ack_at: { type: 'string' },
        created: { type: 'string' }, date: { type: 'string' },
      },
    },
  },

  journal: {
    jsonataRules: `{
  "company": company_name,
  "name": journal_name,
  "description": description,
  "status": status,
  "suburb": address_suburb,
  "state": address_state,
  "postcode": address_postcode,
  "created": created_at,
  "date": report_date
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' },
        status: { type: 'string' }, suburb: { type: 'string' }, state: { type: 'string' },
        postcode: { type: 'string' }, created: { type: 'string' }, date: { type: 'string' },
      },
    },
  },

  vendor: {
    jsonataRules: `{
  "company": company_name,
  "name": vendor_name,
  "reference": external_reference,
  "phone": phone,
  "after_hours_phone": after_hours_phone,
  "postcode": postcode,
  "state": state,
  "city": city,
  "country": country,
  "active": is_active,
  "date": report_date
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' }, name: { type: 'string' }, reference: { type: 'string' },
        phone: { type: 'string' }, after_hours_phone: { type: 'string' },
        postcode: { type: 'string' }, state: { type: 'string' }, city: { type: 'string' },
        country: { type: 'string' }, active: { type: 'string' }, date: { type: 'string' },
      },
    },
  },

  assessment: {
    jsonataRules: `(
  $a := _context.assessment;
  $job := _context.job;
  $att := $a.attendance ? $a.attendance : {};
  $bld := $a.building ? $a.building : {};
  $hab := $a.habitability ? $a.habitability : {};
  $haz := $a.hazards ? $a.hazards : {};
  $dmg := $a.damage ? $a.damage : {};
  $ms := $a.makeSafe ? $a.makeSafe : {};
  $ta := $a.temporaryAccommodation ? $a.temporaryAccommodation : {};
  $rec := $a.recommendation ? $a.recommendation : {};
  $details := $haz.hazardDetails ? $haz.hazardDetails : {};
  {
    "company_name": _context.organization.name,
    "assessment_name": $a.name,
    "status": $a.status,
    "job_name": $job.name,
    "job_reference": $job.externalReference,
    "claim_recommendation": $str($rec.claimRecommendation),
    "design_type": $str($bld.designType),
    "construction": $str($bld.constructionType),
    "roof_type": $str($bld.roofType),
    "building_type": $str($bld.buildingType),
    "make_safe": $yn($ms.makeSafeRequired),
    "make_safe_type": $str($ms.makeSafeType),
    "squares": $str($bld.squares),
    "building_age": $str($bld.estimatedBuildYear),
    "square_metres": $str($bld.houseM2),
    "date_booked": $formatDate($att.siteAttendanceDate),
    "overall_condition_acceptable": $yn($bld.propertyCondition),
    "iag_inspection_required": $yn($att.insuranceAssessorAttended),
    "make_safe_completion_date": $formatDate($ms.dateMakeSafeCompleted),
    "main_roof_damage": $yn($bld.mainHouseRoofDamage),
    "date_main_roof_repaired": $formatDate($ms.dateMainRoofRepaired),
    "habitable": $yn($hab.habitable),
    "mould": $contains($lowercase($str($haz.environmentalHazards)), "mould") ? "Yes" : "No",
    "asbestos_on_site": $contains($lowercase($str($haz.safetyHazards)), "asbestos") ? "Yes" : "No",
    "detached_garage": $contains($str($bld.additionalStructures), "Garage") ? "Yes" : "No",
    "sheds": $contains($str($bld.additionalStructures), "Shed") ? "Yes" : "No",
    "swimming_pool": $contains($str($bld.additionalStructures), "Pool") ? "Yes" : "No",
    "detached_granny_flat": $contains($str($bld.additionalStructures), "Granny") ? "Yes" : "No",
    "damage_caused_by_listed_event": $str($dmg.hasDamageCoveredByPolicy),
    "hazard_pool_fencing": $yn($details.poolFencing.flagged),
    "hazard_pool_fencing_comment": $str($details.poolFencing.comment),
    "hazard_electrical_gas": $yn($details.electrical.flagged),
    "hazard_electrical_gas_comment": $str($details.electrical.comment),
    "hazard_sewerage": $yn($details.sewerage.flagged),
    "hazard_sewerage_comment": $str($details.sewerage.comment),
    "hazard_structural": $yn($details.structural.flagged),
    "hazard_structural_comment": $str($details.structural.comment),
    "hazard_other": $str($details.other) ? $str($details.other) : $str($haz.safetyHazards),
    "temp_accom_required_immediately": $yn($ta.requiredImmediately),
    "temp_accom_immediate_estimate_days": $str($ta.immediateEstimateDays),
    "temp_repairs_to_make_livable": $str($ta.tempRepairsToMakeLivable),
    "temp_accom_required_during_repairs": $yn($ta.requiredDuringRepairs),
    "temp_accom_repairs_estimate_days": $str($ta.repairsEstimateDays),
    "work_while_in_accommodation": $str($ta.workWhileInAccommodation),
    "client_discussion": $str($rec.clientDiscussions),
    "resultant_damage": $str($dmg.damageObserved),
    "cause_of_damage": $str($dmg.causeOfDamage),
    "maintenance_related_issues": $str($dmg.maintenanceDefectIssues),
    "comments": $str($rec.specialNotes),
    "variances_of_scope": $str($rec.conclusion),
    "created_at": $formatDate($a.createdAt),
    "report_date": $formatDate($now())
  }
)`,
    targetSchema: { type: 'object', additionalProperties: true, description: 'Assessment merge fields derived from _context' },
  },

  report: {
    jsonataRules: `{
  "company_name": _context.organization.name,
  "title": _context.report.title,
  "reference": _context.report.reference,
  "report_data": _context.report.reportData,
  "report_meta": _context.report.reportMeta,
  "created_at": $formatDate(_context.report.createdAt),
  "report_date": $formatDate($now()),
  "job": _context.job,
  "claim": _context.claim
}`,
    targetSchema: { type: 'object', additionalProperties: true, description: 'Report merge fields from _context' },
  },

  // ── List reports ─────────────────────────────────────────────────────

  jobs_list: {
    jsonataRules: listJsonata(`{ "name": name, "reference": reference, "date": request_date, "suburb": suburb, "state": state }`),
    targetSchema: listTargetSchema({
      name: { type: 'string' }, reference: { type: 'string' }, date: { type: 'string' },
      suburb: { type: 'string' }, state: { type: 'string' },
    }),
  },

  quotes_list: {
    jsonataRules: listJsonata(`{ "number": quote_number, "name": name, "date": date, "total": total_amount }`),
    targetSchema: listTargetSchema({
      number: { type: 'string' }, name: { type: 'string' }, date: { type: 'string' }, total: { type: 'string' },
    }),
  },

  invoices_list: {
    jsonataRules: listJsonata(`{ "number": invoice_number, "name": name, "date": date, "total": total_amount }`),
    targetSchema: listTargetSchema({
      number: { type: 'string' }, name: { type: 'string' }, date: { type: 'string' }, total: { type: 'string' },
    }),
  },

  bills_list: {
    jsonataRules: listJsonata(`{ "number": bill_number, "name": name, "date": date, "total": total_amount }`),
    targetSchema: listTargetSchema({
      number: { type: 'string' }, name: { type: 'string' }, date: { type: 'string' }, total: { type: 'string' },
    }),
  },

  work_orders_list: {
    jsonataRules: listJsonata(`{ "number": wo_number, "name": name, "date": start_date, "total": total_amount }`),
    targetSchema: listTargetSchema({
      number: { type: 'string' }, name: { type: 'string' }, date: { type: 'string' }, total: { type: 'string' },
    }),
  },

  purchase_orders_list: {
    jsonataRules: listJsonata(`{ "number": po_number, "name": name, "date": date, "total": total_amount }`),
    targetSchema: listTargetSchema({
      number: { type: 'string' }, name: { type: 'string' }, date: { type: 'string' }, total: { type: 'string' },
    }),
  },

  proposals_list: {
    jsonataRules: listJsonata(`{ "number": proposal_number, "name": name, "date": date, "total": total_amount }`),
    targetSchema: listTargetSchema({
      number: { type: 'string' }, name: { type: 'string' }, date: { type: 'string' }, total: { type: 'string' },
    }),
  },

  rfqs_list: {
    jsonataRules: listJsonata(`{ "number": rfq_number, "name": name, "date": date }`),
    targetSchema: listTargetSchema({
      number: { type: 'string' }, name: { type: 'string' }, date: { type: 'string' },
    }),
  },

  reports_list: {
    jsonataRules: listJsonata(`{ "title": title, "reference": reference, "created": created_at }`),
    targetSchema: listTargetSchema({
      title: { type: 'string' }, reference: { type: 'string' }, created: { type: 'string' },
    }),
  },

  claims_list: {
    jsonataRules: listJsonata(`{ "number": claim_number, "reference": external_reference, "date": lodgement_date, "policy": policy_number }`),
    targetSchema: listTargetSchema({
      number: { type: 'string' }, reference: { type: 'string' }, date: { type: 'string' }, policy: { type: 'string' },
    }),
  },

  contacts_list: {
    jsonataRules: listJsonata(`{ "name": full_name, "email": email, "phone": mobile_phone }`),
    targetSchema: listTargetSchema({
      name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' },
    }),
  },

  tasks_list: {
    jsonataRules: listJsonata(`{ "name": name, "status": status, "priority": priority, "due": due_date }`),
    targetSchema: listTargetSchema({
      name: { type: 'string' }, status: { type: 'string' }, priority: { type: 'string' }, due: { type: 'string' },
    }),
  },

  appointments_list: {
    jsonataRules: listJsonata(`{ "name": name, "location": location, "start": start_date, "end": end_date, "status": status }`),
    targetSchema: listTargetSchema({
      name: { type: 'string' }, location: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, status: { type: 'string' },
    }),
  },

  messages_list: {
    jsonataRules: listJsonata(`{ "subject": subject, "created": created_at, "ack_required": acknowledgement_required }`),
    targetSchema: listTargetSchema({
      subject: { type: 'string' }, created: { type: 'string' }, ack_required: { type: 'string' },
    }),
  },

  journals_list: {
    jsonataRules: listJsonata(`{ "name": name, "status": status, "suburb": suburb, "state": state, "created": created_at }`),
    targetSchema: listTargetSchema({
      name: { type: 'string' }, status: { type: 'string' }, suburb: { type: 'string' }, state: { type: 'string' }, created: { type: 'string' },
    }),
  },

  vendors_list: {
    jsonataRules: listJsonata(`{ "name": name, "reference": external_reference, "phone": phone, "state": state, "active": is_active }`),
    targetSchema: listTargetSchema({
      name: { type: 'string' }, reference: { type: 'string' }, phone: { type: 'string' }, state: { type: 'string' }, active: { type: 'string' },
    }),
  },

  assessments_list: {
    jsonataRules: listJsonata(
      `{ "name": name, "status": status, "job": job_name, "reference": job_reference, "created": created_at }`,
    ),
    targetSchema: listTargetSchema({
      name: { type: 'string' },
      status: { type: 'string' },
      job: { type: 'string' },
      reference: { type: 'string' },
      created: { type: 'string' },
    }),
  },

  documents_list: {
    jsonataRules: listJsonata(
      `{ "name": file_name, "type": mime_type, "status": upload_status, "related": related_record_type, "created": created_at }`,
    ),
    targetSchema: listTargetSchema({
      name: { type: 'string' },
      type: { type: 'string' },
      status: { type: 'string' },
      related: { type: 'string' },
      created: { type: 'string' },
    }),
  },

  schedule_list: {
    jsonataRules: listJsonata(
      `{ "name": name, "location": location, "start": start_date, "end": end_date, "status": status, "job": job_name }`,
    ),
    targetSchema: listTargetSchema({
      name: { type: 'string' },
      location: { type: 'string' },
      start: { type: 'string' },
      end: { type: 'string' },
      status: { type: 'string' },
      job: { type: 'string' },
    }),
  },

  document: {
    jsonataRules: `{
  "company": company_name,
  "file_name": file_name,
  "mime_type": mime_type,
  "file_size": file_size,
  "upload_status": upload_status,
  "related_record_type": related_record_type,
  "related_record_id": related_record_id,
  "source_system": source_system,
  "pipeline_status": pipeline_status,
  "created_at": created_at,
  "date": report_date
}`,
    targetSchema: {
      type: 'object',
      properties: {
        company: { type: 'string' },
        file_name: { type: 'string' },
        mime_type: { type: 'string' },
        file_size: { type: 'string' },
        upload_status: { type: 'string' },
        related_record_type: { type: 'string' },
        related_record_id: { type: 'string' },
        source_system: { type: 'string' },
        pipeline_status: { type: 'string' },
        created_at: { type: 'string' },
        date: { type: 'string' },
      },
      required: ['company', 'file_name', 'date'],
    },
  },
};

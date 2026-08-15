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

export const TRANSFORM_DEFAULTS: Record<DocumentType, TransformDefault> = {
  // ── Detail: Grouped financial documents ──────────────────────────────

  quote: {
    jsonataRules: `{
  "company": company_name,
  "quote_number": quote_number,
  "name": quote_name,
  "date": quote_date,
  "reference": quote_reference,
  "note": quote_note,
  "expires_in_days": expires_in_days,
  "start_date": estimated_start_date,
  "completion_date": estimated_completion_date,
  "to": { "name": quote_to_name, "email": quote_to_email, "address": quote_to_address },
  "from": { "name": quote_from_name, "address": quote_from_address },
  "for_name": quote_for_name,
  "subtotal": sub_total,
  "tax": total_tax,
  "total": total_amount,
  "groups": ${groupedItemsJsonata}
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
  "company": company_name,
  "po_number": po_number,
  "name": po_name,
  "start_date": start_date,
  "end_date": end_date,
  "note": note,
  "to": { "name": po_to_name, "email": po_to_email, "address": po_to_address },
  "from": { "name": po_from_name, "address": po_from_address },
  "for_name": po_for_name,
  "total": total_amount,
  "adjusted_total": adjusted_total,
  "groups": ${groupedItemsJsonata}
}`,
    targetSchema: groupedDocSchema('po', { adjusted_total: { type: 'string' } }),
  },

  work_order: {
    jsonataRules: `{
  "company": company_name,
  "wo_number": wo_number,
  "name": wo_name,
  "start_date": start_date,
  "end_date": end_date,
  "note": note,
  "scope": scope_of_work,
  "to": { "name": wo_to_name, "email": wo_to_email, "address": wo_to_address },
  "from": { "name": wo_from_name, "address": wo_from_address },
  "for_name": wo_for_name,
  "total": total_amount,
  "adjusted_total": adjusted_total,
  "groups": ${groupedItemsJsonata}
}`,
    targetSchema: groupedDocSchema('wo', { scope: { type: 'string' }, adjusted_total: { type: 'string' } }),
  },

  proposal: {
    jsonataRules: `{
  "company": company_name,
  "proposal_number": proposal_number,
  "name": proposal_name,
  "reference": proposal_reference,
  "date": proposal_date,
  "received_date": received_date,
  "note": note,
  "to": { "name": proposal_to_name, "email": proposal_to_email },
  "from": { "name": proposal_from_name },
  "for_name": proposal_for_name,
  "subtotal": sub_total,
  "tax": total_tax,
  "total": total_amount,
  "groups": ${groupedItemsJsonata}
}`,
    targetSchema: groupedDocSchema('proposal', { reference: { type: 'string' }, received_date: { type: 'string' } }),
  },

  rfq: {
    jsonataRules: `{
  "company": company_name,
  "rfq_number": rfq_number,
  "name": rfq_name,
  "note": note,
  "sent_date": sent_date,
  "due_date": due_date,
  "received_date": received_date,
  "include_pricing": include_pricing,
  "include_quantities": include_quantities,
  "to": { "name": rfq_to_name, "email": rfq_to_email },
  "from": { "name": rfq_from_name },
  "groups": ${groupedItemsJsonata}
}`,
    targetSchema: groupedDocSchema('rfq', {
      sent_date: { type: 'string' }, due_date: { type: 'string' }, received_date: { type: 'string' },
      include_pricing: { type: 'string' }, include_quantities: { type: 'string' },
    }),
  },

  // ── Detail: Flat financial documents ─────────────────────────────────

  invoice: {
    jsonataRules: `{
  "company": company_name,
  "number": invoice_number,
  "date": issue_date,
  "received": received_date,
  "notes": comments,
  "subtotal": sub_total,
  "tax": total_tax,
  "total": total_amount,
  "excess": excess_amount,
  "po": { "number": po_number, "name": po_name }
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
  "company": company_name,
  "number": bill_number,
  "invoice_number": invoice_number,
  "po_number": po_number,
  "issue_date": issue_date,
  "received_date": received_date,
  "due_date": due_date,
  "payment_date": payment_date,
  "notes": comments,
  "subtotal": sub_total,
  "tax": total_tax,
  "total": total_amount
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
  "company": company_name,
  "name": job_name,
  "reference": job_reference,
  "status": job_status,
  "type": job_type,
  "request_date": request_date,
  "excess": excess,
  "make_safe": make_safe_required,
  "instructions": job_instructions,
  "address": job_address,
  "suburb": address_suburb,
  "state": address_state,
  "postcode": address_postcode,
  "claim": { "number": claim_number, "reference": claim_reference, "date_of_loss": date_of_loss, "incident": incident_description },
  "scope": scope_of_work,
  "date": report_date
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
  "company": company_name,
  "name": job_name,
  "reference": job_reference,
  "status": job_status,
  "type": job_type,
  "request_date": request_date,
  "excess": excess,
  "make_safe": make_safe_required,
  "instructions": job_instructions,
  "address": job_address,
  "suburb": address_suburb,
  "state": address_state,
  "postcode": address_postcode,
  "claim": { "number": claim_number, "reference": claim_reference, "date_of_loss": date_of_loss, "incident": incident_description },
  "scope": scope_of_work,
  "date": report_date
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
  "company": company_name,
  "number": claim_number,
  "reference": external_reference,
  "status": status,
  "lodgement_date": lodgement_date,
  "date_of_loss": date_of_loss,
  "incident": incident_description,
  "address": address,
  "policy": { "number": policy_number, "name": policy_name },
  "abn": abn,
  "vulnerable": vulnerable_customer,
  "total_loss": total_loss,
  "contentious": contentious_claim,
  "date": report_date
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
    jsonataRules: `$`,
    targetSchema: { type: 'object', additionalProperties: true, description: 'Assessment has ~50 fields; passthrough by default — customize as needed.' },
  },

  report: {
    jsonataRules: `$`,
    targetSchema: { type: 'object', additionalProperties: true, description: 'Report has dynamic data_* keys; passthrough by default.' },
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

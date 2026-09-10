import type { ResolvedEmailTemplate } from './email-template.service';

const WRAP_START = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">`;
const WRAP_END = `
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
  <p style="color: #888; font-size: 12px;">This email was sent via EnsureOS.</p>
</div>
`.trim();

export const DEFAULT_FEEDBACK_SUBMITTED_TEMPLATE: ResolvedEmailTemplate = {
  subject: 'We received your feedback: {{feedback_title}}',
  bodyHtml: `
${WRAP_START}
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">We received your feedback</h2>
  <p style="color: #333; line-height: 1.6;">Hi {{recipient_name_html}},</p>
  <p style="color: #333; line-height: 1.6;">
    Thanks for submitting <strong>{{feedback_title_html}}</strong>
    ({{type_label}}). We'll review it and follow up if we need more information.
  </p>
  <div style="margin: 20px 0; padding: 12px 16px; background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; color: #333; line-height: 1.6;">
    {{description_html}}
  </div>
  {{feedback_link_html}}
  <p style="color: #333; line-height: 1.6;">Kind regards,<br/>EnsureOS</p>
${WRAP_END}
  `.trim(),
  bodyText: `We received your feedback

Hi {{recipient_name}},

Thanks for submitting "{{feedback_title}}" ({{type_label}}). We'll review it and follow up if we need more information.

{{description}}

{{feedback_url}}

Kind regards,
EnsureOS`,
};

export const DEFAULT_FEEDBACK_NOTE_ADDED_TEMPLATE: ResolvedEmailTemplate = {
  subject: 'Note added on your feedback: {{feedback_title}}',
  bodyHtml: `
${WRAP_START}
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">New note on your feedback</h2>
  <p style="color: #333; line-height: 1.6;">Hi {{recipient_name_html}},</p>
  <p style="color: #333; line-height: 1.6;">
    {{actor_name_html}} added a note to your feedback item <strong>{{feedback_title_html}}</strong>.
  </p>
  <div style="margin: 20px 0; padding: 12px 16px; background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; color: #333; line-height: 1.6;">
    {{note_body_html}}
  </div>
  {{feedback_link_html}}
  <p style="color: #333; line-height: 1.6;">Kind regards,<br/>EnsureOS</p>
${WRAP_END}
  `.trim(),
  bodyText: `New note on your feedback

Hi {{recipient_name}},

{{actor_name}} added a note to your feedback item "{{feedback_title}}".

{{note_body}}

{{feedback_url}}

Kind regards,
EnsureOS`,
};

export const DEFAULT_FEEDBACK_STATUS_CHANGED_TEMPLATE: ResolvedEmailTemplate = {
  subject: 'Your feedback was updated to {{status_label}}: {{feedback_title}}',
  bodyHtml: `
${WRAP_START}
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Feedback status updated</h2>
  <p style="color: #333; line-height: 1.6;">Hi {{recipient_name_html}},</p>
  <p style="color: #333; line-height: 1.6;">
    The status of your feedback item <strong>{{feedback_title_html}}</strong> has been changed
    from {{previous_status_label}} to <strong>{{status_label}}</strong>.
  </p>
  {{feedback_link_html}}
  <p style="color: #333; line-height: 1.6;">Kind regards,<br/>EnsureOS</p>
${WRAP_END}
  `.trim(),
  bodyText: `Feedback status updated

Hi {{recipient_name}},

The status of your feedback item "{{feedback_title}}" has been changed from {{previous_status_label}} to {{status_label}}.

{{feedback_url}}

Kind regards,
EnsureOS`,
};

export const DEFAULT_FEEDBACK_RESOLVED_TEMPLATE: ResolvedEmailTemplate = {
  subject: 'Please verify your feedback is resolved: {{feedback_title}}',
  bodyHtml: `
${WRAP_START}
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Please verify this feedback is fixed</h2>
  <p style="color: #333; line-height: 1.6;">Hi {{recipient_name_html}},</p>
  <p style="color: #333; line-height: 1.6;">
    Your feedback item <strong>{{feedback_title_html}}</strong> has been marked as
    <strong>Resolved</strong>.
  </p>
  <p style="color: #333; line-height: 1.6;">
    Please verify that the issue is fixed. If it is, mark the item as
    <strong>Closed</strong> on the Feedback page.
  </p>
  {{feedback_link_html}}
  <p style="color: #333; line-height: 1.6;">Kind regards,<br/>EnsureOS</p>
${WRAP_END}
  `.trim(),
  bodyText: `Please verify this feedback is fixed

Hi {{recipient_name}},

Your feedback item "{{feedback_title}}" has been marked as Resolved.

Please verify that the issue is fixed. If it is, mark the item as Closed on the Feedback page.

{{feedback_url}}

Kind regards,
EnsureOS`,
};

export function defaultFeedbackEmailTemplate(
  templateType: string,
): ResolvedEmailTemplate | null {
  switch (templateType) {
    case 'feedback_submitted':
      return DEFAULT_FEEDBACK_SUBMITTED_TEMPLATE;
    case 'feedback_note_added':
      return DEFAULT_FEEDBACK_NOTE_ADDED_TEMPLATE;
    case 'feedback_status_changed':
      return DEFAULT_FEEDBACK_STATUS_CHANGED_TEMPLATE;
    case 'feedback_resolved_verify':
      return DEFAULT_FEEDBACK_RESOLVED_TEMPLATE;
    default:
      return null;
  }
}

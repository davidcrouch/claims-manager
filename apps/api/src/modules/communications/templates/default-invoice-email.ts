import type { ResolvedEmailTemplate } from './email-template.service';

export const DEFAULT_INVOICE_EMAIL_TEMPLATE: ResolvedEmailTemplate = {
  subject: 'Invoice: {{invoice_number}}',
  bodyHtml: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Invoice</h2>
  <p style="color: #333; line-height: 1.6;">Dear {{recipient_name}},</p>
  <p style="color: #333; line-height: 1.6;">
    Please find attached Invoice <strong>{{invoice_number}}</strong> from <strong>{{company_name}}</strong>.
  </p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: 600; background: #f8f8f8; width: 140px;">Invoice Number</td>
      <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">{{invoice_number}}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: 600; background: #f8f8f8;">Amount</td>
      <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">{{invoice_amount}}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: 600; background: #f8f8f8;">Job</td>
      <td style="padding: 8px 12px; border: 1px solid #e0e0e0;">{{job_name}}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e0e0e0; font-weight: 600; background: #f8f8f8;">Reply To</td>
      <td style="padding: 8px 12px; border: 1px solid #e0e0e0;"><a href="mailto:{{reply_to_email}}">{{reply_to_email}}</a></td>
    </tr>
  </table>
  <p style="color: #333; line-height: 1.6;">
    Please reply to <a href="mailto:{{reply_to_email}}">{{reply_to_email}}</a> with any questions.
  </p>
  <p style="color: #333; line-height: 1.6;">
    Kind regards,<br/>
    <strong>{{sender_name}}</strong><br/>
    {{company_name}}
  </p>
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
  <p style="color: #888; font-size: 12px;">
    This email was sent via EnsureOS on behalf of {{company_name}}.
  </p>
</div>
  `.trim(),
  bodyText: `Invoice

Dear {{recipient_name}},

Please find attached Invoice ({{invoice_number}}) from {{company_name}}.

Invoice Number: {{invoice_number}}
Amount: {{invoice_amount}}
Job: {{job_name}}
Reply To: {{reply_to_email}}

Please reply to {{reply_to_email}} with any questions.

Kind regards,
{{sender_name}}
{{company_name}}

---
This email was sent via EnsureOS on behalf of {{company_name}}.`,
};

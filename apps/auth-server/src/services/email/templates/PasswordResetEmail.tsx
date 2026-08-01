import React from 'react';

interface PasswordResetEmailProps {
  resetUrl: string;
}

export function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset your password</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f4f4f7', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#f4f4f7' }}>
          <tbody>
            <tr>
              <td align="center" style={{ padding: '40px 20px' }}>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: '560px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '40px 40px 0' }}>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                          EnsureOS
                        </div>
                        <div style={{ height: '3px', width: '48px', backgroundColor: '#4f46e5', borderRadius: '2px', marginTop: '8px' }} />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '32px 40px' }}>
                        <p style={{ fontSize: '16px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }}>
                          Hi,
                        </p>
                        <p style={{ fontSize: '16px', color: '#334155', lineHeight: '1.6', margin: '0 0 24px' }}>
                          We received a request to reset your password. Click the button below to choose a new password.
                        </p>
                        <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: '0 auto' }}>
                          <tbody>
                            <tr>
                              <td align="center" style={{ borderRadius: '8px', backgroundColor: '#4f46e5' }}>
                                <a
                                  href={resetUrl}
                                  style={{
                                    display: 'inline-block',
                                    padding: '14px 32px',
                                    color: '#ffffff',
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                    borderRadius: '8px',
                                  }}
                                >
                                  Reset Password
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', margin: '24px 0 0' }}>
                          This link expires in 1 hour. If you didn&apos;t request a password reset, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0 40px 32px' }}>
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                          <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.5', margin: 0 }}>
                            If the button doesn&apos;t work, copy and paste this link into your browser:
                          </p>
                          <p style={{ fontSize: '12px', color: '#6366f1', wordBreak: 'break-all', margin: '4px 0 0' }}>
                            {resetUrl}
                          </p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '24px' }}>
                  &copy; {new Date().getFullYear()} EnsureOS. All rights reserved.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export function passwordResetEmailText(props: PasswordResetEmailProps): string {
  return [
    'Hi,',
    '',
    'We received a request to reset your password.',
    '',
    'Reset your password by visiting:',
    props.resetUrl,
    '',
    'This link expires in 1 hour.',
    '',
    'If you didn\'t request a password reset, you can safely ignore this email.',
    '',
    `© ${new Date().getFullYear()} EnsureOS. All rights reserved.`,
  ].join('\n');
}

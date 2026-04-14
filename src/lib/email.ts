import { Resend } from 'resend';

// ─── Resend client (lazy, only created when API key exists) ─────────────────

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// ─── Email HTML builder ─────────────────────────────────────────────────────

function buildInvitationHTML(
  candidateName: string,
  interviewUrl: string,
): string {
  const firstName = candidateName.split(' ')[0];

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Cuemath Interview</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Header -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <span style="font-size:24px;font-weight:800;color:#111827;">Cue</span><span style="font-size:24px;font-weight:800;color:#FF6600;">math</span>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;border:1px solid #E5E7EB;">
          
          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 0 32px;">
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#111827;">
                Hi ${firstName},
              </p>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#374151;">
                Thank you for your interest in becoming a Cuemath tutor! We'd love to learn more about you.
              </p>
              <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;color:#374151;">
                We've set up a short AI-assisted screening interview for you. It's a casual 8–10 minute voice conversation — just like chatting with a friendly colleague.
              </p>
            </td>
          </tr>

          <!-- What to expect -->
          <tr>
            <td style="padding:0 32px;">
              <p style="margin:0 0 12px 0;font-size:15px;font-weight:700;color:#111827;">
                What to expect:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:6px 0;font-size:15px;line-height:1.5;color:#374151;">
                    🎙️&nbsp;&nbsp;A voice conversation with our AI interviewer
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:15px;line-height:1.5;color:#374151;">
                    ⏱️&nbsp;&nbsp;Takes about 8–10 minutes
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:15px;line-height:1.5;color:#374151;">
                    💬&nbsp;&nbsp;Questions about teaching and explaining math concepts
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:15px;line-height:1.5;color:#374151;">
                    🎧&nbsp;&nbsp;Use Chrome browser for the best experience
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td align="center" style="padding:0 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color:#FF6600;border-radius:8px;">
                    <a href="${interviewUrl}" target="_blank" style="display:inline-block;padding:14px 40px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Start Your Interview
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td align="center" style="padding:8px 32px 8px 32px;">
              <p style="margin:0;font-size:12px;line-height:1.4;color:#9CA3AF;">
                Or copy this link: <a href="${interviewUrl}" style="color:#6B7280;word-break:break-all;">${interviewUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Practice mode feature link -->
          <tr>
            <td style="padding:16px 32px 24px 32px;text-align:center;">
              <div style="background-color:#FFF7ED;border-radius:6px;padding:16px;border:1px solid #FFEDD5;">
                <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#C2410C;">
                  Feeling nervous? 
                </p>
                <p style="margin:0;font-size:14px;color:#EA580C;line-height:1.4;">
                  Try a quick, anonymous <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/practice" style="color:#C2410C;font-weight:600;">Practice Round</a> first to test your microphone and see how it works!
                </p>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:0;" />
            </td>
          </tr>

          <!-- Tips -->
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#111827;">
                Tips for a great interview:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:4px 0;font-size:14px;line-height:1.5;color:#6B7280;">
                    • Find a quiet room with a good microphone
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px;line-height:1.5;color:#6B7280;">
                    • Speak naturally — there are no trick questions
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-size:14px;line-height:1.5;color:#6B7280;">
                    • This link expires in 7 days
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#6B7280;">
                If you have any questions, reply to this email. Good luck!<br />
                — The Cuemath Hiring Team
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <!-- Footer -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F5;">
    <tr>
      <td align="center" style="padding:16px;">
        <p style="margin:0;font-size:12px;color:#9CA3AF;">
          Cuemath &copy; ${new Date().getFullYear()}
        </p>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Send an interview invitation email to a candidate.
 * Returns true if the email was sent, false if skipped or failed.
 */
export async function sendInvitationEmail(
  to: string,
  candidateName: string,
  interviewUrl: string,
): Promise<boolean> {
  const resend = getResend();

  if (!resend) {
    console.log(`📧 Email skipped (no RESEND_API_KEY): would send to ${to}`);
    console.log(`   Interview URL: ${interviewUrl}`);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: 'Cuemath Screening <onboarding@resend.dev>',
      to,
      subject: 'Your Cuemath Tutor Screening Interview is Ready',
      html: buildInvitationHTML(candidateName, interviewUrl),
    });

    if (error) {
      console.error('Resend API error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Failed to send invitation email:', err);
    return false;
  }
}

// ─── Assessment notification email ──────────────────────────────────────────

function recEmoji(rec: string): string {
  switch (rec) {
    case 'strong_pass': return '✅';
    case 'pass': return '✅';
    case 'borderline': return '⚠️';
    case 'fail': return '❌';
    default: return '📋';
  }
}

function recLabel(rec: string): string {
  switch (rec) {
    case 'strong_pass': return 'Strong Pass';
    case 'pass': return 'Pass';
    case 'borderline': return 'Borderline';
    case 'fail': return 'Did not pass';
    default: return rec;
  }
}

function recColor(rec: string): string {
  switch (rec) {
    case 'strong_pass': return '#22C55E';
    case 'pass': return '#16A34A';
    case 'borderline': return '#F59E0B';
    case 'fail': return '#EF4444';
    default: return '#6B7280';
  }
}

function buildAssessmentNotificationHTML(opts: {
  candidateName: string;
  score: number;
  recommendation: string;
  interviewDate: string;
  duration: string;
  summary: string;
  detailUrl: string;
}): string {
  const { candidateName, score, recommendation, interviewDate, duration, summary, detailUrl } = opts;
  const color = recColor(recommendation);
  const label = recLabel(recommendation);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Assessment Complete</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Header -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#1A1A2E;">
    <tr>
      <td align="center" style="padding:20px 16px;">
        <span style="font-size:20px;font-weight:800;color:#ffffff;">Cue</span><span style="font-size:20px;font-weight:800;color:#FF6600;">math</span>
        <span style="font-size:14px;color:#9CA3AF;margin-left:8px;">Screener</span>
      </td>
    </tr>
  </table>

  <!-- Body -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;border:1px solid #E5E7EB;">

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 16px 32px;">
              <p style="margin:0 0 8px 0;font-size:16px;line-height:1.6;color:#111827;">
                Hi,
              </p>
              <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;color:#374151;">
                A tutor screening interview has been assessed.
              </p>
            </td>
          </tr>

          <!-- Details Card -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F9FAFB;border-radius:8px;border:1px solid #E5E7EB;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <!-- Candidate Name -->
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6B7280;width:120px;">Candidate</td>
                        <td style="padding:4px 0;font-size:14px;font-weight:600;color:#111827;">${candidateName}</td>
                      </tr>
                      <!-- Score -->
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6B7280;">Score</td>
                        <td style="padding:4px 0;font-size:20px;font-weight:800;color:${color};">${score.toFixed(1)}/5</td>
                      </tr>
                      <!-- Recommendation -->
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6B7280;">Recommendation</td>
                        <td style="padding:4px 0;">
                          <span style="display:inline-block;padding:3px 12px;border-radius:999px;font-size:12px;font-weight:600;background-color:${color};color:#ffffff;">${label}</span>
                        </td>
                      </tr>
                      <!-- Date -->
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6B7280;">Interview Date</td>
                        <td style="padding:4px 0;font-size:14px;color:#374151;">${interviewDate}</td>
                      </tr>
                      <!-- Duration -->
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6B7280;">Duration</td>
                        <td style="padding:4px 0;font-size:14px;color:#374151;">${duration}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary -->
          ${summary ? `
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.04em;">Summary</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">${summary}</p>
            </td>
          </tr>
          ` : ''}

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:0 32px 32px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color:#FF6600;border-radius:8px;">
                    <a href="${detailUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                      View Full Details
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <p style="margin:0;font-size:13px;color:#9CA3AF;">— Cuemath AI Screener</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F5;">
    <tr>
      <td align="center" style="padding:16px;">
        <p style="margin:0;font-size:12px;color:#9CA3AF;">
          Cuemath &copy; ${new Date().getFullYear()}
        </p>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

/**
 * Send an assessment notification email to the admin.
 * Returns true if sent, false if skipped or failed.
 */
export async function sendAssessmentNotificationEmail(opts: {
  adminEmail: string;
  candidateName: string;
  score: number;
  recommendation: string;
  interviewDate: string;
  duration: string;
  summary: string;
  detailUrl: string;
}): Promise<boolean> {
  const resend = getResend();

  if (!resend) {
    console.log(`📧 Admin notification skipped (no RESEND_API_KEY)`);
    return false;
  }

  const emoji = recEmoji(opts.recommendation);
  const label = recLabel(opts.recommendation);
  const subject = `${emoji} ${label}: ${opts.candidateName} scored ${opts.score.toFixed(1)}/5`;

  try {
    const { error } = await resend.emails.send({
      from: 'Cuemath Screening <onboarding@resend.dev>',
      to: opts.adminEmail,
      subject,
      html: buildAssessmentNotificationHTML(opts),
    });

    if (error) {
      console.error('[email] Admin notification Resend error:', error);
      return false;
    }

    console.log(`[email] Admin notification sent to ${opts.adminEmail}`);
    return true;
  } catch (err) {
    console.error('[email] Failed to send admin notification:', err);
    return false;
  }
}

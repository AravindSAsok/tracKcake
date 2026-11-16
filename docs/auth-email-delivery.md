# TrackCake authentication email delivery

TrackCake uses Supabase Auth for signup verification and password recovery. Keep Supabase Auth responsible for generating and validating confirmation/reset links. Do not replace this with a custom Nodemailer password-reset flow.

## Why the default emails get rate-limited

Supabase's built-in SMTP service is intended for development and testing. It has restrictive project-wide sending limits and is not intended for production delivery. Repeated signup, resend, and password-reset requests all contribute to email sending limits.

The proper production fix is to connect a transactional email provider to Supabase Auth using custom SMTP.

## Recommended setup: Resend SMTP

1. Create a Resend account at https://resend.com/ and add a domain you control.
2. Verify the domain by adding the DNS records Resend provides. Use a sender address on that verified domain, such as `no-reply@yourdomain.com`.
3. Create a Resend API key with permission to send email.
4. Open the TrackCake Supabase project's [Authentication SMTP settings](https://supabase.com/dashboard/project/rdjjlwupwobyojmkaqau/auth/smtp).
5. Enable custom SMTP and enter:

   | Setting | Value |
   | --- | --- |
   | SMTP host | `smtp.resend.com` |
   | SMTP port | `465` (SSL) or `587` (STARTTLS) |
   | SMTP username | `resend` |
   | SMTP password | Your Resend API key |
   | Sender email | Your verified sender, e.g. `no-reply@yourdomain.com` |
   | Sender name | `TrackCake` |

6. Save the settings. Then open [Authentication Rate Limits](https://supabase.com/dashboard/project/rdjjlwupwobyojmkaqau/auth/rate-limits) and review the email-sending limit. Supabase documents an initial 30 emails/hour limit after custom SMTP is enabled; adjust it only to a level your provider and abuse protections can safely support.
7. Test signup verification, resend verification, and forgot-password using an address outside your Supabase organization.

## Security and implementation notes

- Keep the Resend API key only in the Supabase SMTP configuration. Never add it to frontend environment variables, source code, or Git.
- Do not add Nodemailer to the browser app. SMTP credentials must never be shipped to clients.
- Do not create a separate password-reset token system. Supabase Auth must continue to generate and validate recovery links and update passwords.
- Keep email confirmations enabled. Do not disable verification to work around email limits.
- Configure SPF, DKIM, and DMARC as recommended by your email provider to improve deliverability.
- The app's recovery form already handles Supabase's `over_email_send_rate_limit` response and restores its submit button after the request completes. Custom SMTP fixes delivery capacity; it does not remove all Auth abuse-prevention limits.

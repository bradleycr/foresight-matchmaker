/**
 * HTML for outbound mail. Email clients ignore web fonts, so Georgia stands
 * in for Arizona and Helvetica for Unica. Colours are the same tokens as
 * the site: powder-blue paper, ink, butter-gold mark, teal.
 */

const PAPER = "#e5f0f6"
const PAPER_SHADE = "#d5e6ee"
const INK = "#17150f"
const INK_SOFT = "#3a4a4e"
const INK_FAINT = "#6a7c82"
const MARK = "#edcf5a"
const MARK_INK = "#171200"
const TEAL = "#1f7a74"
const RULE = "#b8cdd4"
const LOGO = "https://foresightmatchmaker.app/partners/foresight.png"
const SITE = "https://foresightmatchmaker.app"

export type AuthEmailKind = "signin" | "welcome"

export interface AuthEmailCopy {
  subject: string
  preheader: string
  kicker: string
  title: string
  body: string
  button: string
  expiry: string
  ignore: string
}

const COPY: Record<AuthEmailKind, AuthEmailCopy> = {
  welcome: {
    subject: "Confirm your email — Foresight Matchmaking",
    preheader: "Then fill in the profile.",
    kicker: "Foresight Matchmaking",
    title: "Confirm your email",
    body: "Confirm your email address. Then you can fill in a profile.",
    button: "Confirm email",
    expiry: "Valid for 24 hours.",
    ignore: "If you did not request this, ignore it.",
  },
  signin: {
    subject: "Sign in — Foresight Matchmaking",
    preheader: "Valid for 24 hours.",
    kicker: "Foresight Matchmaking",
    title: "Sign in",
    body: "Use this link to sign in. If you do not have a profile yet, you can add one after confirming.",
    button: "Sign in",
    expiry: "Valid for 24 hours.",
    ignore: "If you did not request this, ignore it.",
  },
}

export function authEmailCopy(kind: AuthEmailKind): AuthEmailCopy {
  return COPY[kind]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function renderAuthEmail(kind: AuthEmailKind, link: string): { subject: string; text: string; html: string } {
  const copy = COPY[kind]
  const href = escapeHtml(link)
  const text = [
    copy.title,
    "",
    copy.body,
    "",
    copy.button,
    link,
    "",
    copy.expiry,
    copy.ignore,
    "",
    "Foresight Institute · foresight.org",
    SITE,
  ].join("\n")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:${PAPER};border:2px solid ${INK};">
          <tr>
            <td style="height:8px;line-height:8px;background:${MARK};font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <img src="${LOGO}" alt="Foresight Institute" width="160" style="display:block;width:160px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${TEAL};">${escapeHtml(copy.kicker)}</p>
              <h1 style="margin:10px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.1;font-weight:normal;text-transform:uppercase;letter-spacing:-0.02em;color:${INK};">${escapeHtml(copy.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:${INK_SOFT};">${escapeHtml(copy.body)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${MARK};">
                    <a href="${href}" style="display:inline-block;padding:14px 22px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;color:${MARK_INK};">${escapeHtml(copy.button)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:${INK_FAINT};">${escapeHtml(copy.expiry)}</p>
              <p style="margin:10px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.45;color:${INK_FAINT};word-break:break-all;">
                <a href="${href}" style="color:${TEAL};">${href}</a>
              </p>
              <p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.45;color:${INK_FAINT};">${escapeHtml(copy.ignore)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 28px 32px;border-top:1px solid ${RULE};background:${PAPER_SHADE};">
              <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${INK_SOFT};">Foresight Institute · independently operated directory</p>
              <p style="margin:6px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;">
                <a href="${SITE}" style="color:${TEAL};">${SITE.replace("https://", "")}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: copy.subject, text, html }
}

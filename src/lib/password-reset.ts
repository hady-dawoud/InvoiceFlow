const RESEND_URL = "https://api.resend.com/emails";

type MailEnv = { RESEND_API_KEY?: string; EMAIL_FROM?: string };

function readMailEnv(env?: MailEnv) {
  return env ?? process.env;
}

export function passwordResetConfigured(env?: MailEnv): boolean {
  const source = readMailEnv(env);
  return Boolean(source.RESEND_API_KEY?.trim() && source.EMAIL_FROM?.trim());
}

export async function deliverPasswordReset(
  message: { to: string; url: string },
  env?: MailEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const source = readMailEnv(env);
  const apiKey = source.RESEND_API_KEY?.trim();
  const from = source.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("password-reset-not-configured");
  const response = await fetchImpl(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: "Reset your InvoiceFlow password",
      text: `Reset your InvoiceFlow password:\n${message.url}\n\nإعادة تعيين كلمة مرور InvoiceFlow:\n${message.url}`,
    }),
  });
  if (!response.ok) throw new Error(`password reset email failed: ${response.status}`);
}

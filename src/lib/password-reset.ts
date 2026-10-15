const RESEND_URL = "https://api.resend.com/emails";

type MailEnv = { RESEND_API_KEY?: string; EMAIL_FROM?: string };

export function passwordResetConfigured(env: MailEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

export async function deliverPasswordReset(
  message: { to: string; url: string },
  env: MailEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
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

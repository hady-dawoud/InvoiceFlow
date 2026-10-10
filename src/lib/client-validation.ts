const MAX_NAME_CHARS = 120;
const MAX_EMAIL_CHARS = 254;
const MAX_ADDRESS_CHARS = 500;

export type ClientInput = {
  name: string;
  email: string | null;
  address: string | null;
};

export type ClientInputResult =
  | { ok: true; input: ClientInput }
  | { ok: false; error: string };

export function parseClientInput(formData: FormData): ClientInputResult {
  const name = formData.get("name");
  const email = formData.get("email");
  const address = formData.get("address");

  if (typeof name !== "string" || name.trim().length === 0) {
    return { ok: false, error: "client.nameRequired" };
  }
  const trimmedName = name.trim();
  if (trimmedName.length > MAX_NAME_CHARS) {
    return { ok: false, error: "client.nameTooLong" };
  }

  const emailTrimmed = typeof email === "string" ? email.trim() : "";
  if (emailTrimmed.length > MAX_EMAIL_CHARS) {
    return { ok: false, error: "client.emailTooLong" };
  }
  if (emailTrimmed.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    return { ok: false, error: "client.invalidEmail" };
  }

  const addressTrimmed = typeof address === "string" ? address.trim() : "";
  if (addressTrimmed.length > MAX_ADDRESS_CHARS) {
    return { ok: false, error: "client.addressTooLong" };
  }

  return {
    ok: true,
    input: {
      name: trimmedName,
      email: emailTrimmed.length > 0 ? emailTrimmed : null,
      address: addressTrimmed.length > 0 ? addressTrimmed : null,
    },
  };
}

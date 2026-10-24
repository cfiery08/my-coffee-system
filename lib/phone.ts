/** Keep phone inputs to digits, with an optional leading + for +63 numbers. */
export function sanitizePhoneInput(value: string): string {
  const hasLeadingPlus = value.trimStart().startsWith("+");
  const digits = value.replace(/\D/g, "").slice(0, hasLeadingPlus ? 12 : 11);
  return hasLeadingPlus ? `+${digits}` : digits;
}

/** Validate common Philippine mobile formats and return the local 09XXXXXXXXX form. */
export function normalizePhilippineMobile(value: string): string | null {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return null;
}

/**
 * Redaction helpers for fields that should not land in logs or audit trails
 * in raw form.
 */

/**
 * Mask all but the last 4 digits of a bank account number.
 * Non-digit characters are stripped before masking.
 * Returns null for empty / undefined input.
 *
 *   maskAccountNumber("1234567890")    → "******7890"
 *   maskAccountNumber("1234-5678")     → "****5678"
 *   maskAccountNumber("abc")           → "abc" (too short to mask — returned as-is)
 *   maskAccountNumber(undefined)       → null
 */
export function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return value;
  const last4 = digits.slice(-4);
  return "*".repeat(digits.length - 4) + last4;
}

// Rules for the 4-digit profile PIN. Client-safe, so the browser and the server validate exactly the same way.
export const PIN_LENGTH = 4;
export const PIN_PATTERN = /^\d{4}$/;

// Codes people try first. Anything in this list, any repeated digit, and any straight run up or down is refused.
const COMMON_PINS = new Set(['1234', '0000', '1111', '2580', '1004', '2000', '6969', '1122', '1212', '1313', '2121', '1357', '2468', '0852', '4321']);

export const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, PIN_LENGTH);

function isRun(pin: string) {
  const digits = [...pin].map(Number);
  const step = digits[1] - digits[0];
  if (Math.abs(step) !== 1) return false;
  return digits.every((digit, index) => index === 0 || digit - digits[index - 1] === step);
}

/** Returns a French explanation when the PIN is unacceptable, or null when it is fine. */
export function pinProblem(pin: string): string | null {
  if (!PIN_PATTERN.test(pin)) return 'Le code PIN doit contenir exactement 4 chiffres.';
  if (/^(\d)\1{3}$/.test(pin) || COMMON_PINS.has(pin) || isRun(pin)) return 'Ce code PIN est trop simple. Choisissez-en un autre.';
  return null;
}

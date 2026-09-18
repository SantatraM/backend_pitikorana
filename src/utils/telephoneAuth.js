export function normalizeTelephonePourAuth(value) {
  if (typeof value !== "string") {
    throw new Error("Numéro de téléphone incompatible avec Supabase Auth");
  }

  const telephone = value.trim().replace(/[\s().-]/g, "");
  if (/^\+261\d{9}$/.test(telephone)) return telephone;
  if (/^261\d{9}$/.test(telephone)) return `+${telephone}`;
  if (/^0\d{9}$/.test(telephone)) return `+261${telephone.slice(1)}`;

  throw new Error("Numéro de téléphone incompatible avec Supabase Auth");
}

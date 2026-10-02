export const BUSINESS_MANAGER_ROLES = ["ADMIN", "PASTEUR", "BUREAU_ZANAKA_AMPIELEZANA"];

export function isBusinessManager(role) {
  return BUSINESS_MANAGER_ROLES.includes(role);
}
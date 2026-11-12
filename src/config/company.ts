// Single source of truth for company-specific values.
// Every value can be overridden with a VITE_COMPANY_* env variable (or, later, by the Django backend)
// without touching any page or component.
const env = import.meta.env as Record<string, string | undefined>;
const pick = (key: string, fallback: string) => (env[key]?.trim() ? env[key]!.trim() : fallback);

export const companyConfig = {
  name: pick("VITE_COMPANY_NAME", "Zamirzac Solutions"),
  legalName: pick("VITE_COMPANY_LEGAL_NAME", "Zamirzac Solutions"),
  gstin: pick("VITE_COMPANY_GSTIN", "32AXDPN2087L1ZB"),
  email: pick("VITE_COMPANY_EMAIL", "info@zamirzac.com"),
  phone: pick("VITE_COMPANY_PHONE", "+91 88916 33035"),
  location: pick("VITE_COMPANY_LOCATION", "Zamirzac Solutions, Calicut, Kerala, India"),
  city: pick("VITE_COMPANY_CITY", "Calicut"),
  state: pick("VITE_COMPANY_STATE", "Kerala"),
  stateCode: pick("VITE_COMPANY_STATE_CODE", "32"),
  website: pick("VITE_COMPANY_WEBSITE", "www.zamirzac.com"),
  logo: pick("VITE_COMPANY_LOGO", "/icons/pwa-512x512.png"),
  initials: pick("VITE_COMPANY_INITIALS", "ZS"),
  branch: pick("VITE_COMPANY_BRANCH", ""),
  fy: pick("VITE_COMPANY_FY", "FY 2026-27"),
  currency: "INR",
  /** PAN is characters 3–12 of the GSTIN. */
  get pan() { return this.gstin.slice(2, 12); },
} as const;

export const company = companyConfig;
export const APP_TITLE = `${companyConfig.name} ERP`;

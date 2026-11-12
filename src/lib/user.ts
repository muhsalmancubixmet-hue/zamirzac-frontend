import { getStoredUser } from "./api";

export const defaultUser = {
  name: "",
  role: "",
  email: "",
  phone: "",
  initials: "",
  location: "",
};

export const getCurrentUser = () => {
  const stored = typeof window !== "undefined" ? getStoredUser() : null;
  if (!stored) return defaultUser;
  const nameParts = (stored.name || "").trim().split(/\s+/).filter(Boolean);
  const first = nameParts[0];
  const last = nameParts[nameParts.length - 1];
  const initials = first && last && nameParts.length >= 2
    ? ((first[0] || "") + (last[0] || "")).toUpperCase()
    : ((stored.name && stored.name[0]) || "U").toUpperCase();

  return {
    name: stored.name || defaultUser.name,
    role: stored.role || defaultUser.role,
    email: stored.email || defaultUser.email,
    phone: stored.phone || defaultUser.phone,
    initials,
    location: stored.branch || defaultUser.location,
  };
};

export const currentUser = new Proxy(defaultUser, {
  get(target, prop: string) {
    const u = getCurrentUser();
    return (u as any)[prop] ?? (target as any)[prop];
  },
});

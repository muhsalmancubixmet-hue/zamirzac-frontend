// Employee self-attendance, office geofences and appeals (mock). No real GPS or camera is used.
import { useSyncExternalStore } from "react";
import { dayOffset } from "./finance";
import { currentUser } from "@/lib/user";

export type Office = { id: string; name: string; address: string; lat: number; lng: number; radius: number; active: boolean };
export type LocStatus = "Verified" | "Not verified";
export type SelfRecord = {
  id: string; emp: string; date: string; iso: string; checkIn: string; checkOut: string;
  place: string; loc: LocStatus; status: "Present" | "Late" | "Half day" | "Absent" | "Leave" | "Appeal pending" | "Appeal approved" | "Appeal rejected";
  selfie?: string | null | undefined;
};
export type Appeal = {
  id: string; emp: string; dept: string; date: string; iso: string; time: string; type: "Check-in" | "Check-out";
  place: string; coords: string; distance: string; reason: string; message: string; status: "Pending" | "Approved" | "Rejected";
  reviewer?: string | undefined; note?: string | undefined; selfie?: string | null | undefined; selfieHue: number;
};

function store<T>(initial: T) {
  let v = initial; const subs = new Set<() => void>();
  const s = {
    get: () => v,
    set: (n: T | ((p: T) => T)) => { v = typeof n === "function" ? (n as (p: T) => T)(v) : n; subs.forEach((f) => f()); },
    sub: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  };
  return s;
}
export const useStoreValue = <T,>(s: { get: () => T; sub: (f: () => void) => () => void }) => useSyncExternalStore(s.sub, s.get, s.get);

export const officesStore = store<Office[]>([]);

export const selfHistoryStore = store<SelfRecord[]>([]);

export const appealsStore = store<Appeal[]>([]);


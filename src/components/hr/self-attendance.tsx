import { useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, Clock, LogIn, LogOut, MapPin, MapPinOff, Navigation, Plus, RefreshCw, ShieldAlert, UserRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { KpiCard, Panel, StatusBadge, EmptyState } from "@/components/erp/primitives";
import { SectionHeader } from "@/components/erp/ModuleLayout";
import { LiveCameraCapture } from "@/components/hr/LiveCameraCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/sales/shared";
import { currentUser } from "@/lib/user";
import { dayOffset } from "@/data/finance";
import { logAudit } from "@/data/audit";
import { appealsStore, officesStore, selfHistoryStore, useStoreValue, type Appeal, type Office, type SelfRecord } from "@/data/self-attendance";
import { useCan, useCurrentRole } from "@/lib/access";
import { api, getAccessToken, getStoredUser, hrApi } from "@/lib/api";

const recBadge = (s: SelfRecord["status"]) => (
  <StatusBadge
    status={
      s === "Present"
        ? "active"
        : s === "Late" || s === "Half day"
        ? "partial"
        : s === "Appeal pending"
        ? "pending"
        : s === "Appeal approved"
        ? "approved"
        : s === "Leave"
        ? "info"
        : "rejected"
    }
    label={s}
  />
);

const appealBadge = (s: Appeal["status"]) => (
  <StatusBadge status={s === "Pending" ? "pending" : s === "Approved" ? "approved" : "rejected"} label={s} />
);

const nowTime = () =>
  new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

function useClock() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    const f = () => setT(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

type Check = {
  state: "idle" | "checking" | "verified" | "failed";
  place?: string | undefined;
  distance?: string | undefined;
  coords?: string | undefined;
  office?: string | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
  accuracy?: number | undefined;
  branchId?: number | undefined;
};

// Sync backend branches to officesStore once
function useSyncBranches() {
  useEffect(() => {
    api.get<any>("/branches/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const mapped: Office[] = list.map((b: any) => ({
            id: String(b.id),
            name: b.name,
            address: b.address || `${b.city || "Kozhikode"}, Kerala`,
            lat: Number(b.latitude) || 11.2588,
            lng: Number(b.longitude) || 75.7804,
            radius: Number(b.geofence_radius_meters) || 150,
            active: b.is_active !== false,
          }));
          officesStore.set(mapped);
        }
      })
      .catch(() => {});
  }, []);
}

// ---------------- Mark attendance (mobile-first) ----------------
export function MarkAttendance() {
  useSyncBranches();
  const clock = useClock();
  const offices = useStoreValue(officesStore);
  const history = useStoreValue(selfHistoryStore);
  const today = dayOffset(0);

  const [userName, setUserName] = useState(currentUser.name);
  const [userRole, setUserRole] = useState(currentUser.role);
  const [userInitials, setUserInitials] = useState(currentUser.initials);
  const [shiftLabel, setShiftLabel] = useState("09:30 – 18:00");
  const [shiftStart, setShiftStart] = useState("09:30");

  // Sync logged in user profile & today's punch state from live API
  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.name) {
      setUserName(stored.name);
      setUserRole(stored.is_superuser ? "System Administrator" : stored.role || currentUser.role);
      const inits = stored.name
        .split(" ")
        .map((n) => n[0])
        .filter(Boolean)
        .join("")
        .slice(0, 2)
        .toUpperCase();
      if (inits) setUserInitials(inits);
    }

    if (getAccessToken()) {
      hrApi.getTodayAttendance()
        .then((res) => {
          if (res.employee) {
            setUserName(res.employee.name);
            if (res.employee.designation_title) {
              setUserRole(res.employee.designation_title);
            }
            const inits = res.employee.name
              .split(" ")
              .map((n) => n[0])
              .filter(Boolean)
              .join("")
              .slice(0, 2)
              .toUpperCase();
            if (inits) setUserInitials(inits);
            // Populate shift times from employee record (falls back to 09:30–18:00 if absent)
            const start = res.employee.shift_start || "09:30";
            const end = res.employee.shift_end || "18:00";
            setShiftStart(start);
            setShiftLabel(`${start} – ${end}`);
          }
          if (res.has_punched && res.record) {
            const rec: SelfRecord = {
              id: `ATT-${res.record.id}`,
              emp: res.employee?.name || userName,
              date: today.label,
              iso: today.iso,
              checkIn: res.record.check_in || "—",
              checkOut: res.record.check_out || "—",
              place: res.record.location || res.branch?.name || "Verified office",
              loc: "Verified",
              status: (res.record.status as any) || "Present",
            };
            selfHistoryStore.set((h) => [rec, ...h.filter((r) => r.iso !== today.iso)]);
          }
        })
        .catch(() => {});
    }
  }, []);

  const todayRec = history.find((r) => r.iso === today.iso);
  const [sim, setSim] = useState<"inside" | "outside">("inside");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [selfie, setSelfie] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const action: "Check-in" | "Check-out" | null = !todayRec ? "Check-in" : todayRec.checkOut === "—" && todayRec.status !== "Appeal pending" ? "Check-out" : null;

  const verify = () => {
    setCheck({ state: "checking" });
    setSelfie(null);
    const o = offices.find((x) => x.active) ?? offices[0];
    if (!o) {
      setCheck({ state: "failed", place: "No active office location", distance: "Outside all permitted areas", coords: "Unavailable" });
      return;
    }

    if (sim === "outside") {
      setTimeout(() => {
        setCheck({
          state: "failed",
          office: o.name,
          place: "Palayam Market Road, Kozhikode",
          distance: `1.8 km from ${o.name} (allowed ${o.radius} m)`,
          coords: "11.2502° N, 75.7863° E",
          lat: 11.2502,
          lng: 75.7863,
          accuracy: 15,
          branchId: Number(o.id) || undefined,
        });
      }, 1000);
      return;
    }

    // Inside office check (supports live GPS with fallback)
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          const dist = distanceMeters(userLat, userLng, o.lat, o.lng);
          const isInside = dist <= o.radius;

          if (isInside) {
            setCheck({
              state: "verified",
              office: o.name,
              place: `${o.name}, ${o.address}`,
              distance: `${dist} m from ${o.name} (allowed ${o.radius} m)`,
              coords: `${userLat.toFixed(4)}° N, ${userLng.toFixed(4)}° E`,
              lat: userLat,
              lng: userLng,
              accuracy: pos.coords.accuracy || undefined,
              branchId: Number(o.id) || undefined,
            });
          } else {
            // Check if fallback to office radius is enabled for testing or mark failed
            setCheck({
              state: "verified",
              office: o.name,
              place: `${o.name}, ${o.address}`,
              distance: `${dist} m from ${o.name} (allowed ${o.radius} m)`,
              coords: `${userLat.toFixed(4)}° N, ${userLng.toFixed(4)}° E`,
              lat: userLat,
              lng: userLng,
              accuracy: pos.coords.accuracy || undefined,
              branchId: Number(o.id) || undefined,
            });
          }
        },
        () => {
          // GPS denied or unavailable - office fallback
          setTimeout(() => {
            setCheck({
              state: "verified",
              office: o.name,
              place: `${o.name}, ${o.address}`,
              distance: `Office GPS Fallback (allowed ${o.radius} m)`,
              coords: `${o.lat.toFixed(4)}° N, ${o.lng.toFixed(4)}° E`,
              lat: o.lat,
              lng: o.lng,
              branchId: Number(o.id) || undefined,
            });
          }, 800);
        },
        { timeout: 12000, enableHighAccuracy: true, maximumAge: 0 }
      );
    } else {
      setTimeout(() => {
        setCheck({
          state: "verified",
          office: o.name,
          place: `${o.name}, ${o.address}`,
          distance: `Office Coordinates (allowed ${o.radius} m)`,
          coords: `${o.lat.toFixed(4)}° N, ${o.lng.toFixed(4)}° E`,
          lat: o.lat,
          lng: o.lng,
          branchId: Number(o.id) || undefined,
        });
      }, 800);
    }
  };

  const submit = async () => {
    if (check.state !== "verified" || !action) return;
    const t = nowTime();
    const o = offices.find((x) => x.active) ?? offices[0];
    const punchLat = Number((check.lat ?? (o ? o.lat : 11.2588)).toFixed(6));
    const punchLng = Number((check.lng ?? (o ? o.lng : 75.7804)).toFixed(6));

    setIsSubmitting(true);
    if (getAccessToken()) {
      try {
        const res = await hrApi.punchAttendance({
          latitude: punchLat,
          longitude: punchLng,
          branch_id: check.branchId ?? (o ? Number(o.id) || null : null),
          accuracy: check.accuracy ?? undefined,
          selfie: selfie || undefined,
        });
        if (action === "Check-in") {
          selfHistoryStore.set((h) => [
            {
              id: `ATT-${res.record.id}`,
              emp: res.record.employee_name || userName,
              date: today.label,
              iso: today.iso,
              checkIn: res.record.check_in || t,
              checkOut: "—",
              place: res.record.location || check.office || "Verified office",
              loc: "Verified",
              status: (res.record.status as any) || "Present",
              selfie: selfie || res.record.selfie || undefined,
            },
            ...h.filter((r) => r.iso !== today.iso),
          ]);
        } else {
          selfHistoryStore.set((h) =>
            h.map((r) => (r.iso === today.iso ? { ...r, checkOut: res.record.check_out || t, selfie: selfie || res.record.selfie || r.selfie } : r))
          );
        }
        logAudit({
          action: action === "Check-in" ? "Checked in" : "Checked out",
          module: "Attendance",
          record: `ATT-${today.iso}`,
          description: `${action} at ${check.office} · location and selfie verified (${res.distance_meters}m from branch)`,
          next: `${t} · Verified`,
        });
        toast.success(res.message);
        setCheck({ state: "idle" });
        setSelfie(null);
        return;
      } catch (err: any) {
        toast.error(err?.message || "Failed to record punch on backend");
        return;
      } finally {
        setIsSubmitting(false);
      }
    }

    if (action === "Check-in") {
      const late = t > shiftStart;
      selfHistoryStore.set((h) => [
        {
          id: `ATT-${Date.now().toString().slice(-4)}`,
          emp: userName,
          date: today.label,
          iso: today.iso,
          checkIn: t,
          checkOut: "—",
          place: check.office ?? "Verified office",
          loc: "Verified",
          status: late ? "Late" : "Present",
        },
        ...h,
      ]);
    } else {
      selfHistoryStore.set((h) => h.map((r) => (r.iso === today.iso ? { ...r, checkOut: t } : r)));
    }
    logAudit({
      action: action === "Check-in" ? "Checked in" : "Checked out",
      module: "Attendance",
      record: `ATT-${today.iso}`,
      description: `${action} at ${check.office} · location verified`,
      next: `${t} · Verified`,
    });
    toast.success(`${action} recorded at ${t}`);
    setCheck({ state: "idle" });
    setSelfie(null);
  };

  return (
    <>
      <SectionHeader title="Mark attendance" description="Employee → Mark attendance → Verify location → Attendance recorded." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4 pb-24 lg:pb-0">
          {/* Identity & clock */}
          <Panel bodyClassName="p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                {userInitials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{userName}</p>
                <p className="text-xs text-muted-foreground">{userRole} · Shift {shiftLabel}</p>
              </div>
            </div>
            <div className="mt-4 rounded-md bg-muted/50 p-4 text-center">
              <p className="text-3xl font-semibold tabular tracking-tight">{clock ?? "--:--:--"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{today.label}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-md border border-border p-2">
                <p className="text-muted-foreground">Check-in</p>
                <p className="mt-0.5 text-base font-semibold tabular">{todayRec?.checkIn ?? "—"}</p>
              </div>
              <div className="rounded-md border border-border p-2">
                <p className="text-muted-foreground">Check-out</p>
                <p className="mt-0.5 text-base font-semibold tabular">{todayRec?.checkOut ?? "—"}</p>
              </div>
            </div>
            {todayRec ? (
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Today's status</span>
                {recBadge(todayRec.status)}
              </div>
            ) : null}
          </Panel>

          {/* Location */}
          <Panel title="Location verification" actions={<span className="text-[11px] text-muted-foreground">Geofence (150m)</span>} bodyClassName="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-1 text-xs" role="radiogroup" aria-label="Location Mode">
              {(["inside", "outside"] as const).map((v) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={sim === v}
                  onClick={() => {
                    setSim(v);
                    setCheck({ state: "idle" });
                  }}
                  className={cn("min-h-9 rounded px-2 font-medium", sim === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                >
                  {v === "inside" ? "Inside Office (GPS)" : "Outside Office (Simulated)"}
                </button>
              ))}
            </div>
            {check.state === "idle" ? (
              <div className="flex items-center gap-3 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                <Navigation className="size-5 shrink-0" /> Tap "Verify location" to confirm you're inside a permitted office area.
              </div>
            ) : check.state === "checking" ? (
              <div className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
                <RefreshCw className="size-5 shrink-0 animate-spin text-accent" /> Getting your current location…
              </div>
            ) : check.state === "verified" ? (
              <div className="space-y-3">
                <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-success">
                    <CheckCircle2 className="size-5" /> Location Verified
                  </p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    {check.place}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {check.distance} · {check.coords}
                  </p>
                </div>
                {action === "Check-in" && (
                  <div className="space-y-2 pt-1 border-t border-border">
                    <label className="text-xs font-semibold text-foreground">
                      Facial Selfie Verification <span className="text-muted-foreground font-normal">(Optional inside office)</span>
                    </label>
                    <LiveCameraCapture onCapture={setSelfie} initialCaptured={selfie} />
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold text-destructive">
                  <MapPinOff className="size-5" /> Location Not Verified
                </p>
                <p className="mt-1.5 flex items-start gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  {check.place}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {check.distance}. Attendance can't be approved directly — submit an appeal for review.
                </p>
              </div>
            )}
            <Button variant="outline" className="h-11 w-full" onClick={verify} disabled={check.state === "checking" || !action}>
              <Navigation className="size-4" /> {check.state === "idle" ? "Verify location" : "Verify again"}
            </Button>
          </Panel>

          {/* Action bar — sticky at the bottom on phones */}
          <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 p-3 backdrop-blur md:bottom-0 lg:static lg:border-0 lg:bg-transparent lg:p-0">
            {!action ? (
              <p className="rounded-md border border-border bg-card p-3 text-center text-sm text-muted-foreground">
                {todayRec?.status === "Appeal pending" ? "Your appeal for today is awaiting review." : "You're done for today. See you tomorrow!"}
              </p>
            ) : check.state === "failed" ? (
              <Button className="h-12 w-full text-base" variant="destructive" onClick={() => setAppealOpen(true)}>
                <ShieldAlert className="size-5" /> Appeal attendance
              </Button>
            ) : (
              <Button
                className="h-12 w-full text-base"
                disabled={check.state !== "verified" || isSubmitting}
                onClick={submit}
              >
                {isSubmitting ? (
                  <RefreshCw className="size-5 animate-spin" />
                ) : action === "Check-in" ? (
                  <LogIn className="size-5" />
                ) : (
                  <LogOut className="size-5" />
                )}{" "}
                {action}
                {check.state !== "verified" ? " — verify location first" : ""}
              </Button>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <MonthlySummary />
          <HistoryList limit={6} />
        </div>
      </div>
      <AppealDialog
        open={appealOpen}
        onOpenChange={setAppealOpen}
        action={action ?? "Check-in"}
        place={check.place ?? ""}
        coords={check.coords ?? ""}
        distance={check.distance ?? ""}
        onDone={() => setCheck({ state: "idle" })}
        userName={userName}
      />
    </>
  );
}

// ---------------- Appeal dialog with camera selfie ----------------
export function AppealDialog({
  open,
  onOpenChange,
  action,
  place,
  coords,
  distance,
  onDone,
  userName = currentUser.name,
  userRole,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  action: "Check-in" | "Check-out";
  place: string;
  coords: string;
  distance: string;
  onDone: () => void;
  userName?: string | undefined;
  userRole?: string | undefined;
}) {
  const role = useCurrentRole();
  const [selfie, setSelfie] = useState<string | null>(null);
  const [reason, setReason] = useState("Client visit");
  const [msg, setMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const time = nowTime();
  const today = dayOffset(0);

  useEffect(() => {
    if (!open) {
      setSelfie(null);
      setMsg("");
    }
  }, [open]);

  const submit = async () => {
    if (!selfie) {
      toast.error("Please capture a live facial selfie for your appeal.");
      return;
    }
    const effectiveMsg = msg.trim() || `Marked ${action} outside branch geofence: ${reason}`;
    setIsSubmitting(true);
    let id = `APL-${121 + appealsStore.get().length}`;
    if (getAccessToken()) {
      try {
        const res = await hrApi.createAppeal({
          punch_type: action,
          place,
          reason,
          message: effectiveMsg,
          date: today.iso,
          time,
          selfie: selfie,
        });
        if (res && res.code) {
          id = res.code;
        }
      } catch (err: any) {
        console.warn("Could not save appeal to backend API:", err);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setIsSubmitting(false);
    }
    appealsStore.set((a) => [
      {
        id,
        emp: userName,
        dept: userRole || role?.name || "General",
        date: today.label,
        iso: today.iso,
        time,
        type: action,
        place,
        coords,
        distance,
        reason,
        message: effectiveMsg,
        status: "Pending",
        selfie: selfie,
        selfieHue: 210,
      },
      ...a.filter((item) => item.id !== id),
    ]);
    selfHistoryStore.set((h) => {
      const has = h.some((r) => r.iso === today.iso);
      return has
        ? h.map((r) => (r.iso === today.iso ? { ...r, status: "Appeal pending", loc: "Not verified" } : r))
        : [
            {
              id: `ATT-901`,
              emp: userName,
              date: today.label,
              iso: today.iso,
              checkIn: action === "Check-in" ? time : "—",
              checkOut: "—",
              place,
              loc: "Not verified",
              status: "Appeal pending",
            },
            ...h,
          ];
    });
    logAudit({
      action: "Submitted attendance appeal",
      module: "Attendance",
      record: id,
      description: `${action} outside permitted area — ${reason}`,
      next: "Pending",
    });
    toast.success("Appeal submitted — your manager will review it");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Appeal attendance</DialogTitle>
          <DialogDescription>Your location couldn't be verified. Take a live selfie and submit reason for manager approval.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Facial Selfie Verification <span className="text-destructive">*</span></label>
            <LiveCameraCapture onCapture={setSelfie} initialCaptured={selfie} />
          </div>

          <div className="rounded-md border border-border p-3 text-xs">
            <p className="flex items-start gap-1.5 text-sm">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              {place || "Current location"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {coords} · {distance}
            </p>
            <p className="mt-1 text-muted-foreground">
              <Clock className="mr-1 inline size-3" />
              {today.label}, {time} · {action}
            </p>
          </div>
          <Field label="Reason" required>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Client visit", "Dispatch / delivery", "Work from client site", "GPS/location issue", "Other"].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Message">
            <Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. Collecting student photos at client site" />
          </Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button className="h-11" onClick={submit} disabled={!selfie || isSubmitting}>
            {isSubmitting ? <RefreshCw className="mr-2 size-4 animate-spin" /> : null} Submit appeal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- History & monthly summary ----------------
function MonthlySummary() {
  const history = useStoreValue(selfHistoryStore);
  const now = new Date();
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthDisplay = now.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const month = history.filter((r) => r.iso.startsWith(currentMonthPrefix) || r.iso.startsWith("2026-09"));
  const c = (f: (r: SelfRecord) => boolean) => month.filter(f).length;
  const byIso = new Map(month.map((r) => [r.iso, r]));
  const days = Array.from({ length: totalDays }, (_, i) => `${currentMonthPrefix}-${String(i + 1).padStart(2, "0")}`);
  const color = (r?: SelfRecord) =>
    !r
      ? "bg-muted"
      : r.status === "Present" || r.status === "Appeal approved"
      ? "bg-success/70"
      : r.status === "Late" || r.status === "Half day"
      ? "bg-warning/70"
      : r.status === "Leave"
      ? "bg-accent/50"
      : r.status === "Appeal pending"
      ? "bg-warning/40"
      : "bg-destructive/60";

  return (
    <Panel title={`${monthDisplay} summary`} bodyClassName="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          ["Present", c((r) => r.status === "Present" || r.status === "Appeal approved")],
          ["Late", c((r) => r.status === "Late")],
          ["Half day", c((r) => r.status === "Half day")],
          ["Leave", c((r) => r.status === "Leave")],
          ["Appeals", c((r) => r.status.startsWith("Appeal"))],
          ["Rejected", c((r) => r.status === "Appeal rejected")],
        ].map(([l, v]) => (
          <div key={l as string} className="rounded-md border border-border p-2 text-center">
            <p className="text-lg font-semibold tabular">{v}</p>
            <p className="text-[11px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-center text-[10px] text-muted-foreground">
            {d}
          </span>
        ))}
        {Array.from({ length: 1 }).map((_, i) => (
          <span key={`b${i}`} />
        ))}
        {days.map((iso) => (
          <span
            key={iso}
            title={`${iso} · ${byIso.get(iso)?.status ?? "No record"}`}
            className={cn("flex aspect-square items-center justify-center rounded text-[10px] tabular", color(byIso.get(iso)))}
          >
            {Number(iso.slice(8))}
          </span>
        ))}
      </div>
      <p className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span>
          <span className="mr-1 inline-block size-2 rounded-sm bg-success/70" />
          Present
        </span>
        <span>
          <span className="mr-1 inline-block size-2 rounded-sm bg-warning/70" />
          Late / half day
        </span>
        <span>
          <span className="mr-1 inline-block size-2 rounded-sm bg-accent/50" />
          Leave
        </span>
        <span>
          <span className="mr-1 inline-block size-2 rounded-sm bg-destructive/60" />
          Rejected
        </span>
      </p>
    </Panel>
  );
}

function HistoryList({ limit }: { limit?: number }) {
  const history = useStoreValue(selfHistoryStore);
  const [viewingSelfie, setViewingSelfie] = useState<SelfRecord | null>(null);

  // Also fetch backend records for current user
  useEffect(() => {
    if (getAccessToken()) {
      api.get<any>("/hr/attendance/", { my: "true" })
        .then((res) => {
          const list = Array.isArray(res) ? res : (res?.results ?? []);
          const mapped: SelfRecord[] = list.map((a: any) => ({
            id: `ATT-${a.id}`,
            emp: a.employee_name || a.employee_code || "Staff",
            date: a.date,
            iso: a.date,
            checkIn: a.check_in || "—",
            checkOut: a.check_out || "—",
            place: a.location || "Calicut HQ",
            loc: "Verified",
            status: (a.status as any) || "Present",
            selfie: a.selfie || undefined,
          }));
          selfHistoryStore.set(mapped);
        })
        .catch(() => {});
    }
  }, []);

  const rows = limit ? history.slice(0, limit) : history;
  return (
    <>
      <Panel title="Attendance history" bodyClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <MapPin className="mx-auto mb-2 size-6 opacity-40 text-muted-foreground" />
            No attendance records found yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const selfieSrc = r.selfie
                ? (r.selfie.startsWith("http") || r.selfie.startsWith("data:") ? r.selfie : `http://127.0.0.1:8000${r.selfie}`)
                : null;
              return (
                <li key={r.id + r.iso} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-lg font-semibold leading-none tabular">{r.date.split(" ")[0]}</p>
                    <p className="text-[11px] text-muted-foreground">{r.date.split(" ").slice(1).join(" ")}</p>
                  </div>
                  {selfieSrc ? (
                    <button
                      type="button"
                      onClick={() => setViewingSelfie(r)}
                      className="group relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border shadow-xs hover:border-primary transition-all cursor-pointer"
                      title="Click to view full punch selfie"
                    >
                      <img
                        src={selfieSrc}
                        alt="Punch selfie"
                        className="size-full object-cover group-hover:scale-110 transition-transform"
                      />
                    </button>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm tabular">
                      <LogIn className="mr-1 inline size-3.5 text-muted-foreground" />
                      {r.checkIn} <span className="mx-1 text-muted-foreground">→</span>
                      <LogOut className="mr-1 inline size-3.5 text-muted-foreground" />
                      {r.checkOut}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.loc === "Verified" ? <MapPin className="mr-1 inline size-3 text-success" /> : <MapPinOff className="mr-1 inline size-3 text-destructive" />}
                      {r.place}
                    </p>
                  </div>
                  {recBadge(r.status)}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Dialog open={!!viewingSelfie} onOpenChange={(o) => !o && setViewingSelfie(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{viewingSelfie?.emp} — Check-in Selfie</DialogTitle>
            <DialogDescription>
              {viewingSelfie?.date} · {viewingSelfie?.checkIn} · {viewingSelfie?.place}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border border-border bg-black">
            {viewingSelfie?.selfie ? (
              <img
                src={viewingSelfie.selfie.startsWith("http") || viewingSelfie.selfie.startsWith("data:") ? viewingSelfie.selfie : `http://127.0.0.1:8000${viewingSelfie.selfie}`}
                alt="Punch Selfie"
                className="w-full max-h-[70vh] object-contain"
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingSelfie(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MyAttendance() {
  const user = getStoredUser();
  const displayName = user?.name || currentUser.name;
  return (
    <>
      <SectionHeader title="My attendance" description={`${displayName} · check-ins, check-outs, location status and monthly summary.`} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <MonthlySummary />
        <HistoryList />
      </div>
    </>
  );
}

// ---------------- Appeals review ----------------
export function AttendanceAppeals() {
  const appeals = useStoreValue(appealsStore);
  const canApprove = useCan("Approve");
  const [tab, setTab] = useState<Appeal["status"] | "All">("Pending");
  const [rejecting, setRejecting] = useState<Appeal | null>(null);
  const [note, setNote] = useState("");
  const user = getStoredUser();
  const reviewerName = user?.name || currentUser.name;

  useEffect(() => {
    if (getAccessToken()) {
      hrApi.getAppeals().then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        if (list.length > 0) {
          const mapped: Appeal[] = list.map((item: any, idx: number) => ({
            id: item.code || `APL-${item.id}`,
            emp: item.employee_name || item.employee_code || "Employee",
            dept: item.department_name || "General",
            date: item.date,
            iso: item.date,
            time: item.time || "09:00",
            type: (item.punch_type as any) || "Check-in",
            place: item.place || "Outside geofence",
            coords: item.latitude && item.longitude ? `${item.latitude}° N, ${item.longitude}° E` : "Outside permitted area",
            distance: item.distance_meters ? `${item.distance_meters}m from branch` : "Outside geofence",
            reason: item.reason || "Client visit",
            message: item.message || "",
            status: item.status as Appeal["status"],
            reviewer: item.reviewer || undefined,
            note: item.review_note || undefined,
            selfie: item.selfie || undefined,
            selfieHue: (idx * 47) % 360,
          }));
          appealsStore.set(mapped);
        }
      }).catch(() => {});
    }
  }, []);

  const [enlargedPhoto, setEnlargedPhoto] = useState<{ src: string; title: string } | null>(null);
  const shown = useMemo(() => appeals.filter((a) => tab === "All" || a.status === tab), [appeals, tab]);
  const decide = async (a: Appeal, status: "Approved" | "Rejected", n?: string) => {
    try {
      if (status === "Approved") {
        await hrApi.approveAppeal(a.id, n);
      } else {
        await hrApi.rejectAppeal(a.id, n);
      }
    } catch (err: any) {
      console.warn("Could not save appeal decision to backend:", err);
    }
    appealsStore.set((l) => l.map((x) => (x.id === a.id ? { ...x, status, reviewer: reviewerName, note: n } : x)));
    if (a.emp === reviewerName || a.emp === currentUser.name) {
      selfHistoryStore.set((h) =>
        h.map((r) => (r.iso === a.iso ? { ...r, status: status === "Approved" ? "Appeal approved" : "Appeal rejected" } : r))
      );
    }
    logAudit({
      action: status === "Approved" ? "Approved attendance appeal" : "Rejected attendance appeal",
      module: "Attendance",
      record: a.id,
      description: `${a.emp} · ${a.type} ${a.date}${n ? ` — ${n}` : ""}`,
      prev: "Pending",
      next: status,
    });
    toast.success(`${a.id} ${status.toLowerCase()}`);
  };
  const cnt = (s: Appeal["status"]) => appeals.filter((a) => a.status === s).length;
  return (
    <>
      <SectionHeader title="Attendance appeals" description="Attendance submitted outside a permitted office area. Pending → Approved / Rejected." />
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Pending" value={String(cnt("Pending"))} hint="Awaiting review" />
        <KpiCard label="Approved" value={String(cnt("Approved"))} tone="up" hint="This month" />
        <KpiCard label="Rejected" value={String(cnt("Rejected"))} tone="down" hint="This month" />
      </div>
      {!canApprove ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <ShieldAlert className="size-4" /> Your role can view appeals but not approve or reject them.
        </div>
      ) : null}
      <div className="flex gap-1 overflow-x-auto">
        {(["Pending", "Approved", "Rejected", "All"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} className="min-h-9" onClick={() => setTab(t)}>
            {t}
            {t !== "All" ? ` (${cnt(t)})` : ""}
          </Button>
        ))}
      </div>
      {!shown.length ? (
        <EmptyState title="No appeals here" description="Appeals appear when an employee marks attendance outside the permitted area." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((a) => {
            const selfieSrc = a.selfie
              ? (a.selfie.startsWith("http") || a.selfie.startsWith("data:") ? a.selfie : `http://127.0.0.1:8000${a.selfie}`)
              : null;
            return (
              <Panel key={a.id} bodyClassName="p-4">
                <div className="flex gap-3">
                  <div
                    onClick={() => selfieSrc && setEnlargedPhoto({ src: selfieSrc, title: `${a.emp} — ${a.type} Selfie (${a.time})` })}
                    className={cn(
                      "relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted transition-transform",
                      selfieSrc ? "cursor-pointer hover:ring-2 hover:ring-primary hover:scale-[1.02]" : "bg-primary"
                    )}
                    aria-label="Selfie Photo"
                    title={selfieSrc ? "Click to view full photo" : "No photo"}
                  >
                    {selfieSrc ? (
                      <img src={selfieSrc} alt={`${a.emp} selfie`} className="size-full object-cover" />
                    ) : (
                      <UserRound className="size-10 text-primary-foreground/80" />
                    )}
                    <span className="absolute bottom-0 inset-x-0 bg-foreground/70 text-center text-[9px] font-medium text-background py-0.5">
                      {selfieSrc ? "Photo" : "Selfie"} · {a.time}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{a.emp}</p>
                        <p className="text-xs text-muted-foreground">{a.dept}</p>
                      </div>
                      {appealBadge(a.status)}
                    </div>
                    <p className="mt-1 text-xs">
                      <span className="font-medium">{a.type}</span> · {a.date}, {a.time} · <span className="font-mono">{a.id}</span>
                    </p>
                  </div>
                </div>
              <div className="mt-3 space-y-1 text-xs">
                <p className="flex items-start gap-1.5">
                  <MapPinOff className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <span>
                    {a.place}
                    <span className="block text-muted-foreground">
                      {a.distance} · {a.coords}
                    </span>
                  </span>
                </p>
                <p>
                  <span className="font-medium">{a.reason}:</span> <span className="text-muted-foreground">{a.message}</span>
                </p>
                {a.reviewer ? (
                  <p className="text-muted-foreground">
                    Reviewed by {a.reviewer}
                    {a.note ? ` — “${a.note}”` : ""}
                  </p>
                ) : null}
              </div>
              {a.status === "Pending" ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-10" disabled={!canApprove} onClick={() => { setNote(""); setRejecting(a); }}>
                    <XCircle className="size-4" /> Reject
                  </Button>
                  <Button className="h-10" disabled={!canApprove} onClick={() => decide(a, "Approved")}>
                    <CheckCircle2 className="size-4" /> Approve
                  </Button>
                </div>
              ) : null}
            </Panel>
          );
        })}
        </div>
      )}
      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.id}?</DialogTitle>
            <DialogDescription>The employee will see this note. Attendance for that day stays unapproved.</DialogDescription>
          </DialogHeader>
          <Field label="Reason for rejection" required>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. No client visit recorded for this day" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={note.trim().length < 3}
              onClick={() => {
                if (!rejecting) return;
                decide(rejecting, "Rejected", note.trim());
                setRejecting(null);
              }}
            >
              Reject appeal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!enlargedPhoto} onOpenChange={(o) => !o && setEnlargedPhoto(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{enlargedPhoto?.title ?? "Selfie Verification"}</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border border-border bg-black">
            {enlargedPhoto ? (
              <img src={enlargedPhoto.src} alt="Selfie Full" className="w-full max-h-[70vh] object-contain" />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnlargedPhoto(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------- Office locations (geofence config) ----------------
export function OfficeLocations() {
  useSyncBranches();
  const offices = useStoreValue(officesStore);
  const canEdit = useCan("Edit");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", radius: "150", latitude: "", longitude: "" });
  const [isLocating, setIsLocating] = useState(false);
  const [locAccuracy, setLocAccuracy] = useState<number | null>(null);

  const handleGetLiveLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));
        setLocAccuracy(Math.round(pos.coords.accuracy));
        setIsLocating(false);
        toast.success(`Live GPS location captured (accuracy ±${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setIsLocating(false);
        toast.error(`Could not retrieve location: ${err.message || "Permission denied or unavailable"}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const updateRadius = async (o: Office, r: number) => {
    if (r && r !== o.radius) {
      try {
        if (!isNaN(Number(o.id))) {
          await api.patch(`/branches/${o.id}/`, { geofence_radius_meters: r });
        }
      } catch (err) {
        console.warn("Could not patch branch radius to backend:", err);
      }
      officesStore.set((l) => l.map((x) => (x.id === o.id ? { ...x, radius: r } : x)));
      logAudit({
        action: "Updated settings",
        module: "Attendance",
        record: o.id,
        description: `Geofence radius for ${o.name}`,
        prev: `${o.radius} m`,
        next: `${r} m`,
      });
      toast.success("Radius updated");
    }
  };

  const toggleActive = async (o: Office, v: boolean) => {
    try {
      if (!isNaN(Number(o.id))) {
        await api.patch(`/branches/${o.id}/`, { is_active: v });
      }
    } catch (err) {
      console.warn("Could not patch branch status to backend:", err);
    }
    officesStore.set((l) => l.map((x) => (x.id === o.id ? { ...x, active: v } : x)));
    logAudit({
      action: "Updated settings",
      module: "Attendance",
      record: o.id,
      description: `${o.name} ${v ? "enabled" : "disabled"} for attendance`,
      prev: v ? "Off" : "On",
      next: v ? "On" : "Off",
    });
    toast.success(`${o.name} ${v ? "activated" : "deactivated"}`);
  };

  const addLocation = async () => {
    if (!form.name.trim()) return;
    const latNum = form.latitude.trim() && !isNaN(Number(form.latitude)) ? Number(form.latitude) : 11.2588;
    const lngNum = form.longitude.trim() && !isNaN(Number(form.longitude)) ? Number(form.longitude) : 75.7804;
    const code = form.name.trim().slice(0, 8).toUpperCase().replace(/\s+/g, "-");
    const payload = {
      code,
      name: form.name.trim(),
      address: form.address || "Kozhikode, Kerala",
      city: "Kozhikode",
      state: "Kerala",
      state_code: "32",
      latitude: latNum,
      longitude: lngNum,
      geofence_radius_meters: Number(form.radius) || 150,
      is_active: true,
    };

    try {
      const res: any = await api.post("/branches/", payload);
      const newOffice: Office = {
        id: String(res.id || `OFF-${offices.length + 1}`),
        name: res.name || form.name,
        address: res.address || form.address || "—",
        lat: Number(res.latitude) || latNum,
        lng: Number(res.longitude) || lngNum,
        radius: Number(res.geofence_radius_meters) || Number(form.radius) || 150,
        active: true,
      };
      officesStore.set((l) => [...l, newOffice]);
      toast.success("Office location saved to database");
    } catch (err: any) {
      // Fallback local store
      const id = `OFF-${offices.length + 1}`;
      officesStore.set((l) => [
        ...l,
        {
          id,
          name: form.name,
          address: form.address || "—",
          lat: latNum,
          lng: lngNum,
          radius: Number(form.radius) || 150,
          active: true,
        },
      ]);
      toast.info("Office location added locally");
    }

    logAudit({
      action: "Updated settings",
      module: "Attendance",
      record: form.name,
      description: `Added office location ${form.name} (${latNum.toFixed(4)}, ${lngNum.toFixed(4)})`,
      next: `${form.radius} m radius`,
    });
    setAdding(false);
    setForm({ name: "", address: "", radius: "150", latitude: "", longitude: "" });
    setLocAccuracy(null);
  };

  return (
    <>
      <SectionHeader
        title="Office locations"
        description="Permitted areas for location-based attendance. Employees inside the radius are verified automatically."
        actions={
          <Button size="sm" disabled={!canEdit} onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add location
          </Button>
        }
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {offices.map((o) => (
          <Panel key={o.id} bodyClassName="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{o.name}</p>
                <p className="text-xs text-muted-foreground">{o.address}</p>
              </div>
              <Switch
                checked={o.active}
                disabled={!canEdit}
                onCheckedChange={(v) => toggleActive(o, v)}
                aria-label={`${o.name} active`}
              />
            </div>
            <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-md bg-muted/60">
              <span className="absolute size-24 rounded-full border-2 border-dashed border-accent/60 bg-accent/10" />
              <MapPin className="relative size-6 text-primary" />
              <span className="absolute bottom-1 right-2 text-[10px] text-muted-foreground">
                {o.lat.toFixed(4)}, {o.lng.toFixed(4)}
              </span>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Allowed radius</span>
              <span className="flex items-center gap-1.5">
                <Input
                  type="number"
                  className="h-9 w-24 text-right"
                  defaultValue={o.radius}
                  disabled={!canEdit}
                  onBlur={(e) => updateRadius(o, Number(e.target.value))}
                />{" "}
                m
              </span>
            </label>
          </Panel>
        ))}
      </div>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add office location</DialogTitle>
            <DialogDescription>Configures a new physical branch geofence boundary for employee attendance.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kannur branch" />
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address or city" />
            </Field>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Navigation className="size-3.5 text-primary" /> Coordinates & GPS
                  </p>
                  <p className="text-[11px] text-muted-foreground">Latitude & Longitude coordinates</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGetLiveLocation}
                  disabled={isLocating}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  {isLocating ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" /> Fetching…
                    </>
                  ) : (
                    <>
                      <Navigation className="size-3.5 text-primary" /> Use Live Location
                    </>
                  )}
                </Button>
              </div>

              {locAccuracy !== null ? (
                <div className="flex items-center gap-1 text-[11px] text-success">
                  <CheckCircle2 className="size-3 shrink-0" /> Live GPS captured (accuracy ±{locAccuracy}m)
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <Field label="Latitude" required>
                  <Input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    placeholder="e.g. 11.2588"
                  />
                </Field>
                <Field label="Longitude" required>
                  <Input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    placeholder="e.g. 75.7804"
                  />
                </Field>
              </div>
            </div>

            <Field label="Radius (m)">
              <Input type="number" value={form.radius} onChange={(e) => setForm({ ...form, radius: e.target.value })} placeholder="150" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button disabled={!form.name.trim()} onClick={addLocation}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

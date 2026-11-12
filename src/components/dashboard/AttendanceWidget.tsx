import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock3, History, LogIn, LogOut, MapPin, MapPinOff, Navigation, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Panel, StatusBadge } from "@/components/erp/primitives";
import { AppealDialog } from "@/components/hr/self-attendance";
import { LiveCameraCapture } from "@/components/hr/LiveCameraCapture";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { logAudit } from "@/data/audit";
import { dayOffset } from "@/data/finance";
import { currentUser } from "@/lib/user";
import { officesStore, selfHistoryStore, useStoreValue, type SelfRecord } from "@/data/self-attendance";
import { getAccessToken, getStoredUser, hrApi } from "@/lib/api";

type DemoState = "not-in" | "working" | "complete" | "appeal";
type AttendanceAction = "Check-in" | "Check-out";
type LocationCheck = "checking" | "verified" | "failed";

const displayTime = (date: Date) => date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" });
const recordTime = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

function minutesAt(time: string) {
  const parts = time.split(":").map(Number);
  const hours = parts[0];
  const minutes = parts[1];
  if (hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function currentMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).formatToParts(new Date());
  return Number(parts.find((part) => part.type === "hour")?.value ?? 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0);
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

function durationLabel(record?: SelfRecord) {
  if (!record || record.checkIn === "—") return "00h 00m";
  const start = minutesAt(record.checkIn);
  const end = record.checkOut === "—" ? currentMinutes() : minutesAt(record.checkOut);
  if (start === null || end === null) return "00h 00m";
  const elapsed = Math.max(0, end - start);
  return `${String(Math.floor(elapsed / 60)).padStart(2, "0")}h ${String(elapsed % 60).padStart(2, "0")}m`;
}

function mockRecord(status: "working" | "complete", office: string): SelfRecord {
  const today = dayOffset(0);
  return { id: "ATT-901", emp: currentUser.name, date: today.label, iso: today.iso, checkIn: status === "working" ? "09:24" : "09:18", checkOut: status === "working" ? "—" : "18:02", place: office, loc: "Verified", status: "Present" };
}

export function DashboardAttendanceWidget() {
  const history = useStoreValue(selfHistoryStore);
  const offices = useStoreValue(officesStore);
  const today = dayOffset(0);
  const [userName, setUserName] = useState(currentUser.name);
  const [userRole, setUserRole] = useState(currentUser.role);
  const [userInitials, setUserInitials] = useState(currentUser.initials);
  const [activeBranch, setActiveBranch] = useState<{ id: number; name: string; latitude: number; longitude: number; radius: number } | null>(null);

  const fetchTodayStatus = async () => {
    if (!getAccessToken()) return;
    try {
      const data = await hrApi.getTodayAttendance();
      if (data.employee) {
        setUserName(data.employee.name);
        if (data.employee.designation_title) {
          setUserRole(data.employee.designation_title);
        }
        const inits = data.employee.name.split(" ").map((n) => n[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
        if (inits) setUserInitials(inits);
      }
      if (data.branch) {
        setActiveBranch(data.branch);
      }
      if (data.has_punched && data.record) {
        const isCheckedOut = Boolean(data.record.check_out && data.record.check_out !== "—");
        const rec: SelfRecord = {
          id: `ATT-${data.record.id}`,
          emp: data.employee?.name || userName,
          date: today.label,
          iso: today.iso,
          checkIn: data.record.check_in || "—",
          checkOut: data.record.check_out || "—",
          place: data.record.location || (data.branch?.name ?? "Calicut HQ"),
          loc: "Verified",
          status: (data.record.status as any) || "Present",
          selfie: data.record.selfie || undefined,
        };
        selfHistoryStore.set((records) => [
          rec,
          ...records.filter((item) => item.iso !== today.iso || (item.emp !== userName && item.emp !== currentUser.name)),
        ]);
        setDemoState(isCheckedOut ? "complete" : "working");
      }
    } catch {
      // Deferred offline fallback
    }
  };

  useEffect(() => {
    const user = getStoredUser();
    if (user && user.name) {
      setUserName(user.name);
      setUserRole(user.is_superuser ? "System Administrator" : user.role || currentUser.role);
      const initials = user.name
        .split(" ")
        .map((n) => n[0])
        .filter(Boolean)
        .join("")
        .slice(0, 2)
        .toUpperCase() || "U";
      setUserInitials(initials);
    }
    fetchTodayStatus();
    window.addEventListener("zs_auth_changed", fetchTodayStatus);
    return () => window.removeEventListener("zs_auth_changed", fetchTodayStatus);
  }, []);

  const todayRecord = history.find((record) => record.iso === today.iso && (record.emp === userName || record.emp === currentUser.name));
  const office = offices.find((item) => item.active) ?? offices[0];
  const [now, setNow] = useState<Date | null>(null);
  const [demoState, setDemoState] = useState<DemoState>(() => !todayRecord ? "not-in" : todayRecord.status === "Appeal pending" ? "appeal" : todayRecord.checkOut === "—" ? "working" : "complete");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [appealOpen, setAppealOpen] = useState(false);
  const [locationCheck, setLocationCheck] = useState<LocationCheck>("checking");

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const action: AttendanceAction | null = !todayRecord ? "Check-in" : todayRecord.checkOut === "—" && todayRecord.status !== "Appeal pending" ? "Check-out" : null;
  const state = demoState === "appeal" ? "appeal" : todayRecord?.status === "Appeal pending" ? "appeal" : !todayRecord ? "not-in" : todayRecord.checkOut === "—" ? "working" : "complete";
  const duration = useMemo(() => durationLabel(todayRecord), [todayRecord, now]);

  const selectDemoState = (next: string) => {
    if (!next || !office) return;
    const selected = next as DemoState;
    setDemoState(selected);
    setConfirmOpen(false);
    selfHistoryStore.set((records) => {
      const previous = records.filter((record) => !(record.iso === today.iso && (record.emp === userName || record.emp === currentUser.name)));
      return selected === "working" ? [mockRecord("working", office.name), ...previous] : selected === "complete" ? [mockRecord("complete", office.name), ...previous] : previous;
    });
  };

  const navigate = useNavigate();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distMeters, setDistMeters] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openConfirmation = () => {
    if (!action) return;
    if (!getAccessToken()) {
      toast.error("Please sign in first to punch attendance.");
      navigate({ to: "/login" });
      return;
    }
    const targetBranch = activeBranch ?? {
      id: 1,
      name: office?.name ?? "Office",
      latitude: office?.lat ?? 11.2588,
      longitude: office?.lng ?? 75.7804,
      radius: office?.radius ?? 150,
    };

    setLocationCheck("checking");
    setSelfie(null);
    setDistMeters(null);
    setConfirmOpen(true);

    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = distanceMeters(pos.coords.latitude, pos.coords.longitude, targetBranch.latitude, targetBranch.longitude);
          setDistMeters(dist);
          setAccuracy(pos.coords.accuracy || null);
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (dist <= targetBranch.radius) {
            setLocationCheck("verified");
          } else {
            setLocationCheck("failed");
          }
        },
        (geoErr) => {
          console.warn("Geolocation fallback:", geoErr?.message);
          setDistMeters(null);
          setAccuracy(null);
          setCoords({ lat: targetBranch.latitude, lng: targetBranch.longitude });
          setLocationCheck("failed");
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    } else {
      setDistMeters(null);
      setAccuracy(null);
      setCoords({ lat: targetBranch.latitude, lng: targetBranch.longitude });
      setLocationCheck("failed");
    }
  };

  const simulateInsideOffice = () => {
    const targetBranch = activeBranch ?? {
      id: 1,
      name: office?.name ?? "Calicut HQ",
      latitude: office?.lat ?? 11.2588,
      longitude: office?.lng ?? 75.7804,
      radius: office?.radius ?? 150,
    };
    setCoords({ lat: targetBranch.latitude, lng: targetBranch.longitude });
    setDistMeters(15);
    setLocationCheck("verified");
    toast.info(`Simulating coordinates inside ${targetBranch.name} for testing.`);
  };

  const confirmAttendance = async () => {
    if (!action || locationCheck !== "verified") return;
    const time = recordTime();
    const targetBranch = activeBranch ?? {
      id: 1,
      name: office?.name ?? "Office",
      latitude: office?.lat ?? 11.2588,
      longitude: office?.lng ?? 75.7804,
      radius: office?.radius ?? 150,
    };
    const lat = Number((coords?.lat ?? targetBranch.latitude).toFixed(6));
    const lng = Number((coords?.lng ?? targetBranch.longitude).toFixed(6));

    setIsSubmitting(true);
    try {
      const res = await hrApi.punchAttendance({
        latitude: lat,
        longitude: lng,
        branch_id: targetBranch.id,
        accuracy: accuracy ?? undefined,
        selfie: selfie || undefined,
      });

      if (action === "Check-in") {
        const record: SelfRecord = {
          id: `ATT-${res.record.id}`,
          emp: res.record.employee_name || userName,
          date: today.label,
          iso: today.iso,
          checkIn: res.record.check_in || time,
          checkOut: "—",
          place: res.record.location || targetBranch.name,
          loc: "Verified",
          status: (res.record.status as any) || (time > "09:30" ? "Late" : "Present"),
          selfie: selfie || undefined,
        };
        selfHistoryStore.set((records) => [
          record,
          ...records.filter((item) => item.iso !== today.iso || (item.emp !== userName && item.emp !== currentUser.name)),
        ]);
        setDemoState("working");
      } else {
        selfHistoryStore.set((records) =>
          records.map((record) =>
            record.iso === today.iso && (record.emp === userName || record.emp === currentUser.name)
              ? { ...record, checkOut: res.record.check_out || time, selfie: selfie || record.selfie || undefined }
              : record
          )
        );
        setDemoState("complete");
      }

      logAudit({
        action: res.action === "Check-in" ? "Checked in" : "Checked out",
        module: "Attendance",
        record: `ATT-${today.iso}`,
        description: `${res.action} at ${res.record.location || targetBranch.name} (${res.distance_meters}m from branch)`,
        next: `${time} · Verified GPS & Selfie`,
      });
      toast.success(res.message);
      setConfirmOpen(false);
    } catch (err: any) {
      const msg = err?.message || "Failed to record attendance punch.";
      toast.error(msg);
      if (err?.status === 400 && msg.toLowerCase().includes("geofence")) {
        setLocationCheck("failed");
        setDemoState("appeal");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusDetails = state === "not-in" ? { label: "Not Clocked In", badge: "draft", copy: "Your shift has not started." }
    : state === "working" ? { label: "Working", badge: "active", copy: "You are currently clocked in." }
      : state === "complete" ? { label: "Attendance Completed", badge: "completed", copy: "Today's attendance is complete." }
        : { label: "Appeal Required", badge: "failed", copy: "Location is outside the permitted office area." };
  const primaryLabel = state === "not-in" ? "CLOCK IN" : state === "working" ? "CLOCK OUT" : state === "appeal" ? "APPEAL ATTENDANCE" : "Attendance Completed";
  const PrimaryIcon = state === "not-in" ? LogIn : state === "working" ? LogOut : state === "appeal" ? ShieldAlert : CheckCircle2;

  const dynamicDistance = distMeters !== null
    ? distMeters >= 1000
      ? `${(distMeters / 1000).toFixed(1)} km from ${activeBranch?.name ?? office?.name} (limit: ${activeBranch?.radius ?? office?.radius} m)`
      : `${Math.round(distMeters)} m from ${activeBranch?.name ?? office?.name} (limit: ${activeBranch?.radius ?? office?.radius} m)`
    : office ? `Outside branch area (limit: ${office.radius} m)` : "Outside branch area";

  const dynamicCoords = coords ? `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E` : "Location acquired";
  const dynamicPlace = coords ? `Current Location (${dynamicCoords})` : "Outside geofence area";

  return (
    <>
      <Panel className="overflow-hidden border-primary/20" bodyClassName="p-0">
        <div className="border-b border-border bg-primary px-4 py-3 text-primary-foreground sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-foreground/10"><Clock3 className="size-5" /></span><div><h2 className="font-semibold">Employee Clock In / Clock Out</h2><p className="text-xs text-primary-foreground/70">Today’s attendance · live verification</p></div></div>
            <Button variant="secondary" size="sm" asChild><Link to="/attendance/$section" params={{ section: "my" }}><History className="size-4" /> Attendance history</Link></Button>
          </div>
        </div>
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
          <div className="min-w-0 p-4 sm:p-5 lg:border-r lg:border-border">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground" suppressHydrationWarning>
                  {userInitials}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold" suppressHydrationWarning>{userName}</p>
                  <p className="text-xs text-muted-foreground" suppressHydrationWarning>{userRole} · Shift 09:30 – 18:00</p>
                </div>
              </div>
              <div className="sm:text-right"><p className="text-2xl font-semibold tabular">{now ? displayTime(now) : "--:--:--"}</p><p className="text-xs text-muted-foreground">{today.label} · India Standard Time</p></div>
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-md border border-border bg-muted/30">
              <Metric label="Clock in" value={todayRecord?.checkIn ?? "—"} /><Metric label="Clock out" value={todayRecord?.checkOut ?? "—"} /><Metric label="Duration" value={duration} />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div><StatusBadge status={statusDetails.badge} label={statusDetails.label} /><p className="mt-1 text-xs text-muted-foreground">{statusDetails.copy}</p></div>
              <div className="flex items-center gap-2 text-xs">{state === "appeal" ? <MapPinOff className="size-4 text-destructive" /> : state === "not-in" ? <Navigation className="size-4 text-muted-foreground" /> : <MapPin className="size-4 text-success" />}<span className={state === "appeal" ? "font-medium text-destructive" : "text-muted-foreground"}>{state === "appeal" ? "Location Not Verified" : state === "not-in" ? "Location not checked" : `${todayRecord?.place ?? office?.name} · Verified`}</span></div>
            </div>
            <Button className="mt-5 h-12 w-full text-base sm:w-auto sm:min-w-52" variant={state === "appeal" ? "destructive" : "default"} disabled={state === "complete"} onClick={state === "appeal" ? () => setAppealOpen(true) : openConfirmation}><PrimaryIcon className="size-5" /> {primaryLabel}</Button>
          </div>
          <div className="min-w-0 space-y-4 bg-muted/20 p-4 sm:p-5">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today’s timeline</p><ol className="mt-3 space-y-0"><TimelineItem complete={state !== "not-in" && state !== "appeal"} active={state === "not-in" || state === "appeal"} title="Shift starts" detail="09:30 · Verify office location" /><TimelineItem complete={state === "working" || state === "complete"} active={state === "working"} title="Clock in" detail={todayRecord ? `${todayRecord.checkIn} · ${todayRecord.place}` : "Waiting for employee"} /><TimelineItem complete={state === "complete"} active={state === "complete"} title="Clock out" detail={state === "complete" ? `${todayRecord?.checkOut} · ${duration} worked` : "Expected by 18:00"} last /></ol></div>
          </div>
        </div>
      </Panel>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Confirm {action ?? "attendance"}</DialogTitle><DialogDescription>Your GPS location {action === "Check-in" ? "and optional live selfie verify attendance." : "verifies attendance checkout."}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-semibold tabular">{now ? displayTime(now) : "--:--:--"}</p>
              <p className="mt-1 text-xs text-muted-foreground" suppressHydrationWarning>{today.label} · {userName}</p>
            </div>
            {locationCheck === "checking" ? (
              <LocationState icon={<RefreshCw className="size-5 animate-spin text-accent" />} title="Verifying GPS location…" detail="Locating nearest registered branch…" />
            ) : locationCheck === "verified" ? (
              <LocationState good icon={<CheckCircle2 className="size-5" />} title="Location Verified" detail={`${activeBranch?.name ?? office?.name} · Verified GPS · Allowed radius ${activeBranch?.radius ?? office?.radius} m`} />
            ) : (
              <div className="space-y-2">
                <LocationState
                  bad
                  icon={<MapPinOff className="size-5" />}
                  title="Outside Office Geofence"
                  detail={`You are ${dynamicDistance}. Direct attendance punch is restricted to office premises.`}
                />
                <button
                  type="button"
                  onClick={simulateInsideOffice}
                  className="text-xs text-primary hover:underline font-medium inline-block pl-1 cursor-pointer"
                >
                  📍 Developer Mode: Simulate Inside {activeBranch?.name ?? office?.name ?? "Office"}
                </button>
              </div>
            )}

            {action === "Check-in" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Facial Selfie Verification <span className="text-muted-foreground font-normal">(Optional inside office)</span></label>
                <LiveCameraCapture onCapture={setSelfie} initialCaptured={selfie} />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={isSubmitting} onClick={() => setConfirmOpen(false)}>Cancel</Button>
            {locationCheck === "failed" ? (
              <Button variant="destructive" onClick={() => { setConfirmOpen(false); setAppealOpen(true); }}>
                <ShieldAlert className="size-4" /> Appeal Attendance
              </Button>
            ) : (
              <Button disabled={locationCheck !== "verified" || isSubmitting} onClick={confirmAttendance}>
                {isSubmitting ? <RefreshCw className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Confirm {action}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AppealDialog
        open={appealOpen}
        onOpenChange={setAppealOpen}
        action={action ?? "Check-in"}
        place={dynamicPlace}
        coords={dynamicCoords}
        distance={dynamicDistance}
        onDone={() => setDemoState("appeal")}
      />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 p-3 text-center"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular">{value}</p></div>;
}

function LocationState({ icon, title, detail, good, bad }: { icon: React.ReactNode; title: string; detail: string; good?: boolean; bad?: boolean }) {
  return <div className={good ? "flex items-start gap-3 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success" : bad ? "flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" : "flex items-start gap-3 rounded-md border border-border p-3 text-sm"}>{icon}<div><p className="font-semibold">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p></div></div>;
}

function TimelineItem({ complete, active, title, detail, last = false }: { complete: boolean; active: boolean; title: string; detail: string; last?: boolean }) {
  return <li className="relative flex gap-3 pb-4 last:pb-0">{!last ? <span className="absolute left-[7px] top-4 h-full w-px bg-border" /> : null}<span className={`relative mt-1 size-4 shrink-0 rounded-full border-2 ${complete ? "border-success bg-success" : active ? "border-accent bg-background" : "border-border-strong bg-background"}`} /><div className="min-w-0"><p className="text-sm font-medium">{title}</p><p className="truncate text-xs text-muted-foreground">{detail}</p></div></li>;
}
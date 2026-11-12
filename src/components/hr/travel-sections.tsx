import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Clock, Compass, Flag, MapPin, Navigation, Play, Send, Square, X, Loader2, Plus, Trash2, Settings, Radio, Search, AlertTriangle, RotateCcw, Bike, Car, Building2, UserCheck, ShieldCheck, CheckCircle2, AlertCircle, MapPinned, Timer } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { EmptyState, KpiCard, Panel, StatusBadge } from "@/components/erp/primitives";
import { DataTable, DetailGrid } from "@/components/erp/DataTable";
import { ExportButtons, SectionHeader } from "@/components/erp/ModuleLayout";
import { Steps } from "@/components/ops/common";
import { Field } from "@/components/sales/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { inr } from "@/lib/format";
import { RATE, distanceBetween, empById, employees, places, getTravelRates, type Place, type Travel } from "@/data/hr";
import { api, getStoredUser } from "@/lib/api";
import { M, Person, axis, sum, tip } from "./common";
import { useLiveEmployees } from "./attendance-sections";
import { LeafletRouteMap } from "./LeafletRouteMap";
import { getDrivingRoute, getMultiStopRoute, searchPlaces, type GeocodePlace } from "@/lib/osrm";

let store: Travel[] = [];
const tBadge = (s: Travel["status"]) => (
  <StatusBadge
    status={s === "Paid" ? "paid" : s === "Approved" ? "approved" : s === "Rejected" ? "rejected" : s === "Submitted" ? "pending" : "info"}
    label={s}
  />
);

export interface TripStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "arrived" | "departed" | "completed";
  arrivedAt?: string;
  departedAt?: string;
  stayMinutes?: number;
}

export function RouteMap(props: {
  from: Place;
  to?: Place | undefined;
  via?: Place[];
  live?: boolean;
  className?: string;
  routeCoordinates?: [number, number][] | undefined;
  onRouteCalculated?: (distanceKm: number, durationMinutes: number) => void;
}) {
  return <LeafletRouteMap {...props} />;
}

export function useLiveTravelClaims() {
  const [claims, setClaims] = useState<Travel[]>(store);
  const [loading, setLoading] = useState(true);

  const fetchClaims = () => {
    setLoading(true);
    api.get<any>("/hr/travel-claims/")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        const mapped: Travel[] = list.map((t: any) => {
          const matchedFrom = places.find((p) => p.name === t.from_location) || {
            name: t.from_location || "HQ",
            x: 52,
            y: 60,
            lat: Number(t.start_latitude) || 9.9984,
            lng: Number(t.start_longitude) || 76.3122,
          };
          const matchedTo = places.find((p) => p.name === t.to_location) || {
            name: t.to_location || "Destination",
            x: 55,
            y: 34,
            lat: Number(t.end_latitude) || 10.5276,
            lng: Number(t.end_longitude) || 76.2144,
          };
          return {
            id: t.code || `TRV-${t.id}`,
            emp: t.employee_code || (typeof t.employee === "object" ? t.employee?.code : t.employee) || "EMP-SALMAN",
            iso: t.claim_date,
            date: t.claim_date ? new Date(t.claim_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—",
            from: matchedFrom,
            to: matchedTo,
            via: [],
            start: t.start_time || "09:00",
            end: t.end_time || "17:00",
            km: Number(t.km) || 0,
            gpsKm: Number(t.gps_km) || Number(t.km) || 0,
            rate: Number(t.rate_per_km) || 4.5,
            allowance: Number(t.allowance) || 0,
            purpose: t.purpose || "Service",
            customer: t.customer || "Customer",
            status: t.status as Travel["status"],
            vehicle: t.vehicle || "Two-wheeler",
            routeGeometry: Array.isArray(t.route_geometry) ? t.route_geometry : undefined,
          };
        });
        store = mapped;
        setClaims(mapped);
      })
      .catch((err) => {
        console.warn("Could not fetch travel claims from backend:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  return { claims, setClaims, loading, refresh: fetchClaims };
}

export function TravelDashboard() {
  const { claims: rows } = useLiveTravelClaims();
  const byEmp = Object.values(
    rows.reduce<Record<string, { name: string; km: number; amt: number }>>((a, t) => {
      const e = empById(t.emp) ?? { name: t.emp };
      const shortName = (e.name || t.emp).split(" ")[0] || t.emp;
      (a[t.emp] ??= { name: shortName, km: 0, amt: 0 }).km += t.km;
      (a[t.emp] ??= { name: shortName, km: 0, amt: 0 }).amt += t.allowance;
      return a;
    }, {})
  ).sort((a, b) => b.km - a.km);

  const sampleRoute = rows[0] || {
    from: places[1] || { name: "Calicut HQ", lat: 11.2588, lng: 75.7804, x: 50, y: 50 },
    to: places[4] || { name: "Thrissur", lat: 10.5276, lng: 76.2144, x: 50, y: 50 },
    via: [],
  };

  return (
    <>
      <SectionHeader
        title="Travel dashboard"
        description="Real GPS and OSRM road mileage tracking for field staff across Kerala."
        actions={
          <Button size="sm" asChild>
            <Link to="/travel/$section" params={{ section: "start" }}>
              <Play className="size-4" /> Start travel
            </Link>
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard label="Trips" value={String(rows.length)} />
        <KpiCard
          label="Distance"
          value={`${Math.round(sum(rows, (t) => t.km)).toLocaleString("en-IN")} km`}
        />
        <KpiCard
          label="Allowance claimed"
          value={inr(sum(rows.filter((t) => t.status !== "Rejected"), (t) => t.allowance))}
        />
        <KpiCard
          label="Pending approval"
          value={String(rows.filter((t) => t.status === "Submitted").length)}
          tone="down"
          hint={inr(sum(rows.filter((t) => t.status === "Submitted"), (t) => t.allowance))}
        />
        <KpiCard
          label="On the road now"
          value={String(rows.filter((t) => t.status === "In progress").length)}
        />
        <KpiCard label="Rates" value="₹4.5 / ₹9" hint="per km · two-wheeler / car" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Distance by employee" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byEmp}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} unit=" km" />
                <RTooltip contentStyle={tip} />
                <Bar dataKey="km" name="Km" fill="var(--color-chart-2)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Active route (Leaflet & OSRM)">
          <RouteMap from={sampleRoute.from} to={sampleRoute.to} via={sampleRoute.via} className="h-64" />
        </Panel>
      </div>
    </>
  );
}

export function TravelRecords() {
  const nav = useNavigate();
  const { claims: rows, refresh } = useLiveTravelClaims();
  const [act, setAct] = useState<{ t: Travel; to: Travel["status"] } | null>(null);

  const handleDelete = async (t: Travel) => {
    try {
      await api.delete(`/hr/travel-claims/${t.id}/`);
      toast.success(`${t.id} deleted successfully`);
      refresh();
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete travel claim");
      return false;
    }
  };

  return (
    <>
      <SectionHeader
        title="Travel records"
        description="All field trips with real OSRM road distance, rates and payroll allowances."
        actions={
          <>
            <ExportButtons />
            <Button size="sm" asChild>
              <Link to="/travel/$section" params={{ section: "start" }}>
                <Play className="size-4" /> Start travel
              </Link>
            </Button>
          </>
        }
      />
      <DataTable
        rows={rows}
        getId={(t) => t.id}
        entity="travel record"
        search={(t) => `${t.id} ${empById(t.emp)?.name ?? t.emp} ${t.from.name} ${t.to.name} ${t.customer}`}
        date={(t) => t.iso}
        removeLabel="Delete"
        onDelete={handleDelete}
        filters={[
          { label: "Statuses", get: (t) => t.status },
          { label: "Employees", get: (t) => empById(t.emp)?.name ?? t.emp },
          { label: "Vehicles", get: (t) => t.vehicle },
        ]}
        onRowClick={(t) => nav({ to: "/travel/view/$id", params: { id: t.id } })}
        extraActions={[
          { label: "Open details", onClick: (t) => nav({ to: "/travel/view/$id", params: { id: t.id } }) },
          { label: "Approve", icon: <Check className="size-4" />, show: (t) => t.status === "Submitted", onClick: (t) => setAct({ t, to: "Approved" }) },
          { label: "Reject", icon: <X className="size-4" />, show: (t) => t.status === "Submitted", onClick: (t) => setAct({ t, to: "Rejected" }) },
        ]}
        columns={[
          {
            key: "e",
            header: "Employee",
            sort: (t) => empById(t.emp)?.name ?? t.emp,
            render: (t) => (
              <Person
                e={empById(t.emp) ?? ({ id: t.emp, name: t.emp, initials: "EM", designation: "Staff", vehicle: t.vehicle } as any)}
                sub={t.id}
              />
            ),
          },
          { key: "d", header: "Date", sort: (t) => t.iso, render: (t) => t.date },
          {
            key: "r",
            header: "Route",
            render: (t) => (
              <div>
                <p className="font-medium text-foreground">{t.from.name.split(",")[0]} → {t.to.name}</p>
                <p className="text-xs text-muted-foreground">{t.purpose} · {t.customer}</p>
              </div>
            ),
          },
          { key: "tm", header: "Time", render: (t) => <span className="tabular">{t.start}–{t.status === "In progress" ? "…" : t.end}</span> },
          { key: "km", header: "Distance", align: "right", sort: (t) => t.km, render: (t) => `${t.km} km` },
          { key: "rt", header: "Rate", align: "right", render: (t) => `₹${t.rate}/km` },
          { key: "a", header: "Allowance", align: "right", sort: (t) => t.allowance, render: (t) => <b>{inr(t.allowance)}</b> },
          { key: "st", header: "Status", sort: (t) => t.status, render: (t) => tBadge(t.status) },
        ]}
      />
      <AlertDialog open={!!act} onOpenChange={(o) => !o && setAct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{act?.to === "Approved" ? "Approve" : "Reject"} {act?.t.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              {act
                ? `${empById(act.t.emp)?.name ?? act.t.emp} · ${act.t.km} km · ${inr(act.t.allowance)}. ${
                    act.to === "Approved"
                      ? "The allowance will automatically sync with this month's payroll travel allowance."
                      : "The employee will be notified to correct or review the claim."
                  }`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (act) {
                  try {
                    if (act.to === "Approved") {
                      await api.post(`/hr/travel-claims/${act.t.id}/approve/`);
                    } else if (act.to === "Rejected") {
                      await api.post(`/hr/travel-claims/${act.t.id}/reject/`);
                    }
                    toast.success(`${act.t.id} ${act.to.toLowerCase()} successfully`);
                    refresh();
                  } catch (err: any) {
                    toast.error(err?.message || "Failed to update travel claim");
                  }
                }
                setAct(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function PlaceSearchField({
  value,
  onSelect,
  placeholder = "Search school, landmark, college, town...",
  label,
  showCurrentValue = true,
}: {
  value?: Place;
  onSelect: (p: Place) => void;
  placeholder?: string;
  label?: string;
  showCurrentValue?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodePlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      // Local matches from Kerala places list
      const localMatches: GeocodePlace[] = places
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
        .map((p) => ({
          name: p.name,
          fullName: `${p.name}, Kerala, India`,
          lat: p.lat,
          lng: p.lng,
          type: "regional_hub",
        }));

      // Live landmarks / schools / colleges via Nominatim
      const onlineMatches = await searchPlaces(query);

      const merged: GeocodePlace[] = [...localMatches];
      for (const om of onlineMatches) {
        if (!merged.some((m) => m.name.toLowerCase() === om.name.toLowerCase())) {
          merged.push(om);
        }
      }

      setResults(merged);
      setSearching(false);
      setOpen(true);
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative space-y-1.5">
      {label && <label className="text-xs font-medium text-foreground">{label}</label>}

      {showCurrentValue && value?.name && (
        <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="size-4 shrink-0 text-primary" />
            <div className="truncate">
              <p className="font-medium truncate text-foreground text-xs sm:text-sm">{value.name}</p>
              <p className="text-[11px] text-muted-foreground">
                GPS: {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search Input Box */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className="h-9 pl-8 pr-8 text-xs bg-card"
        />
        {searching && (
          <Loader2 className="absolute right-2.5 top-2.5 size-3.5 animate-spin text-primary" />
        )}
        {query && !searching && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown Popup */}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[1200] mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50">
            Found {results.length} landmarks / places in Kerala
          </div>
          {results.map((r, i) => (
            <button
              key={`${r.name}-${i}`}
              type="button"
              onClick={() => {
                onSelect({
                  name: r.name,
                  x: 50,
                  y: 50,
                  lat: r.lat,
                  lng: r.lng,
                });
                setQuery("");
                setOpen(false);
                toast.success(`Selected: ${r.name}`);
              }}
              className="w-full text-left rounded px-2.5 py-1.5 hover:bg-accent transition-colors flex flex-col gap-0.5 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs text-foreground flex items-center gap-1.5">
                  <MapPin className="size-3 text-primary shrink-0" />
                  {r.name}
                </span>
                {r.type && (
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                    {r.type}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1 pl-4.5">{r.fullName}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to get user-scoped active trip storage key so multiple user accounts do not collide
const getActiveTripKey = (user: ReturnType<typeof getStoredUser>) => {
  const userKey = (user?.email || user?.name || "guest").toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `zs_active_field_trip_v2_${userKey}`;
};

interface ActiveTripData {
  step: number;
  emp: string;
  vehicle: "Two-wheeler" | "Car";
  purpose: string;
  customer: string;
  from: Place;
  to: Place | null;
  stops: TripStop[];
  elapsed: number;
  calculatedKm: number;
  routeCoordinates?: [number, number][] | undefined;
  startTime: string;
  endTime: string;
  breadcrumbs: [number, number][];
  lastPing: string | null;
  savedAt: number;
}

const flow = ["Start travel", "Start location", "Travelling & Stops", "End travel", "End location", "Distance", "Allowance", "Submit"];

export function StartTravel() {
  const nav = useNavigate();
  const { employees: liveEmployees } = useLiveEmployees();
  const allEmps = liveEmployees.length > 0 ? liveEmployees : employees;
  const storedUser = typeof window !== "undefined" ? getStoredUser() : null;
  const isSuperOrAdmin = Boolean(storedUser?.is_superuser || storedUser?.role === "Administrator" || storedUser?.role === "HR Manager");
  const activeTripKey = useMemo(() => getActiveTripKey(storedUser), [storedUser?.email, storedUser?.name]);

  const drivers = allEmps.filter((e) => e.vehicle !== "None" && e.status !== "Resigned");

  // Dynamically resolve employee for the currently logged in user (no hardcoded fallback to Salman)
  const currentUserDriver = useMemo(() => {
    const match = allEmps.find((e) =>
      Boolean(
        (storedUser?.email && e.email && e.email.toLowerCase() === storedUser.email.toLowerCase()) ||
        (storedUser?.name && e.name && e.name.toLowerCase() === storedUser.name.toLowerCase()) ||
        (storedUser?.name && e.id.toLowerCase() === `emp-${storedUser.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`) ||
        (storedUser?.id && (e as any).pk === storedUser.id) ||
        (storedUser?.id && e.id.toLowerCase() === `emp-${String(storedUser.id).toLowerCase()}`)
      )
    );
    if (match) return match;

    const u = storedUser || { name: "Active Staff", role: "Staff", email: "" };
    const initials = u.name
      ? u.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "US";
    return {
      id: `EMP-${u.name?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "01"}`,
      name: u.name || "Active Staff",
      initials,
      gender: "Male" as const,
      dept: "HR & Admin",
      designation: u.role || "Staff",
      phone: "+91 94470 00000",
      email: u.email || "staff@zamirzac.com",
      joined: "01 Jan 2022",
      joinedIso: "2022-01-01",
      dob: "15 May 1995",
      dobIso: "1995-05-15",
      status: "Active" as const,
      city: "Kozhikode",
      address: "Kerala",
      blood: "O+",
      pan: "ABCP0000K",
      uan: "1009000000",
      bank: "Federal Bank",
      account: "XXXX XXXX 0000",
      basic: 45000,
      hra: 18000,
      conveyance: 1600,
      special: 15400,
      gross: 80000,
      manager: "Administrator",
      type: "Full-time" as const,
      vehicle: "Two-wheeler" as const,
    };
  }, [storedUser]);

  const [emp, setEmp] = useState(currentUserDriver.id);
  const [vehicle, setVehicle] = useState<"Two-wheeler" | "Car">(currentUserDriver.vehicle === "Car" ? "Car" : "Two-wheeler");
  const [logForOther, setLogForOther] = useState(false);
  const [purpose, setPurpose] = useState("ID card delivery");
  const [customer, setCustomer] = useState("St. Thomas HSS, Thrissur");
  const [step, setStep] = useState(0);
  const defaultPlace: Place = { name: "Malappuram", x: 46, y: 18, lat: 11.0510, lng: 76.0711 };
  const [from, setFrom] = useState<Place>(() => places.find((p) => p.name.includes("Malappuram")) || places[1] || places[0] || defaultPlace);
  const [to, setTo] = useState<Place | null>(null);
  const [stops, setStops] = useState<TripStop[]>([]);
  const [stopLabelInput, setStopLabelInput] = useState("");
  const [showStopNamePrompt, setShowStopNamePrompt] = useState(false);
  const [pendingStopCoords, setPendingStopCoords] = useState<{ lat: number; lng: number; defaultName: string } | null>(null);

  // Synchronize employee and vehicle when logged in user changes
  useEffect(() => {
    if (!logForOther && step === 0) {
      setEmp(currentUserDriver.id);
      setVehicle(currentUserDriver.vehicle === "Car" ? "Car" : "Two-wheeler");
    }
  }, [currentUserDriver, logForOther, step]);

  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [calculatedKm, setCalculatedKm] = useState<number>(0);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | undefined>(undefined);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:30");

  // GPS Breadcrumb & 15-minute Periodic Ping state
  const [breadcrumbs, setBreadcrumbs] = useState<[number, number][]>([]);
  const [lastPing, setLastPing] = useState<string | null>(null);

  const e = allEmps.find((x) => x.id === emp || (x as any).pk === emp) || currentUserDriver;
  const travelRates = getTravelRates();
  const rate = travelRates[vehicle] ?? 4.5;
  const km = calculatedKm || (to ? Math.round(distanceBetween(from, to) * 10) / 10 : 0);
  const isZeroDistance = km < 0.2 && stops.length === 0;

  // Restore in-progress trip across page reloads (user-scoped)
  useEffect(() => {
    try {
      // Clear legacy global un-scoped key
      localStorage.removeItem("zs_active_field_trip_v2");

      const raw = localStorage.getItem(activeTripKey);
      if (raw) {
        const saved: ActiveTripData = JSON.parse(raw);
        if (saved && typeof saved.step === "number" && saved.step > 0 && saved.step < 8) {
          if (Date.now() - (saved.savedAt || 0) < 24 * 3600 * 1000) {
            setStep(saved.step);
            if (saved.emp) setEmp(saved.emp);
            if (saved.vehicle) setVehicle(saved.vehicle);
            if (saved.purpose) setPurpose(saved.purpose);
            if (saved.customer) setCustomer(saved.customer);
            if (saved.from) setFrom(saved.from);
            if (saved.to) setTo(saved.to);
            if (Array.isArray(saved.stops)) setStops(saved.stops);
            const extraElapsed = saved.step === 2 && saved.savedAt ? Math.floor((Date.now() - saved.savedAt) / 1000) : 0;
            setElapsed((saved.elapsed || 0) + extraElapsed);
            if (saved.calculatedKm) setCalculatedKm(saved.calculatedKm);
            if (saved.routeCoordinates) setRouteCoordinates(saved.routeCoordinates);
            if (saved.startTime) setStartTime(saved.startTime);
            if (saved.endTime) setEndTime(saved.endTime);
            if (Array.isArray(saved.breadcrumbs)) setBreadcrumbs(saved.breadcrumbs);
            if (saved.lastPing) setLastPing(saved.lastPing);
            toast.info(`Restored your active trip started at ${saved.startTime || "earlier"}`);
          } else {
            localStorage.removeItem(activeTripKey);
          }
        }
      }
    } catch (err) {
      console.warn("Could not restore active trip:", err);
    }
  }, [activeTripKey]);

  // Persist trip changes to localStorage (user-scoped)
  useEffect(() => {
    if (step > 0 && step < 8) {
      const stateToSave: ActiveTripData = {
        step,
        emp,
        vehicle,
        purpose,
        customer,
        from,
        to,
        stops,
        elapsed,
        calculatedKm,
        routeCoordinates,
        startTime,
        endTime,
        breadcrumbs,
        lastPing,
        savedAt: Date.now(),
      };
      localStorage.setItem(activeTripKey, JSON.stringify(stateToSave));
    } else if (step === 0 || step === 8) {
      localStorage.removeItem(activeTripKey);
    }
  }, [activeTripKey, step, emp, vehicle, purpose, customer, from, to, stops, elapsed, calculatedKm, routeCoordinates, startTime, endTime, breadcrumbs, lastPing]);

  const handleDiscardTrip = () => {
    localStorage.removeItem(activeTripKey);
    setStep(0);
    setElapsed(0);
    setCalculatedKm(0);
    setRouteCoordinates(undefined);
    setTo(null);
    setStops([]);
    setBreadcrumbs([]);
    toast.info("Active trip was discarded");
  };

  // Reverse geocode lat/lng to real landmark or locality
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        signal: AbortSignal.timeout(3500),
        headers: { "Accept-Language": "en" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.address) {
          const parts = [
            data.address.road || data.address.suburb || data.address.neighbourhood,
            data.address.village || data.address.town || data.address.city || data.address.county,
          ].filter(Boolean);
          if (parts.length > 0) return parts.join(", ");
          if (data.display_name) return data.display_name.split(",").slice(0, 2).join(",");
        }
      }
    } catch {}
    return `Live GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  // Multi-tier IP Geolocation lookup helper
  const fetchIpLocation = async (): Promise<Place | null> => {
    try {
      const res = await fetch("https://ipwho.is/", { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.latitude && data.longitude) {
          const cityName = data.city || data.region || "Kerala";
          return {
            name: `${cityName} (${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)})`,
            x: 50,
            y: 50,
            lat: data.latitude,
            lng: data.longitude,
          };
        }
      }
    } catch {}
    return null;
  };

  // Auto-detect live GPS location on mount if starting fresh
  useEffect(() => {
    if (step === 0 && typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const geoName = await reverseGeocode(lat, lng);
          const livePlace: Place = {
            name: geoName,
            x: 50,
            y: 50,
            lat,
            lng,
          };
          setFrom(livePlace);
        },
        async () => {
          const ipPlace = await fetchIpLocation();
          if (ipPlace) setFrom(ipPlace);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    }
  }, []);

  // Trip duration timer
  useEffect(() => {
    if (step !== 2) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [step]);

  // Periodic 15-minute GPS auto-ping during Travelling
  const pingLocation = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const pt: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setBreadcrumbs((b) => [...b, pt]);
          const timeStr = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
          setLastPing(timeStr);
          toast.success(`Waypoint GPS logged at ${timeStr}`);
        },
        () => {
          console.warn("Could not capture GPS ping");
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  };

  useEffect(() => {
    if (step !== 2) return;
    pingLocation();
    const interval = setInterval(pingLocation, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Fetch Live Start Location
  const handleFetchStartGPS = () => {
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const geoName = await reverseGeocode(lat, lng);
        setFrom({
          name: geoName,
          x: 50,
          y: 50,
          lat,
          lng,
        });
        setBusy(false);
        toast.success(`Start location set: ${geoName}`);
      },
      async () => {
        const ipPlace = await fetchIpLocation();
        if (ipPlace) {
          setFrom(ipPlace);
          toast.info(`Network location set: ${ipPlace.name}`);
        }
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  // Check-in at Current Stop (The user's requested workflow)
  const handleCheckInCurrentStop = () => {
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const geoName = await reverseGeocode(lat, lng);
        setPendingStopCoords({ lat, lng, defaultName: geoName });
        setStopLabelInput(geoName);
        setShowStopNamePrompt(true);
        setBusy(false);
      },
      (err) => {
        setBusy(false);
        toast.error("Could not capture GPS for stop. Please verify browser location permissions.");
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  const handleConfirmStopAdd = () => {
    if (!pendingStopCoords) return;
    const timeStr = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const finalName = stopLabelInput.trim() || pendingStopCoords.defaultName;
    const newStop: TripStop = {
      id: `stop-${Date.now()}`,
      name: finalName,
      lat: pendingStopCoords.lat,
      lng: pendingStopCoords.lng,
      status: "arrived",
      arrivedAt: timeStr,
    };
    setStops((prev) => [...prev, newStop]);
    setShowStopNamePrompt(false);
    setPendingStopCoords(null);
    setStopLabelInput("");
    toast.success(`Checked in at stop: ${finalName} (${timeStr})`);
  };

  const handleDepartFromStop = (stopId: string) => {
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    setStops((prev) =>
      prev.map((s) => {
        if (s.id !== stopId) return s;
        let stayMins = 15;
        if (s.arrivedAt) {
          const [ah, am] = s.arrivedAt.split(":").map(Number);
          const [dh, dm] = time.split(":").map(Number);
          const diff = (dh! * 60 + dm!) - (ah! * 60 + am!);
          stayMins = diff > 0 ? diff : 15;
        }
        return { ...s, status: "completed", departedAt: time, stayMinutes: stayMins };
      })
    );
    toast.success(`Departed stop at ${time}`);
  };

  const handleRemoveStop = (stopId: string) => {
    setStops((prev) => prev.filter((s) => s.id !== stopId));
  };

  // End Travel: Captures current live destination GPS
  const handleEndTravelClick = () => {
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const geoName = await reverseGeocode(lat, lng);
        const endPlace: Place = {
          name: geoName,
          x: 50,
          y: 50,
          lat,
          lng,
        };
        setTo(endPlace);
        setEndTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
        setBusy(false);
        setStep(4);
        toast.success(`Destination GPS captured: ${geoName}`);
      },
      async (err) => {
        console.warn("Destination GPS failed, trying IP fallback:", err);
        const ipPlace = await fetchIpLocation();
        if (ipPlace) {
          setTo(ipPlace);
          setEndTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
          setStep(4);
        } else {
          toast.error("Could not capture destination GPS. Please allow GPS permissions.");
        }
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  const calculateRealRoute = async () => {
    if (!to) {
      toast.error("Destination location missing");
      return;
    }

    // Check if user has not moved at all from start location
    const distBetweenStartEnd = distanceBetween(from, to);
    if (distBetweenStartEnd < 0.15 && stops.length === 0) {
      setCalculatedKm(0);
      setRouteCoordinates(undefined);
      setStep(5);
      return;
    }

    setCalculatingRoute(true);
    try {
      const allWaypoints = [
        { lat: from.lat, lng: from.lng },
        ...stops.map((s) => ({ lat: s.lat, lng: s.lng })),
        { lat: to.lat, lng: to.lng },
      ];
      const result = await getMultiStopRoute(allWaypoints);
      setCalculatedKm(result.distanceKm);
      setRouteCoordinates(result.coordinates);
      toast.success(`OSRM road distance: ${result.distanceKm} km across ${stops.length + 1} legs (${result.durationMinutes} mins)`);
    } catch {
      const fallback = Math.round(distanceBetween(from, to) * 10) / 10;
      setCalculatedKm(fallback);
    } finally {
      setCalculatingRoute(false);
      setStep(5);
    }
  };

  return (
    <>
      <SectionHeader
        title="Start travel"
        description="Live field trip capture powered by Leaflet maps, multi-stop school waypoints and real Django backend persistence."
        actions={
          step > 0 && step < 8 ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
              onClick={handleDiscardTrip}
            >
              <RotateCcw className="size-3.5" /> Discard / Reset trip
            </Button>
          ) : undefined
        }
      />
      <Steps steps={flow} current={step} />

      <div className="grid gap-4 xl:grid-cols-5 mt-4">
        <Panel title="Trip parameters" className="xl:col-span-2">
          <div className="grid gap-4">
            <Field label="Driver & Vehicle" required>
              <div className="rounded-md border border-border bg-card p-3 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                      {e.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground">{e.name}</p>
                        <UserCheck className="size-3.5 text-emerald-600" />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{e.designation} · {e.dept}</p>
                    </div>
                  </div>
                  <Select
                    value={vehicle}
                    onValueChange={(v: "Two-wheeler" | "Car") => setVehicle(v)}
                    disabled={step > 0}
                  >
                    <SelectTrigger className="h-8 text-xs w-38 bg-muted/40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Two-wheeler">
                        <span className="flex items-center gap-1.5">
                          <Bike className="size-3.5 text-primary" /> Two-wheeler (₹4.5/km)
                        </span>
                      </SelectItem>
                      <SelectItem value="Car">
                        <span className="flex items-center gap-1.5">
                          <Car className="size-3.5 text-primary" /> Car (₹9.0/km)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isSuperOrAdmin && step === 0 && (
                  <div className="flex items-center justify-between pt-1.5 border-t border-border/50 text-[11px]">
                    <span className="text-muted-foreground">Active Staff: {e.name}</span>
                    <button
                      type="button"
                      onClick={() => setLogForOther(!logForOther)}
                      className="text-primary hover:underline cursor-pointer font-medium"
                    >
                      {logForOther ? "← Back to my profile" : "Log for another staff?"}
                    </button>
                  </div>
                )}
              </div>

              {logForOther && step === 0 && (
                <div className="pt-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Select Staff Member</label>
                  <Select value={emp} onValueChange={setEmp}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} · {d.vehicle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Purpose" required>
                <Select value={purpose} onValueChange={setPurpose} disabled={step > 0}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      "ID card delivery",
                      "Order collection",
                      "Printer installation",
                      "Quotation meeting",
                      "Payment collection",
                      "Service visit",
                    ].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Customer / client">
                <Input value={customer} onChange={(x) => setCustomer(x.target.value)} disabled={step > 0} />
              </Field>
            </div>

            {step === 0 ? (
              <Button onClick={() => setStep(1)} className="w-full gap-2">
                <Play className="size-4" /> Start travel
              </Button>
            ) : null}

            {step === 1 ? (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-card p-3 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-primary" /> Current Start Location
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      GPS Ready
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{from.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      Coordinates: {from.lat.toFixed(5)}, {from.lng.toFixed(5)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={handleFetchStartGPS}
                    disabled={busy}
                  >
                    <Compass className="size-4" /> {busy ? "Detecting..." : "Re-fetch live GPS"}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setStartTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
                      setStep(2);
                      toast.success(`Journey started from: ${from.name}`);
                    }}
                    className="flex-1 gap-1.5"
                  >
                    <Check className="size-4" /> Confirm start
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-center">
                  <Navigation className="mx-auto size-7 animate-pulse text-primary" />
                  <p className="text-sm font-medium mt-1">Trip in progress from {from.name.split(",")[0]}</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <Timer className="size-4 text-primary" />
                    <p className="text-2xl font-bold font-mono">
                      {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded bg-card/90 px-3 py-2 text-xs border border-border">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Radio className="size-3.5 text-emerald-500 animate-pulse" />
                      15m GPS Auto-ping ({breadcrumbs.length} logged{lastPing ? `, last: ${lastPing}` : ""})
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={pingLocation}>
                      Ping now
                    </Button>
                  </div>
                </div>

                {/* Check-in at Current Stop / Schools visited */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      School / Client Stops ({stops.length})
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={handleCheckInCurrentStop}
                      disabled={busy}
                    >
                      <MapPinned className="size-3.5 text-primary" />
                      {busy ? "Capturing GPS..." : "Check-in at current stop"}
                    </Button>
                  </div>

                  {showStopNamePrompt && pendingStopCoords && (
                    <div className="rounded-md border border-primary/40 bg-card p-3 space-y-2.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Building2 className="size-3.5 text-primary" /> Name this school or client
                        </span>
                        <Button size="sm" variant="ghost" className="h-6 p-1" onClick={() => setShowStopNamePrompt(false)}>
                          <X className="size-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={stopLabelInput}
                        onChange={(e) => setStopLabelInput(e.target.value)}
                        placeholder="e.g. St. Thomas HSS, Thrissur / Client Shop"
                        className="h-8 text-xs"
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowStopNamePrompt(false)}>
                          Cancel
                        </Button>
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleConfirmStopAdd}>
                          <Check className="size-3.5" /> Save check-in
                        </Button>
                      </div>
                    </div>
                  )}

                  {stops.length === 0 ? (
                    <div className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                      When you reach a school or customer location, click &quot;Check-in at current stop&quot; to capture your real live GPS coordinates.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stops.map((s, idx) => (
                        <div
                          key={s.id}
                          className="rounded-md border border-border bg-card p-2.5 flex flex-col gap-2 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-medium text-xs">
                              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[10px]">
                                {idx + 1}
                              </span>
                              {s.name}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveStop(s.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                            {s.status === "arrived" && (
                              <div className="flex items-center justify-between w-full">
                                <span className="text-[11px] font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
                                  Arrived: {s.arrivedAt} · On-site
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] gap-1 text-emerald-600 border-emerald-500/30"
                                  onClick={() => handleDepartFromStop(s.id)}
                                >
                                  <Clock className="size-3" /> Check-out (Depart)
                                </Button>
                              </div>
                            )}
                            {s.status === "completed" && (
                              <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1.5">
                                <CheckCircle2 className="size-3.5" /> Stayed {s.stayMinutes}m ({s.arrivedAt} – {s.departedAt})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant="destructive"
                  onClick={handleEndTravelClick}
                  disabled={busy}
                  className="w-full gap-2"
                >
                  <Square className="size-4" /> {busy ? "Capturing destination GPS..." : "End travel (Capture destination GPS)"}
                </Button>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-card p-3 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Flag className="size-3.5 text-emerald-600" /> Captured Destination GPS
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Captured at {endTime}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{to?.name || "Destination"}</p>
                  {to && (
                    <p className="text-[11px] text-muted-foreground font-mono">
                      GPS: {to.lat.toFixed(5)}, {to.lng.toFixed(5)}
                    </p>
                  )}
                </div>

                <Button onClick={calculateRealRoute} disabled={!to || calculatingRoute} className="w-full gap-2">
                  {calculatingRoute ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Routing via OSRM...
                    </>
                  ) : (
                    <>
                      <Navigation className="size-4" />
                      Calculate road distance ({stops.length} stops)
                    </>
                  )}
                </Button>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-3">
                {isZeroDistance ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                      <span>No movement detected (0.0 km)</span>
                    </div>
                    <p className="text-muted-foreground">
                      Your destination GPS is identical to your start GPS and no intermediate stops were visited. You have not travelled anywhere, so travel distance is 0.0 km and allowance is ₹0.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setStep(2)}>
                        <ArrowLeft className="size-3" /> Back to Travelling
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleDiscardTrip}>
                        Discard Trip
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setStep(6)} className="w-full gap-2">
                    <Check className="size-4" /> Calculate allowance ({vehicle} @ ₹{rate}/km)
                  </Button>
                )}
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-3">
                {isZeroDistance && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive space-y-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="size-4 shrink-0" />
                      <span>Submission Blocked: 0.0 km distance</span>
                    </div>
                    <p>
                      You cannot submit a 0 km claim. A field travel claim requires actual GPS movement between locations.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleDiscardTrip}>
                        Discard Trip
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  disabled={isZeroDistance || busy || !to}
                  onClick={async () => {
                    if (isZeroDistance) {
                      toast.error("Cannot submit a trip with 0 km distance.");
                      return;
                    }
                    if (!to) {
                      toast.error("Destination location is missing.");
                      return;
                    }
                    const finalAllowance = Math.round(km * rate);
                    const matchedEmp = allEmps.find(
                      (x) => x.id === emp || x.name === emp || (x as any).pk === emp || String(x.id).toLowerCase() === String(emp).toLowerCase()
                    );
                    const employeeVal = (matchedEmp as any)?.pk ?? (matchedEmp as any)?.id ?? emp;
                    const stopSummary = stops.map((s) => `${s.name} (${s.stayMinutes || 0}m)`).join(", ");
                    const payload = {
                      employee: employeeVal,
                      from_location: from.name,
                      to_location: to.name,
                      start_latitude: Number(from.lat.toFixed(6)),
                      start_longitude: Number(from.lng.toFixed(6)),
                      end_latitude: Number(to.lat.toFixed(6)),
                      end_longitude: Number(to.lng.toFixed(6)),
                      route_geometry: routeCoordinates ?? null,
                      km,
                      gps_km: km,
                      rate_per_km: rate,
                      allowance: finalAllowance,
                      purpose: stopSummary ? `${purpose} · Stops: ${stopSummary}` : purpose,
                      customer,
                      vehicle,
                      start_time: startTime,
                      end_time: endTime,
                      status: "Submitted",
                    };
                    try {
                      const res: any = await api.post("/hr/travel-claims/", payload);
                      const code = res?.code || `TRV-${Date.now()}`;
                      localStorage.removeItem(activeTripKey);
                      setStep(8);
                      toast.success(`${code} submitted for manager approval`);
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to submit travel claim");
                    }
                  }}
                  className="w-full gap-2"
                >
                  <Send className="size-4" /> Submit for approval
                </Button>
              </div>
            ) : null}

            {step === 8 ? (
              <div className="space-y-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
                <p className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="size-5 text-emerald-600" /> Submitted to {e.manager} for payroll approval
                </p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => nav({ to: "/travel/$section", params: { section: "records" } })}>
                    View records
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      handleDiscardTrip();
                    }}
                  >
                    New trip
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        <div className="space-y-4 xl:col-span-3">
          <RouteMap
            from={from}
            to={step >= 4 && to ? to : undefined}
            via={stops.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, x: 50, y: 50 }))}
            live={step === 2}
            routeCoordinates={routeCoordinates}
            className="h-80"
          />
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Start", step >= 1 ? from.name.split(",")[0] : "—"],
              ["Stops visited", `${stops.filter((s) => s.status === "completed" || s.status === "arrived").length} of ${stops.length}`],
              ["Road distance", step >= 5 ? `${km} km` : "—"],
              ["Allowance", step >= 6 ? `${inr(Math.round(km * rate))}` : "—"],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="truncate text-sm font-semibold mt-0.5">{v}</p>
              </div>
            ))}
          </div>
          {step >= 6 && !isZeroDistance ? (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">
                Calculation: <b className="text-foreground">{km} km</b> ×{" "}
                <b className="text-foreground">₹{rate}/km</b> ({vehicle}) ={" "}
                <b className="text-primary text-base ml-1">{inr(Math.round(km * rate))}</b>
              </p>
              {stops.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Stops breakdown: {stops.map((s) => `${s.name} (${s.stayMinutes || 0} mins)`).join(" · ")}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export function TravelDetail({ id }: { id: string }) {
  const [t, setT] = useState<Travel | undefined>(() => store.find((x) => x.id === id));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/hr/travel-claims/${id}/`)
      .then((res) => {
        if (res && (res.code || res.id)) {
          const matchedFrom = places.find((p) => p.name === res.from_location) || {
            name: res.from_location || "HQ",
            x: 52,
            y: 60,
            lat: Number(res.start_latitude) || 9.9984,
            lng: Number(res.start_longitude) || 76.3122,
          };
          const matchedTo = places.find((p) => p.name === res.to_location) || {
            name: res.to_location || "Destination",
            x: 55,
            y: 34,
            lat: Number(res.end_latitude) || 10.5276,
            lng: Number(res.end_longitude) || 76.2144,
          };

          setT({
            id: res.code || `TRV-${res.id}`,
            emp: res.employee_code || (typeof res.employee === "object" ? res.employee?.code : res.employee) || "EMP-01",
            iso: res.claim_date,
            date: res.claim_date ? new Date(res.claim_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—",
            from: matchedFrom,
            to: matchedTo,
            via: [],
            start: res.start_time || "09:00",
            end: res.end_time || "17:00",
            km: Number(res.km) || 0,
            gpsKm: Number(res.gps_km) || Number(res.km) || 0,
            rate: Number(res.rate_per_km) || 4.5,
            allowance: Number(res.allowance) || 0,
            purpose: res.purpose || "Service",
            customer: res.customer || "Customer",
            status: res.status as Travel["status"],
            vehicle: res.vehicle || "Two-wheeler",
            routeGeometry: Array.isArray(res.route_geometry) ? res.route_geometry : undefined,
          });
        }
      })
      .catch((err) => {
        console.warn("Could not fetch detail from server, using cached store:", err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading && !t) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" /> Loading travel claim details...
      </div>
    );
  }

  if (!t) {
    return (
      <EmptyState
        title="Travel record not found"
        action={
          <Button asChild variant="outline">
            <Link to="/travel/$section" params={{ section: "records" }}>
              Back to records
            </Link>
          </Button>
        }
      />
    );
  }

  const e = empById(t.emp) ?? {
    id: t.emp,
    name: t.emp,
    initials: "EM",
    gender: "Male",
    dept: "Field Staff",
    designation: "Executive",
    phone: "",
    email: "",
    joined: "",
    joinedIso: "",
    dob: "",
    dobIso: "",
    status: "Active",
    city: "",
    address: "",
    blood: "",
    pan: "",
    uan: "",
    bank: "",
    account: "",
    basic: 0,
    hra: 0,
    conveyance: 0,
    special: 0,
    gross: 0,
    manager: "General Manager",
    type: "Full-time",
    vehicle: t.vehicle,
  };

  const events = [
    ["Travel started", t.start, t.from.name],
    ...t.via.map((v) => ["Stop", "—", v.name]),
    ["Travel ended", t.end, t.to.name],
    ["OSRM Road distance", "", `${t.km} km (verified GPS ${t.gpsKm} km)`],
    ["Allowance calculated", "", `${t.km} km × ₹${t.rate} = ${inr(t.allowance)}`],
    ["Submitted", "", `To ${e.manager}`],
    ...(t.status === "Approved" || t.status === "Paid"
      ? [["Approved", "", `${e.manager} (Synced to payroll TA)`]]
      : t.status === "Rejected"
      ? [["Rejected", "", "Distance requires verification"]]
      : []),
    ...(t.status === "Paid" ? [["Paid", "", "Credited in monthly payroll"]] : []),
  ];

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/travel/$section" params={{ section: "records" }}>
          <ArrowLeft className="size-4" /> Travel records
        </Link>
      </Button>

      <SectionHeader
        title={`${t.from.name.split(",")[0]} → ${t.to.name}`}
        description={`${t.id} · ${t.date} · ${t.purpose} · ${t.customer}`}
        actions={tBadge(t.status)}
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-3 xl:col-span-3">
          <RouteMap
            from={t.from}
            to={t.to}
            via={t.via}
            routeCoordinates={t.routeGeometry}
            className="h-96"
          />
        </div>

        <div className="space-y-4 xl:col-span-2">
          <Panel title="Trip Summary">
            <div className="mb-3">
              <Person e={e as any} sub={`${e.designation} · ${t.vehicle}`} />
            </div>
            <DetailGrid
              items={[
                ["Start location", `${t.from.name} · ${t.start}`],
                ["Destination", `${t.to.name} · ${t.end}`],
                ["Road Distance", `${t.km} km`],
                ["Vehicle Rate", `₹${t.rate}/km`],
                ["Total Allowance", inr(t.allowance)],
                ["Status", t.status],
              ]}
            />
          </Panel>

          <Panel title="Trip audit & approval timeline">
            <ol className="space-y-3 border-l border-border pl-4 text-sm">
              {events.map(([a, b, c], i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
                  <p className="font-medium text-foreground">
                    {a}{" "}
                    {b ? (
                      <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground ml-1">
                        <Clock className="size-3" />
                        {b}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{c}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function TravelAllowance() {
  const { claims: storeRows } = useLiveTravelClaims();
  const [rates, setRates] = useState(getTravelRates());
  const [configOpen, setConfigOpen] = useState(false);
  const [twoWheelerRate, setTwoWheelerRate] = useState(rates["Two-wheeler"]);
  const [carRate, setCarRate] = useState(rates["Car"]);

  const rows = Object.values(
    storeRows.reduce<
      Record<string, { emp: string; trips: number; km: number; claimed: number; approved: number; pending: number; paid: number }>
    >((a, t) => {
      const r = (a[t.emp] ??= { emp: t.emp, trips: 0, km: 0, claimed: 0, approved: 0, pending: 0, paid: 0 });
      r.trips++;
      r.km += t.km;
      if (t.status !== "Rejected") r.claimed += t.allowance;
      if (t.status === "Approved") r.approved += t.allowance;
      if (t.status === "Submitted") r.pending += t.allowance;
      if (t.status === "Paid") r.paid += t.allowance;
      return a;
    }, {})
  );

  return (
    <>
      <SectionHeader
        title="Travel allowance"
        description={`Verified allowances per employee synced with monthly payroll. Rates: two-wheeler ₹${rates["Two-wheeler"].toFixed(2)}/km, car ₹${rates.Car.toFixed(2)}/km.`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
              <Settings className="size-4" /> Rates & Policy
            </Button>
            <ExportButtons />
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <KpiCard label="Claimed" value={inr(sum(rows, (r) => r.claimed))} />
        <KpiCard label="Pending" value={inr(sum(rows, (r) => r.pending))} tone="down" />
        <KpiCard label="Approved (Synced to payroll)" value={inr(sum(rows, (r) => r.approved))} />
        <KpiCard label="Paid" value={inr(sum(rows, (r) => r.paid))} tone="up" />
      </div>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Travel Allowance & Rates Policy</DialogTitle>
            <DialogDescription>
              Configure reimbursement rates per kilometer for field employees.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <Field label="Two-wheeler rate (₹ / km)">
              <Input
                type="number"
                step="0.5"
                value={twoWheelerRate}
                onChange={(e) => setTwoWheelerRate(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Car rate (₹ / km)">
              <Input
                type="number"
                step="0.5"
                value={carRate}
                onChange={(e) => setCarRate(Number(e.target.value) || 0)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              These rates apply automatically to new trips and synced payroll allowances.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const newRates = { "Two-wheeler": twoWheelerRate, Car: carRate, None: 0 };
                if (typeof window !== "undefined") {
                  localStorage.setItem("zs_travel_rates", JSON.stringify(newRates));
                }
                setRates(newRates);
                setConfigOpen(false);
                toast.success("Travel allowance rates updated successfully!");
              }}
            >
              Save Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DataTable
        rows={rows}
        getId={(r) => r.emp}
        entity="employee"
        search={(r) => empById(r.emp)?.name ?? r.emp}
        removeLabel={null}
        filters={[{ label: "Vehicles", get: (r) => empById(r.emp)?.vehicle ?? "Two-wheeler" }]}
        columns={[
          {
            key: "e",
            header: "Employee",
            sort: (r) => empById(r.emp)?.name ?? r.emp,
            render: (r) => (
              <Person
                e={empById(r.emp) ?? ({ id: r.emp, name: r.emp, initials: "EM", vehicle: "Two-wheeler" } as any)}
                sub={empById(r.emp)?.vehicle ?? "Two-wheeler"}
              />
            ),
          },
          { key: "t", header: "Trips", align: "right", sort: (r) => r.trips, render: (r) => r.trips },
          { key: "km", header: "Km", align: "right", sort: (r) => r.km, render: (r) => r.km.toFixed(1) },
          { key: "c", header: "Claimed", align: "right", sort: (r) => r.claimed, render: (r) => inr(r.claimed) },
          { key: "p", header: "Pending", align: "right", render: (r) => (r.pending ? <span className="text-amber-600 font-medium">{inr(r.pending)}</span> : <M>—</M>) },
          { key: "a", header: "Approved", align: "right", render: (r) => inr(r.approved) },
          { key: "pd", header: "Paid", align: "right", render: (r) => inr(r.paid) },
        ]}
      />
    </>
  );
}

export function TravelReports() {
  const { claims: storeRows } = useLiveTravelClaims();
  const byPurpose = Object.values(
    storeRows.reduce<Record<string, { p: string; km: number; amt: number }>>((a, t) => {
      (a[t.purpose] ??= { p: t.purpose, km: 0, amt: 0 }).km += t.km;
      a[t.purpose]!.amt += t.allowance;
      return a;
    }, {})
  );
  const byDest = Object.values(
    storeRows.reduce<Record<string, { d: string; n: number }>>((a, t) => {
      (a[t.to.name] ??= { d: t.to.name, n: 0 }).n++;
      return a;
    }, {})
  ).sort((a, b) => b.n - a.n);

  return (
    <>
      <SectionHeader
        title="Travel reports"
        description="Distance and allowance analysis across purposes and destinations."
        actions={<ExportButtons />}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Allowance by purpose">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPurpose} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" {...axis} />
                <YAxis type="category" dataKey="p" {...axis} width={130} fontSize={11} />
                <RTooltip contentStyle={tip} formatter={(v: number) => inr(v)} />
                <Bar dataKey="amt" name="Allowance" fill="var(--color-chart-1)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Most visited destinations" bodyClassName="p-0">
          <ul className="divide-y divide-border">
            {byDest.slice(0, 7).map((d) => (
              <li key={d.d} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="size-3.5 text-primary" />
                  {d.d}
                </span>
                <span className="tabular font-medium">{d.n} trips</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

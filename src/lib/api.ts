/**
 * Shared API client for Zamirzac Solutions ERP.
 * Handles base URL configuration, JWT Bearer authentication,
 * automatic token refresh on 401, and structured DRF error extraction.
 */

const getApiBaseUrl = (): string => {
  const envUrl = (import.meta.env as Record<string, string | undefined>)["VITE_API_BASE_URL"];
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "http://127.0.0.1:8000/api/v1";
};

export const API_BASE_URL = getApiBaseUrl();

const TOKEN_KEY = "zs_access_token";
const REFRESH_KEY = "zs_refresh_token";
const USER_KEY = "zs_auth_user";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  phone?: string | undefined;
  department?: string | undefined;
  role: string;
  role_id: number | null;
  matrix: Record<string, Record<string, boolean>>;
  branch: string | null;
  branch_id: number | null;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  page?: number | undefined;
  total_pages?: number | undefined;
  results: T[];
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string | string[]> | undefined;

  constructor(message: string, status: number, fieldErrors?: Record<string, string | string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// In-memory access token cache to minimize persistent storage exposure
let inMemoryAccessToken: string | null = null;

export const getAccessToken = (): string | null => {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  if (token) {
    inMemoryAccessToken = token;
  }
  return token;
};

export const getRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REFRESH_KEY) || localStorage.getItem(REFRESH_KEY);
};

export const getStoredUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const setSession = (access: string, refresh: string, user: AuthUser): void => {
  inMemoryAccessToken = access;
  if (typeof window === "undefined") return;
  // Store in both sessionStorage and localStorage for multi-tab session persistence
  sessionStorage.setItem(TOKEN_KEY, access);
  sessionStorage.setItem(REFRESH_KEY, refresh);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("zs_auth_changed"));
};

export const clearSession = (): void => {
  const refresh = getRefreshToken();
  inMemoryAccessToken = null;
  if (typeof window === "undefined") return;
  const hadSession = !!(
    sessionStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(REFRESH_KEY) ||
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(REFRESH_KEY)
  );

  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);

  // Server-side blacklist token revocation
  if (refresh) {
    try {
      fetch(`${API_BASE_URL}/auth/logout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      }).catch(() => {
        // Best-effort network revocation
      });
    } catch {
      // Ignore network failure during teardown
    }
  }

  if (hadSession) {
    window.dispatchEvent(new Event("zs_auth_changed"));
  }
};

// In-flight refresh promise to prevent duplicate refresh calls
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearSession();
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) {
        clearSession();
        return null;
      }

      const data = (await res.json()) as { access: string; refresh?: string };
      if (data.access) {
        inMemoryAccessToken = data.access;
        sessionStorage.setItem(TOKEN_KEY, data.access);
        if (data.refresh) {
          sessionStorage.setItem(REFRESH_KEY, data.refresh);
        }
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        return data.access;
      }
      clearSession();
      return null;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

export interface RequestOptions extends RequestInit {
  params?: Record<string, any> | undefined;
  skipAuth?: boolean | undefined;
}

/**
 * Core HTTP request handler with JWT injection, automatic token refresh,
 * and structured error normalization.
 */
export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, skipAuth = false, headers: customHeaders, ...fetchOpts } = options;

  let url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }
  }

  const reqHeaders: Record<string, string> = {
    "Accept": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  if (!(fetchOpts.body instanceof FormData) && !reqHeaders["Content-Type"]) {
    reqHeaders["Content-Type"] = "application/json";
  }

  if (!skipAuth) {
    const token = getAccessToken();
    const refresh = getRefreshToken();
    if (!token && !refresh) {
      throw new ApiError("You are not signed in. Please log in to continue.", 401);
    }
    if (token) {
      reqHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  let res = await fetch(url, {
    ...fetchOpts,
    headers: reqHeaders,
  });

  // Handle 401 Unauthorized by attempting a token refresh
  if (res.status === 401 && !skipAuth && getRefreshToken()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      reqHeaders["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(url, {
        ...fetchOpts,
        headers: reqHeaders,
      });
    }
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return null as T;
  }

  let body: unknown = null;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  } else {
    try {
      body = await res.text();
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    let message = res.status === 401
      ? "You are not signed in. Please log in to continue."
      : `API request failed with status ${res.status}`;
    let fieldErrors: Record<string, string | string[]> | undefined;

    if (body && typeof body === "object") {
      const errObj = body as Record<string, unknown>;

      // Check for wrapped error structure: { success: false, error: { code, message, details } }
      const errorPayload = (errObj["error"] && typeof errObj["error"] === "object")
        ? (errObj["error"] as Record<string, unknown>)
        : null;

      if (typeof errObj["detail"] === "string") {
        message = errObj["detail"];
      } else if (typeof errObj["message"] === "string") {
        message = errObj["message"];
      } else if (typeof errObj["error"] === "string") {
        message = errObj["error"];
      } else if (errorPayload && typeof errorPayload["message"] === "string") {
        message = errorPayload["message"] as string;
      } else if (Array.isArray(errObj["non_field_errors"])) {
        message = (errObj["non_field_errors"] as string[]).join(" ");
      }

      // Collect field validation errors from error.details or root object
      const detailsSource = (errorPayload?.["details"] && typeof errorPayload["details"] === "object" && !Array.isArray(errorPayload["details"]))
        ? (errorPayload["details"] as Record<string, unknown>)
        : errObj;

      const formatErrorValue = (val: unknown): string => {
        if (typeof val === "string") return val;
        if (Array.isArray(val)) {
          return val.map(formatErrorValue).filter(Boolean).join(" ");
        }
        if (typeof val === "object" && val !== null) {
          return Object.entries(val as Record<string, unknown>)
            .map(([subKey, subVal]) => `${subKey}: ${formatErrorValue(subVal)}`)
            .join("; ");
        }
        return String(val);
      };

      const collected: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(detailsSource)) {
        if (["success", "error", "code", "message", "detail"].includes(k)) continue;
        const formatted = formatErrorValue(v);
        if (formatted) {
          collected[k] = formatted;
        }
      }

      if (Object.keys(collected).length > 0) {
        fieldErrors = collected;
        const fieldSummaries = Object.entries(collected).map(([k, v]) => `${k}: ${v}`);
        if (fieldSummaries.length > 0 && (!message || message.startsWith("Validation error on field") || message.startsWith("API request failed"))) {
          message = fieldSummaries.join("; ");
        }
      }
    }

    throw new ApiError(message, res.status, fieldErrors);
  }

  return body as T;
}

export const api = {
  get: <T>(
    endpoint: string,
    params?: RequestOptions["params"] | (Omit<RequestOptions, "method"> & { params?: RequestOptions["params"] }),
    options?: Omit<RequestOptions, "method" | "params">
  ) => {
    if (params && typeof params === "object" && ("params" in params || "signal" in params)) {
      const { params: nestedParams, ...rest } = params as Record<string, any>;
      const opts: RequestOptions = { method: "GET", ...rest, ...(options || {}) };
      if (nestedParams !== undefined) {
        opts.params = nestedParams;
      }
      return apiRequest<T>(endpoint, opts);
    }
    const opts: RequestOptions = { method: "GET", ...(options || {}) };
    if (params !== undefined) {
      opts.params = params as RequestOptions["params"];
    }
    return apiRequest<T>(endpoint, opts);
  },

  post: <T>(endpoint: string, data?: unknown) =>
    apiRequest<T>(endpoint, {
      method: "POST",
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    apiRequest<T>(endpoint, {
      method: "PUT",
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),

  patch: <T>(endpoint: string, data?: unknown) =>
    apiRequest<T>(endpoint, {
      method: "PATCH",
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),

  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, { method: "DELETE" }),
};

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const data = await apiRequest<LoginResponse>("/auth/login/", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email, password }),
    });
    setSession(data.access, data.refresh, data.user);
    return data;
  },

  magicLogin: async (token: string): Promise<LoginResponse> => {
    const data = await apiRequest<LoginResponse>("/auth/magic-login/", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ token }),
    });
    setSession(data.access, data.refresh, data.user);
    return data;
  },

  logout: async (): Promise<void> => {
    clearSession();
  },

  me: async (): Promise<AuthUser> => {
    return api.get<AuthUser>("/auth/me/");
  },

  updateProfile: async (data: { name?: string; phone?: string; department?: string }): Promise<AuthUser> => {
    const updated = await api.patch<AuthUser>("/auth/me/", data);
    const existing = getStoredUser();
    if (existing) {
      const merged = { ...existing, ...updated };
      if (typeof window !== "undefined") {
        if (localStorage.getItem(USER_KEY)) {
          localStorage.setItem(USER_KEY, JSON.stringify(merged));
        } else {
          sessionStorage.setItem(USER_KEY, JSON.stringify(merged));
        }
        window.dispatchEvent(new Event("zs_auth_changed"));
      }
    }
    return updated;
  },

  changePassword: async (data: { old_password?: string; current_password?: string; new_password: string }): Promise<{ success: boolean; message: string }> => {
    return api.post<{ success: boolean; message: string }>("/auth/change-password/", data);
  },
};

export interface AttendancePunchPayload {
  latitude: number;
  longitude: number;
  accuracy?: number | null | undefined;
  branch_id?: number | null | undefined;
  employee_id?: number | null | undefined;
  selfie?: string | null | undefined;
}

export interface AttendancePunchResponse {
  success: boolean;
  action: "Check-in" | "Check-out";
  message: string;
  record: {
    id: number;
    employee: number;
    employee_code: string;
    employee_name: string;
    date: string;
    status: string;
    check_in: string;
    check_out: string;
    hours_worked: string;
    location: string;
    selfie?: string;
    latitude?: number;
    longitude?: number;
  };
  distance_meters: number;
}

export interface TodayAttendanceResponse {
  success: boolean;
  has_punched: boolean;
  record: {
    id: number;
    employee: number;
    employee_code: string;
    employee_name: string;
    date: string;
    status: string;
    check_in: string;
    check_out: string;
    hours_worked: string;
    location: string;
    selfie?: string;
  } | null;
  employee: {
    id: number;
    code: string;
    name: string;
    department_name?: string;
    designation_title?: string;
    shift_start?: string;
    shift_end?: string;
  } | null;
  branch: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
  } | null;
  server_time: string;
}

export const hrApi = {
  getTodayAttendance: async (): Promise<TodayAttendanceResponse> => {
    return api.get<TodayAttendanceResponse>("/hr/attendance/today/");
  },
  punchAttendance: async (payload: AttendancePunchPayload): Promise<AttendancePunchResponse> => {
    return api.post<AttendancePunchResponse>("/hr/attendance/punch/", payload);
  },
  getAppeals: async (params?: { status?: string; employee?: string; date?: string }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.employee) query.set("employee", params.employee);
    if (params?.date) query.set("date", params.date);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return api.get(`/hr/appeals/${qs}`);
  },
  createAppeal: async (payload: {
    punch_type?: string;
    place?: string;
    latitude?: number;
    longitude?: number;
    distance_meters?: number;
    reason: string;
    message: string;
    date?: string;
    time?: string;
    selfie?: string;
  }): Promise<any> => {
    return api.post("/hr/appeals/", payload);
  },
  approveAppeal: async (idOrCode: string | number, note?: string): Promise<any> => {
    return api.post(`/hr/appeals/${idOrCode}/approve/`, { note: note || "" });
  },
  rejectAppeal: async (idOrCode: string | number, note?: string): Promise<any> => {
    return api.post(`/hr/appeals/${idOrCode}/reject/`, { note: note || "" });
  },
};

export const settingsApi = {
  getSection: async <T = Record<string, any>>(section: string): Promise<T> => {
    const res = await api.get<{ id: number; section: string; data: T }>(`/settings/${section}/`);
    return (res?.data || {}) as T;
  },
  updateSection: async <T = Record<string, any>>(section: string, data: T): Promise<{ id: number; section: string; data: T }> => {
    return api.post<{ id: number; section: string; data: T }>("/settings/", { section, data });
  },
  dispatchGstr: async (recipients?: string[]): Promise<{ success: boolean; period: string; recipients: string[]; message: string }> => {
    return api.post("/settings/dispatch-gstr/", recipients ? { recipients } : {});
  },
  dispatchStockAlerts: async (deadStockDays?: number, recipients?: string[]): Promise<{ success: boolean; low_stock_count: number; dead_stock_count: number; message: string }> => {
    return api.post("/settings/dispatch-stock-alerts/", {
      ...(deadStockDays ? { dead_stock_days: deadStockDays } : {}),
      ...(recipients ? { recipients } : {}),
    });
  },
};

export interface SendEmailResponse {
  success: boolean;
  recipient?: string;
  subject?: string;
  message?: string;
  error?: string;
}

export const salesApi = {
  sendInvoiceEmail: async (id: number | string, email?: string): Promise<SendEmailResponse> => {
    return api.post<SendEmailResponse>(`/sales/invoices/${id}/send-email/`, email ? { email } : {});
  },
  sendPaymentReceiptEmail: async (id: number | string, email?: string): Promise<SendEmailResponse> => {
    return api.post<SendEmailResponse>(`/sales/payments/${id}/send-receipt/`, email ? { email } : {});
  },
  convertOrderToInvoice: async (
    id: number | string,
    payload?: { invoice_date?: string; due_date?: string; notes?: string }
  ): Promise<{ success: boolean; created: boolean; invoice: any; message: string }> => {
    return api.post(`/sales/orders/${id}/convert-to-invoice/`, payload || {});
  },
  sendInvoiceReminder: async (id: number | string, email?: string): Promise<SendEmailResponse> => {
    return api.post<SendEmailResponse>(`/sales/invoices/${id}/send-reminder/`, email ? { email } : {});
  },
  sendBatchReminders: async (minBalance: number = 1.0): Promise<{ total_eligible: number; sent_count: number; failed_count: number; results: any[] }> => {
    return api.post(`/sales/invoices/send-batch-reminders/`, { min_balance: minBalance });
  },
};

export interface ExtractedBillData {
  success: boolean;
  supplier: {
    id: number | null;
    name: string;
    gstin: string;
    confidence: number;
  };
  invoice_number: {
    value: string;
    confidence: number;
  };
  bill_date: {
    value: string;
    confidence: number;
  };
  due_date: {
    value: string;
    confidence: number;
  };
  place_of_supply: {
    value: string;
    confidence: number;
  };
  lines: Array<{
    item_id: number | null;
    item_code: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    discount_percentage: number;
    tax_rate: number;
    confidence: number;
  }>;
  document_id: number | null;
  document_url: string | null;
  filename: string;
}

export const purchasesApi = {
  sendPurchaseOrder: async (id: number | string, email?: string): Promise<SendEmailResponse> => {
    return api.post<SendEmailResponse>(`/purchases/orders/${id}/send-po/`, email ? { email } : {});
  },
  sendBillRemittance: async (id: number | string, paymentDetails?: any): Promise<SendEmailResponse> => {
    return api.post<SendEmailResponse>(`/purchases/bills/${id}/send-remittance/`, paymentDetails || {});
  },
  extractBill: async (formData?: FormData): Promise<ExtractedBillData> => {
    return api.post<ExtractedBillData>("/purchases/bills/extract-bill/", formData || new FormData());
  },
  postBill: async (id: number | string): Promise<{ success: boolean; message: string; code: string; stage: string; gl_entry?: string }> => {
    return api.post(`/purchases/bills/${id}/post-bill/`, {});
  },
};


export interface CommunicationStats {
  kpis: {
    scheduled: number;
    sent_delivered: number;
    failed: number;
    cancelled: number;
    active_automations: string;
  };
  chart: { d: string; WhatsApp: number; Email: number }[];
}

export interface BackendMessage {
  id: number;
  code: string;
  channel: "WhatsApp" | "Email";
  direction: "Outbound" | "Inbound";
  recipient_name: string;
  recipient_phone: string;
  recipient_email?: string;
  customer?: number;
  message_type: string;
  trigger_type: string;
  document_reference: string;
  template?: number;
  template_name?: string;
  body: string;
  provider_message_id?: string;
  status: "Draft" | "Scheduled" | "Queued" | "Sending" | "Sent" | "Delivered" | "Read" | "Failed" | "Cancelled";
  scheduled_at?: string;
  dispatched_at?: string;
  delivered_at?: string;
  read_at?: string;
  error_code?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
}

export const communicationApi = {
  getStats: async (): Promise<CommunicationStats> => {
    return api.get<CommunicationStats>("/communication/stats/");
  },
  getMessages: async (params?: { channel?: string; status?: string; type?: string; q?: string }): Promise<{ count: number; results: BackendMessage[] }> => {
    return api.get<{ count: number; results: BackendMessage[] }>("/communication/messages/", { params });
  },
  retryMessage: async (id: number | string): Promise<{ success: boolean; message: string }> => {
    return api.post(`/communication/messages/${id}/retry/`, {});
  },
  cancelMessage: async (id: number | string): Promise<{ success: boolean; message: string }> => {
    return api.post(`/communication/messages/${id}/cancel/`, {});
  },
  composeMessage: async (payload: { phone: string; recipient_name: string; body: string; channel?: string; template_id?: number }): Promise<{ success: boolean; message: string; data?: any }> => {
    return api.post("/communication/messages/compose/", payload);
  },
  getTemplates: async (): Promise<{ count: number; results: any[] }> => {
    return api.get("/communication/templates/");
  },
  saveTemplate: async (template: any): Promise<any> => {
    if (template.id && typeof template.id === "number") {
      return api.patch(`/communication/templates/${template.id}/`, template);
    }
    return api.post("/communication/templates/", template);
  },
  getRules: async (): Promise<{ count: number; results: any[] }> => {
    return api.get("/communication/rules/");
  },
  toggleRule: async (id: number | string): Promise<{ success: boolean; is_active: boolean; name: string }> => {
    return api.post(`/communication/rules/${id}/toggle/`, {});
  },
};

export interface BackendNotification {
  id: string | number;
  cat: "System" | "Low stock" | "Payment" | "Approval" | "Quotation" | "Purchase" | "Employee" | "Automation";
  category?: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  is_read?: boolean;
  when: string;
  created_at?: string;
}

export const notificationsApi = {
  list: async (params?: { category?: string; unread?: boolean }): Promise<BackendNotification[]> => {
    const res = await api.get<{ count: number; results: BackendNotification[] } | BackendNotification[]>("/notifications/", { params });
    if (Array.isArray(res)) return res;
    if (res && Array.isArray((res as any).results)) return (res as any).results;
    return [];
  },
  markRead: async (id: string | number, read: boolean = true): Promise<BackendNotification> => {
    return api.post(`/notifications/${id}/mark-read/`, { read });
  },
  markAllRead: async (): Promise<{ success: boolean; updated_count: number }> => {
    return api.post("/notifications/mark-all-read/", {});
  },
  clearAll: async (): Promise<{ success: boolean; deleted_count: number }> => {
    return api.post("/notifications/clear-all/", {});
  },
  deleteNotification: async (id: string | number): Promise<void> => {
    return api.delete(`/notifications/${id}/`);
  },
  syncAlerts: async (): Promise<{ success: boolean; new_notifications: number }> => {
    return api.post("/notifications/sync-alerts/", {});
  },
};




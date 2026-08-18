import type { Driver, FuelRecord, FuelRecordResult, Inspection, LoginResult, Maintenance, Operator, Page, Reconciliation, Route, Shift, Trip, Vehicle } from "../types";

export interface CreateVehicleRequest { plate_number: string; vehicle_type: string; depot_code: string; capacity_kg: number; odometer_km: number; inspection_due_at: string }
export interface CreateDriverRequest { employee_no: string; name: string; license_class: string; license_expires_at: string }
export interface CertificationRequest { code: string; vehicle_type: string; expires_at: string }
export interface CreateRouteRequest { code: string; name: string; zone: string; required_capacity_kg: number }
export interface CreateShiftRequest { route_id: string; service_date: string; start_at: string; end_at: string }
export interface AssignShiftRequest { shift_id: string; vehicle_id: string }
export interface StartTripRequest { vehicle_id: string; shift_id: string; driver_id: string; driver_name: string; idempotency_key: string; start_odometer: number; load_kg: number }
export interface CreateInspectionRequest { vehicle_id: string; inspector: string; inspected_at: string }
export interface InspectionItemRequest { code: string; result: string; notes: string }
export interface OpenMaintenanceRequest { vehicle_id: string; kind: string; notes: string; due_at: string }
export interface RecordFuelRequest { vehicle_id: string; fuel_type: string; quantity: number; cost_cents: number; odometer_km: number; station_code: string; recorded_at: string }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public requestId = "") { super(message); }
}

const userMessages: Record<string, string> = {
  unavailable: "当前资源不可用，请检查车辆状态、维修记录、驾驶资格和容量条件",
  conflict: "业务状态已发生变化，请刷新后重试",
  unauthorized: "登录状态已失效，请重新登录",
  validation_error: "提交内容不符合业务规则，请检查后重试",
};

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Operator-ID", "operator:web-console");
  const token = localStorage.getItem("sanitation_session");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const body = data as { code?: string; message?: string; request_id?: string };
    if (response.status === 401) localStorage.removeItem("sanitation_session");
    const code = body.code || "HTTP_ERROR";
    const messageKey = body.message === "resource unavailable" ? "unavailable" : code;
    const message = userMessages[messageKey] || body.message || response.statusText;
    throw new ApiError(response.status, code, message, body.request_id);
  }
  return data as T;
}

const query = (params: Record<string, string | number | undefined>) => {
  const values = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value !== undefined && value !== "" && values.set(key, String(value)));
  const encoded = values.toString();
  return encoded ? `?${encoded}` : "";
};
const json = (value: unknown) => JSON.stringify(value);

export const api = {
  login: (username: string, password: string) => request<LoginResult>("/api/v1/auth/login", { method: "POST", body: json({ username, password }) }),
  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }),
  me: () => request<Operator>("/api/v1/auth/me"),
  health: (signal?: AbortSignal) => request<{ status: string }>("/health/ready", { signal }),
  vehicles: (params: Record<string, string | number | undefined> = {}, signal?: AbortSignal) => request<Page<Vehicle>>(`/api/v1/vehicles${query(params)}`, { signal }),
  createVehicle: (body: CreateVehicleRequest) => request<Vehicle>("/api/v1/vehicles", { method: "POST", body: json(body) }),
  drivers: (params: Record<string, string | number | undefined> = {}, signal?: AbortSignal) => request<Page<Driver>>(`/api/v1/drivers${query(params)}`, { signal }),
  createDriver: (body: CreateDriverRequest) => request<Driver>("/api/v1/drivers", { method: "POST", body: json(body) }),
  certifyDriver: (id: string, body: CertificationRequest) => request<Driver>(`/api/v1/drivers/${id}/certifications`, { method: "POST", body: json(body) }),
  suspendDriver: (id: string) => request<Driver>(`/api/v1/drivers/${id}/suspend`, { method: "POST" }),
  reactivateDriver: (id: string) => request<Driver>(`/api/v1/drivers/${id}/reactivate`, { method: "POST" }),
  routes: (signal?: AbortSignal) => request<Page<Route>>("/api/v1/routes?limit=100", { signal }),
  createRoute: (body: CreateRouteRequest) => request<Route>("/api/v1/routes", { method: "POST", body: json(body) }),
  shifts: (params: Record<string, string | number | undefined> = {}, signal?: AbortSignal) => request<Page<Shift>>(`/api/v1/shifts${query({ limit: 100, ...params })}`, { signal }),
  createShift: (body: CreateShiftRequest) => request<Shift>("/api/v1/shifts", { method: "POST", body: json(body) }),
  assignShift: (body: AssignShiftRequest) => request<Shift>("/api/v1/shifts/assign", { method: "POST", body: json(body) }),
  trips: (signal?: AbortSignal) => request<Page<Trip>>("/api/v1/trips?limit=100", { signal }),
  startTrip: (body: StartTripRequest) => request<Trip>("/api/v1/trips/start", { method: "POST", headers: { "Idempotency-Key": body.idempotency_key }, body: json(body) }),
  returnTrip: (id: string, endOdometer: number) => request<Trip>(`/api/v1/trips/${id}/return`, { method: "POST", body: json({ end_odometer: endOdometer }) }),
  inspections: (signal?: AbortSignal) => request<Page<Inspection>>("/api/v1/inspections?limit=100", { signal }),
  createInspection: (body: CreateInspectionRequest) => request<Inspection>("/api/v1/inspections", { method: "POST", body: json(body) }),
  recordInspectionItem: (id: string, body: InspectionItemRequest) => request<Inspection>(`/api/v1/inspections/${id}/items`, { method: "POST", body: json(body) }),
  submitInspection: (id: string) => request<Inspection>(`/api/v1/inspections/${id}/submit`, { method: "POST" }),
  maintenance: (signal?: AbortSignal) => request<Page<Maintenance>>("/api/v1/maintenance?limit=100", { signal }),
  openMaintenance: (body: OpenMaintenanceRequest) => request<Maintenance>("/api/v1/maintenance", { method: "POST", body: json(body) }),
  startMaintenance: (id: string) => request<Maintenance>(`/api/v1/maintenance/${id}/start`, { method: "POST" }),
  completeMaintenance: (id: string) => request<Maintenance>(`/api/v1/maintenance/${id}/complete`, { method: "POST" }),
  fuel: (signal?: AbortSignal) => request<Page<FuelRecord>>("/api/v1/fuel?limit=100", { signal }),
  recordFuel: (body: RecordFuelRequest) => request<FuelRecordResult>("/api/v1/fuel", { method: "POST", body: json(body) }),
  reconciliation: (serviceDate: string, signal?: AbortSignal) => request<Reconciliation>(`/api/v1/reconciliation${query({ service_date: serviceDate })}`, { signal }),
};

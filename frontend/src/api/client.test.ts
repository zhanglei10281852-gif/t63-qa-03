import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, request } from "./client";

describe("typed API client", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends operator and JSON headers and decodes a successful response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "ready" }), { status: 200 }));
    await expect(request<{ status: string }>("/health/ready")).resolves.toEqual({ status: "ready" });
    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Headers).get("Accept")).toBe("application/json");
    expect((init?.headers as Headers).get("X-Operator-ID")).toBe("operator:web-console");
  });

  it("maps the server error contract to ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "conflict", message: "vehicle is busy", request_id: "req-1" }), { status: 409 }));
    await expect(request("/api/v1/vehicles")).rejects.toMatchObject({ status: 409, code: "conflict", requestId: "req-1" });
    try { await request("/api/v1/vehicles"); } catch (error) { expect(error).toBeInstanceOf(ApiError); }
  });

  it("uses a readable business message for unavailable resources", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ code: "conflict", message: "resource unavailable", request_id: "req-2" }), { status: 409 }));
    await expect(request("/api/v1/trips/start")).rejects.toMatchObject({
      code: "conflict",
      message: "当前资源不可用，请检查车辆状态、维修记录、驾驶资格和容量条件",
      requestId: "req-2",
    });
  });

  it("preserves cancellation for a caller-owned AbortSignal", async () => {
    const controller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      expect(init?.signal).toBe(controller.signal);
      return Promise.reject(new DOMException("aborted", "AbortError"));
    });
    await expect(api.vehicles({}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serializes filters and pagination without leaking empty values", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0, limit: 20, offset: 20 }), { status: 200 }));
    await api.vehicles({ limit: 20, offset: 20, status: "available", q: "", depot: undefined });
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/vehicles?limit=20&offset=20&status=available");
  });

  it("uses the registered method and path for every frontend API operation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await api.login("admin", "password");
    await api.logout();
    await api.me();
    await api.health();
    await api.vehicles({ limit: 20, offset: 0 });
    await api.createVehicle({ plate_number: "沪A12345", vehicle_type: "compactor", depot_code: "H-01", capacity_kg: 8000, odometer_km: 0, inspection_due_at: "2027-08-18T00:00:00Z" });
    await api.drivers({ limit: 100 });
    await api.createDriver({ employee_no: "DRV-101", name: "测试驾驶员", license_class: "B2", license_expires_at: "2027-08-18T00:00:00Z" });
    await api.certifyDriver("driver-1", { code: "CERT-101", vehicle_type: "compactor", expires_at: "2027-08-18T00:00:00Z" });
    await api.suspendDriver("driver-1");
    await api.reactivateDriver("driver-1");
    await api.routes();
    await api.createRoute({ code: "H-101", name: "测试路线", zone: "north", required_capacity_kg: 5000 });
    await api.shifts();
    await api.createShift({ route_id: "route-1", service_date: "2026-08-18", start_at: "2026-08-18T00:00:00Z", end_at: "2026-08-18T04:00:00Z" });
    await api.assignShift({ shift_id: "shift-1", vehicle_id: "vehicle-1" });
    await api.trips();
    await api.startTrip({ vehicle_id: "vehicle-1", shift_id: "shift-1", driver_id: "driver-1", driver_name: "测试驾驶员", idempotency_key: "trip-1", start_odometer: 100, load_kg: 0 });
    await api.returnTrip("trip-1", 110);
    await api.inspections();
    await api.createInspection({ vehicle_id: "vehicle-1", inspector: "检查员", inspected_at: "2026-08-18T00:00:00Z" });
    await api.recordInspectionItem("inspection-1", { code: "brakes", result: "pass", notes: "checked" });
    await api.submitInspection("inspection-1");
    await api.maintenance();
    await api.openMaintenance({ vehicle_id: "vehicle-1", kind: "scheduled", notes: "service", due_at: "2026-08-20T00:00:00Z" });
    await api.startMaintenance("maintenance-1");
    await api.completeMaintenance("maintenance-1");
    await api.fuel();
    await api.recordFuel({ vehicle_id: "vehicle-1", fuel_type: "diesel", quantity: 20, cost_cents: 16000, odometer_km: 110, station_code: "H-01", recorded_at: "2026-08-18T00:00:00Z" });
    await api.reconciliation("2026-08-18");

    expect(fetchMock.mock.calls.map(([path, init]) => `${init?.method || "GET"} ${path}`)).toEqual([
      "POST /api/v1/auth/login", "POST /api/v1/auth/logout", "GET /api/v1/auth/me", "GET /health/ready",
      "GET /api/v1/vehicles?limit=20&offset=0", "POST /api/v1/vehicles", "GET /api/v1/drivers?limit=100", "POST /api/v1/drivers",
      "POST /api/v1/drivers/driver-1/certifications", "POST /api/v1/drivers/driver-1/suspend", "POST /api/v1/drivers/driver-1/reactivate",
      "GET /api/v1/routes?limit=100", "POST /api/v1/routes", "GET /api/v1/shifts?limit=100", "POST /api/v1/shifts", "POST /api/v1/shifts/assign",
      "GET /api/v1/trips?limit=100", "POST /api/v1/trips/start", "POST /api/v1/trips/trip-1/return",
      "GET /api/v1/inspections?limit=100", "POST /api/v1/inspections", "POST /api/v1/inspections/inspection-1/items", "POST /api/v1/inspections/inspection-1/submit",
      "GET /api/v1/maintenance?limit=100", "POST /api/v1/maintenance", "POST /api/v1/maintenance/maintenance-1/start", "POST /api/v1/maintenance/maintenance-1/complete",
      "GET /api/v1/fuel?limit=100", "POST /api/v1/fuel", "GET /api/v1/reconciliation?service_date=2026-08-18",
    ]);
  });
});

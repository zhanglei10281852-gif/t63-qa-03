import { shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Antd from "ant-design-vue";
import FleetView from "./FleetView.vue";
import { api } from "../api/client";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, api: { ...actual.api, vehicles: vi.fn(), drivers: vi.fn() } };
});

describe("FleetView", () => {
  beforeEach(() => {
    vi.mocked(api.vehicles).mockResolvedValue({ items: [{ id: "v1", plate_number: "沪环-001", vehicle_type: "compactor", depot_code: "H-01", status: "available", capacity_kg: 9000, odometer_km: 12000, inspection_due_at: "2027-01-01T00:00:00Z", version: 1 }], total: 1, limit: 20, offset: 0 });
    vi.mocked(api.drivers).mockResolvedValue({ items: [{ id: "d1", employee_no: "DRV-01", name: "张师傅", status: "active", license_class: "B2", license_expires_at: "2027-01-01T00:00:00Z", certifications: [], version: 1 }], total: 1, limit: 100, offset: 0 });
  });

  it("renders operational counters and requests server pagination", async () => {
    const wrapper = shallowMount(FleetView, { global: { plugins: [Antd] } });
    await vi.waitFor(() => expect(wrapper.text()).toContain("车辆总数1"));
    expect(wrapper.text()).toContain("车辆总数");
    expect(wrapper.text()).toContain("可用车辆1");
    expect(api.vehicles).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 0 }), expect.any(AbortSignal));
    wrapper.unmount();
  });

  it("keeps stable zero counters before initial requests resolve", () => {
    const wrapper = shallowMount(FleetView, { global: { plugins: [Antd] } });
    expect(wrapper.text()).toContain("车辆总数0");
    expect(wrapper.text()).toContain("驾驶员总数0");
    wrapper.unmount();
  });
});

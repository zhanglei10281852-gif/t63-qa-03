import { describe, expect, it } from "vitest";
import { isValidVehiclePlate, normalizeVehiclePlate } from "./validation";

describe("vehicle plate validation", () => {
  it("normalizes common separators and lowercase letters", () => {
    expect(normalizeVehiclePlate(" 沪a·12345 ")).toBe("沪A12345");
    expect(normalizeVehiclePlate("粤b-d12345")).toBe("粤BD12345");
  });

  it("accepts standard and new-energy plates", () => {
    expect(isValidVehiclePlate("沪A12345")).toBe(true);
    expect(isValidVehiclePlate("粤BD12345")).toBe(true);
    expect(isValidVehiclePlate("京A12345F")).toBe(true);
  });

  it("rejects fleet labels and malformed plates", () => {
    expect(isValidVehiclePlate("沪环-001")).toBe(false);
    expect(isValidVehiclePlate("123123")).toBe(false);
    expect(isValidVehiclePlate("沪A1234")).toBe(false);
  });
});

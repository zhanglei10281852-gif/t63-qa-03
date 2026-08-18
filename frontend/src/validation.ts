const vehiclePlatePattern = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-HJ-NP-Z](?:[A-HJ-NP-Z0-9]{5}|[DF][A-HJ-NP-Z0-9]{5}|[A-HJ-NP-Z0-9]{5}[DF])$/;

export function normalizeVehiclePlate(value: string): string {
  return value.trim().toUpperCase().replace(/[\s\-·.]/g, "");
}

export function isValidVehiclePlate(value: string): boolean {
  return vehiclePlatePattern.test(normalizeVehiclePlate(value));
}

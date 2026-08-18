export interface Page<T> { items: T[]; total: number; limit: number; offset: number }
export interface Vehicle { id: string; plate_number: string; vehicle_type: string; depot_code: string; status: string; capacity_kg: number; odometer_km: number; inspection_due_at: string; version: number }
export interface Certification { id: string; code: string; vehicle_type: string; expires_at: string }
export interface Driver { id: string; employee_no: string; name: string; status: string; license_class: string; license_expires_at: string; certifications: Certification[]; version: number }
export interface Route { id: string; route_code: string; name: string; zone: string; required_capacity_kg: number; status: string }
export interface Shift { id: string; route_id: string; service_date: string; start_at: string; end_at: string; status: string; assigned_vehicle_id?: string; version: number }
export interface Trip { id: string; vehicle_id: string; shift_id: string; driver_id: string; driver_name: string; status: string; start_odometer?: number; end_odometer?: number; load_kg: number; started_at?: string; ended_at?: string }
export interface InspectionItem { id: string; code: string; result: string; notes: string }
export interface Inspection { id: string; vehicle_id: string; inspector: string; status: string; inspected_at: string; expires_at: string; score: number; items: InspectionItem[] }
export interface Maintenance { id: string; vehicle_id: string; kind: string; status: string; due_at: string; notes: string }
export interface FuelRecord { id: string; vehicle_id: string; fuel_type: string; quantity: number; unit: string; cost_cents: number; odometer_km: number; station_code: string; recorded_at: string }
export interface FuelRecordResult { record: FuelRecord; efficiency?: number; has_efficiency: boolean }
export interface Reconciliation { service_date: string; expected_shifts: number; completed_shifts: number; active_trips: number; completed_trips: number; unresolved_incidents: number; open_maintenance: number; healthy: boolean; warnings: string[] }
export interface Operator { id: string; username: string; display_name: string; role: string; status: string }
export interface LoginResult { token: string; expires_at: string; operator: Operator }

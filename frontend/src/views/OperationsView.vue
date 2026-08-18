<template>
  <div class="panel">
    <div class="toolbar"><div><a-typography-title :level="4" style="margin:0">运营执行工作台</a-typography-title><a-typography-text type="secondary">出车、收车、安全检查、维修与能源记录共享同一车辆状态。</a-typography-text></div><a-space><a-date-picker v-model:value="serviceDate" /><a-button @click="reload"><ReloadOutlined />刷新</a-button></a-space></div>
    <a-tabs v-model:active-key="tab">
      <a-tab-pane key="trips" tab="出车与收车">
        <div class="toolbar"><a-alert type="info" show-icon message="只有已分配班次、合格驾驶员和可用车辆才能出车" /><a-button type="primary" @click="openTrip"><SendOutlined />办理出车</a-button></div>
        <a-table :columns="tripColumns" :data-source="trips" :loading="loading" row-key="id" :pagination="false"><template #bodyCell="{ column, record }"><span v-if="column.key === 'vehicle'">{{ vehiclePlate(record.vehicle_id) }}</span><a-tag v-else-if="column.key === 'status'" :color="record.status === 'active' ? 'green' : 'default'">{{ record.status === 'active' ? '执行中' : '已完成' }}</a-tag><span v-else-if="column.key === 'odometer'">{{ record.start_odometer ?? '-' }} / {{ record.end_odometer ?? '-' }}</span><a-button v-else-if="column.key === 'action' && record.status === 'active'" type="link" @click="openReturn(record)">收车</a-button></template></a-table>
      </a-tab-pane>
      <a-tab-pane key="inspections" tab="安全检查">
        <div class="toolbar"><a-typography-text type="secondary">检查需完成制动、灯光、液压、轮胎和安全装备五项后提交。</a-typography-text><a-button type="primary" @click="inspectionOpen = true"><SafetyCertificateOutlined />新建检查</a-button></div>
        <a-table :columns="inspectionColumns" :data-source="inspections" :loading="loading" row-key="id" :pagination="false"><template #bodyCell="{ column, record }"><span v-if="column.key === 'vehicle'">{{ vehiclePlate(record.vehicle_id) }}</span><a-tag v-else-if="column.key === 'status'" :color="record.status === 'passed' ? 'green' : record.status === 'failed' ? 'red' : 'blue'">{{ record.status }}</a-tag><a-progress v-else-if="column.key === 'score'" :percent="record.score" size="small" /><a-button v-else-if="column.key === 'action' && record.status === 'draft'" type="link" @click="openInspectionItems(record)">填写并提交</a-button></template></a-table>
      </a-tab-pane>
      <a-tab-pane key="maintenance" tab="维修与能源">
        <div class="toolbar"><a-space><a-button type="primary" @click="maintenanceOpen = true"><ToolOutlined />新建维修单</a-button><a-button @click="openFuelForm"><ThunderboltOutlined />记录加油/充电</a-button></a-space></div>
        <a-row :gutter="16">
          <a-col :xs="24" :xl="12">
            <a-table :columns="maintenanceColumns" :data-source="maintenance" row-key="id" :pagination="false">
              <template #title>维修工单</template>
              <template #bodyCell="{ column, record }"><span v-if="column.key === 'vehicle'">{{ vehiclePlate(record.vehicle_id) }}</span><a-tag v-else-if="column.key === 'status'" :color="record.status === 'completed' ? 'green' : 'orange'">{{ record.status }}</a-tag><a-space v-else-if="column.key === 'action'"><a-button v-if="record.status === 'open'" type="link" @click="startMaintenance(record)">开工</a-button><a-button v-if="record.status === 'in_progress'" type="link" @click="completeMaintenance(record)">完工</a-button></a-space></template>
            </a-table>
          </a-col>
          <a-col :xs="24" :xl="12">
            <a-table :columns="fuelColumns" :data-source="fuel" row-key="id" :pagination="false">
              <template #title>能源记录</template>
              <template #bodyCell="{ column, record }"><span v-if="column.key === 'vehicle'">{{ vehiclePlate(record.vehicle_id) }}</span></template>
            </a-table>
          </a-col>
        </a-row>
      </a-tab-pane>
      <a-tab-pane key="reconciliation" tab="日结核对">
        <a-result v-if="reconciliation" :status="reconciliation.healthy ? 'success' : 'warning'" :title="reconciliation.healthy ? '业务日核对通过' : '业务日存在待处理项'" :sub-title="reconciliation.service_date"><template #extra><a-descriptions bordered :column="3"><a-descriptions-item label="计划班次">{{ reconciliation.expected_shifts }}</a-descriptions-item><a-descriptions-item label="完成班次">{{ reconciliation.completed_shifts }}</a-descriptions-item><a-descriptions-item label="执行中车辆">{{ reconciliation.active_trips }}</a-descriptions-item><a-descriptions-item label="完成行程">{{ reconciliation.completed_trips }}</a-descriptions-item><a-descriptions-item label="未结事故">{{ reconciliation.unresolved_incidents }}</a-descriptions-item><a-descriptions-item label="未结维修">{{ reconciliation.open_maintenance }}</a-descriptions-item></a-descriptions><a-alert v-for="warning in reconciliation.warnings" :key="warning" type="warning" show-icon :message="warning" style="margin-top:12px" /></template></a-result>
      </a-tab-pane>
    </a-tabs>
  </div>

  <a-modal v-model:open="tripOpen" title="办理出车" :confirm-loading="saving" @ok="startTrip">
    <a-form layout="vertical">
      <a-form-item label="已分配班次"><a-select v-model:value="tripForm.shift_id" placeholder="选择待出车班次" @change="selectShift"><a-select-option v-for="item in assignedShifts" :key="item.id" :value="item.id">{{ item.service_date }} · {{ routeName(item.route_id) }} · {{ item.id }}</a-select-option></a-select></a-form-item>
      <a-alert v-if="selectedRoute && selectedVehicle" type="info" show-icon :message="`${selectedVehicle.plate_number} · ${selectedVehicle.vehicle_type}`" :description="`路线要求车辆额定载重至少 ${selectedRoute.required_capacity_kg.toLocaleString()} kg；本车上限 ${selectedVehicle.capacity_kg.toLocaleString()} kg`" style="margin-bottom:16px" />
      <a-form-item label="已分配车辆"><a-select v-model:value="tripForm.vehicle_id" disabled placeholder="选择班次后自动带出"><a-select-option v-if="selectedVehicle" :value="selectedVehicle.id">{{ selectedVehicle.plate_number }} · {{ statusText(selectedVehicle.status) }}</a-select-option></a-select></a-form-item>
      <a-form-item label="驾驶员"><a-select v-model:value="tripForm.driver_id" placeholder="选择在岗且持证驾驶员" @change="selectDriver"><a-select-option v-for="item in eligibleDrivers" :key="item.id" :value="item.id">{{ item.name }} · {{ item.license_class }}</a-select-option></a-select></a-form-item>
      <a-row :gutter="12"><a-col :span="12"><a-form-item label="起始里程"><a-input-number v-model:value="tripForm.start_odometer" :min="selectedVehicle?.odometer_km || 0" style="width:100%" /></a-form-item></a-col><a-col :span="12"><a-form-item label="出车装载 (kg)"><a-input-number v-model:value="tripForm.load_kg" :min="0" :max="selectedVehicle?.capacity_kg" style="width:100%" /></a-form-item></a-col></a-row>
      <a-form-item label="幂等业务号"><a-input v-model:value="tripForm.idempotency_key" /></a-form-item>
    </a-form>
  </a-modal>
  <a-modal v-model:open="returnOpen" title="办理收车" :confirm-loading="saving" @ok="returnTrip"><a-form layout="vertical"><a-form-item label="结束里程"><a-input-number v-model:value="endOdometer" :min="selectedTrip?.start_odometer || 0" style="width:100%" /></a-form-item></a-form></a-modal>
  <a-modal v-model:open="inspectionOpen" title="新建安全检查" :confirm-loading="saving" @ok="createInspection"><a-form layout="vertical"><a-form-item label="车辆"><a-select v-model:value="inspectionForm.vehicle_id"><a-select-option v-for="item in vehicles" :key="item.id" :value="item.id">{{ item.plate_number }}</a-select-option></a-select></a-form-item><a-form-item label="检查员"><a-input v-model:value="inspectionForm.inspector" /></a-form-item><a-form-item label="检查时间"><a-date-picker v-model:value="inspectionForm.inspected_at" show-time style="width:100%" /></a-form-item></a-form></a-modal>
  <a-drawer v-model:open="itemOpen" title="填写检查项目" :width="480"><a-form layout="vertical"><a-form-item v-for="item in inspectionItems" :key="item.code" :label="item.label"><a-radio-group v-model:value="item.result"><a-radio-button value="pass">通过</a-radio-button><a-radio-button value="fail">不通过</a-radio-button><a-radio-button value="not_applicable">不适用</a-radio-button></a-radio-group><a-input v-model:value="item.notes" placeholder="备注" style="margin-top:8px" /></a-form-item><a-button type="primary" block :loading="saving" @click="submitInspection">保存并提交</a-button></a-form></a-drawer>
  <a-modal v-model:open="maintenanceOpen" title="新建维修单" :confirm-loading="saving" @ok="openMaintenance"><a-form layout="vertical"><a-form-item label="车辆"><a-select v-model:value="maintenanceForm.vehicle_id"><a-select-option v-for="item in vehicles" :key="item.id" :value="item.id">{{ item.plate_number }}</a-select-option></a-select></a-form-item><a-form-item label="维修类型"><a-select v-model:value="maintenanceForm.kind"><a-select-option value="scheduled">计划保养</a-select-option><a-select-option value="corrective">故障维修</a-select-option><a-select-option value="safety">安全整改</a-select-option></a-select></a-form-item><a-form-item label="说明"><a-textarea v-model:value="maintenanceForm.notes" /></a-form-item><a-form-item label="要求完成时间"><a-date-picker v-model:value="maintenanceForm.due_at" show-time style="width:100%" /></a-form-item></a-form></a-modal>
  <a-modal v-model:open="fuelOpen" title="记录能源补给" :confirm-loading="saving" @ok="recordFuel"><a-form layout="vertical"><a-form-item label="车辆"><a-select v-model:value="fuelForm.vehicle_id" placeholder="选择车辆" @change="selectFuelVehicle"><a-select-option v-for="item in vehicles" :key="item.id" :value="item.id">{{ item.plate_number }}</a-select-option></a-select></a-form-item><a-row :gutter="12"><a-col :span="12"><a-form-item label="能源类型"><a-select v-model:value="fuelForm.fuel_type"><a-select-option value="diesel">柴油</a-select-option><a-select-option value="gasoline">汽油</a-select-option><a-select-option value="electric">充电</a-select-option></a-select></a-form-item></a-col><a-col :span="12"><a-form-item label="数量"><a-input-number v-model:value="fuelForm.quantity" :min="0.1" :step="0.1" style="width:100%" /></a-form-item></a-col></a-row><a-row :gutter="12"><a-col :span="12"><a-form-item label="金额 (分)"><a-input-number v-model:value="fuelForm.cost_cents" :min="0" style="width:100%" /></a-form-item></a-col><a-col :span="12"><a-form-item label="里程"><a-input-number v-model:value="fuelForm.odometer_km" :min="selectedFuelVehicle?.odometer_km || 0" style="width:100%" /></a-form-item></a-col></a-row><a-form-item label="站点编号"><a-input v-model:value="fuelForm.station_code" /></a-form-item></a-form></a-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { message } from "ant-design-vue";
import { ReloadOutlined, SafetyCertificateOutlined, SendOutlined, ThunderboltOutlined, ToolOutlined } from "@ant-design/icons-vue";
import dayjs, { type Dayjs } from "dayjs";
import { api } from "../api/client";
import type { Driver, FuelRecord, Inspection, Maintenance, Reconciliation, Route, Shift, Trip, Vehicle } from "../types";

const tab = ref("trips"); const loading = ref(false); const saving = ref(false); const serviceDate = ref(dayjs());
const vehicles = ref<Vehicle[]>([]); const drivers = ref<Driver[]>([]); const routes = ref<Route[]>([]); const shifts = ref<Shift[]>([]); const trips = ref<Trip[]>([]); const inspections = ref<Inspection[]>([]); const maintenance = ref<Maintenance[]>([]); const fuel = ref<FuelRecord[]>([]); const reconciliation = ref<Reconciliation>();
const tripOpen = ref(false); const returnOpen = ref(false); const inspectionOpen = ref(false); const itemOpen = ref(false); const maintenanceOpen = ref(false); const fuelOpen = ref(false);
const selectedTrip = ref<Trip>(); const selectedInspection = ref<Inspection>(); const endOdometer = ref(0);
const tripForm = reactive({ vehicle_id: "", shift_id: "", driver_id: "", driver_name: "", idempotency_key: `WEB-${Date.now()}`, start_odometer: 0, load_kg: 0 });
const inspectionForm = reactive({ vehicle_id: "", inspector: "", inspected_at: dayjs() as Dayjs });
const maintenanceForm = reactive({ vehicle_id: "", kind: "scheduled", notes: "", due_at: dayjs().add(3, "day") as Dayjs });
const fuelForm = reactive({ vehicle_id: "", fuel_type: "diesel", quantity: 50, cost_cents: 40000, odometer_km: 0, station_code: "H-01", recorded_at: dayjs() as Dayjs });
const inspectionItems = reactive([{ code: "brakes", label: "制动系统", result: "pass", notes: "" }, { code: "lights", label: "灯光信号", result: "pass", notes: "" }, { code: "hydraulics", label: "液压系统", result: "pass", notes: "" }, { code: "tires", label: "轮胎", result: "pass", notes: "" }, { code: "safety_kit", label: "安全装备", result: "pass", notes: "" }]);
const assignedShifts = computed(() => shifts.value.filter(item => item.status === "assigned"));
const selectedShift = computed(() => shifts.value.find(item => item.id === tripForm.shift_id));
const selectedVehicle = computed(() => vehicles.value.find(item => item.id === selectedShift.value?.assigned_vehicle_id));
const selectedFuelVehicle = computed(() => vehicles.value.find(item => item.id === fuelForm.vehicle_id));
const selectedRoute = computed(() => routes.value.find(item => item.id === selectedShift.value?.route_id));
const eligibleDrivers = computed(() => drivers.value.filter(item => item.status === "active" && (!selectedVehicle.value || item.certifications.some(certification => certification.vehicle_type === selectedVehicle.value?.vehicle_type && dayjs(certification.expires_at).isAfter(dayjs())))));
const tripColumns = [{ title: "行程", dataIndex: "id" }, { title: "车辆", key: "vehicle" }, { title: "驾驶员", dataIndex: "driver_name" }, { title: "状态", key: "status" }, { title: "装载 kg", dataIndex: "load_kg" }, { title: "起/止里程", key: "odometer" }, { title: "操作", key: "action" }];
const inspectionColumns = [{ title: "检查号", dataIndex: "id" }, { title: "车辆", key: "vehicle" }, { title: "检查员", dataIndex: "inspector" }, { title: "状态", key: "status" }, { title: "得分", key: "score" }, { title: "操作", key: "action" }];
const maintenanceColumns = [{ title: "车辆", key: "vehicle" }, { title: "类型", dataIndex: "kind" }, { title: "状态", key: "status" }, { title: "操作", key: "action" }];
const fuelColumns = [{ title: "车辆", key: "vehicle" }, { title: "类型", dataIndex: "fuel_type" }, { title: "数量", dataIndex: "quantity" }, { title: "里程", dataIndex: "odometer_km" }];
const reload = async () => { loading.value = true; try { const [vehiclePage, driverPage, routePage, shiftPage, tripPage, inspectionPage, maintenancePage, fuelPage, report] = await Promise.all([api.vehicles({ limit: 100 }), api.drivers({ limit: 100 }), api.routes(), api.shifts(), api.trips(), api.inspections(), api.maintenance(), api.fuel(), api.reconciliation(serviceDate.value.format("YYYY-MM-DD"))]); vehicles.value = vehiclePage.items; drivers.value = driverPage.items; routes.value = routePage.items; shifts.value = shiftPage.items; trips.value = tripPage.items; inspections.value = inspectionPage.items; maintenance.value = maintenancePage.items; fuel.value = fuelPage.items; reconciliation.value = report; } catch (error) { message.error(error instanceof Error ? error.message : "加载失败"); } finally { loading.value = false; } };
const openTrip = () => { tripForm.shift_id = ""; tripForm.vehicle_id = ""; tripForm.driver_id = ""; tripForm.driver_name = ""; tripForm.start_odometer = 0; tripForm.load_kg = 0; tripForm.idempotency_key = `WEB-${Date.now()}`; tripOpen.value = true; };
const selectShift = (id: string) => { const shift = shifts.value.find(item => item.id === id); const vehicle = vehicles.value.find(item => item.id === shift?.assigned_vehicle_id); tripForm.vehicle_id = vehicle?.id || ""; tripForm.start_odometer = vehicle?.odometer_km || 0; tripForm.driver_id = ""; tripForm.driver_name = ""; };
const selectDriver = (id: string) => { tripForm.driver_name = drivers.value.find(item => item.id === id)?.name || ""; };
const routeName = (id: string) => routes.value.find(item => item.id === id)?.name || id;
const vehiclePlate = (id?: string) => vehicles.value.find(item => item.id === id)?.plate_number || "未分配";
const statusText = (value: string) => ({ available: "可用", on_duty: "出车中", maintenance: "维修中" }[value] || value);
const openFuelForm = () => { fuelForm.vehicle_id = ""; fuelForm.odometer_km = 0; fuelForm.recorded_at = dayjs(); fuelOpen.value = true; };
const selectFuelVehicle = (id: string) => { fuelForm.odometer_km = vehicles.value.find(item => item.id === id)?.odometer_km || 0; };
const startTrip = async () => { if (!tripForm.vehicle_id || !tripForm.shift_id || !tripForm.driver_id) return message.warning("请选择班次、车辆和驾驶员"); saving.value = true; try { await api.startTrip(tripForm); message.success("出车成功"); tripOpen.value = false; tripForm.idempotency_key = `WEB-${Date.now()}`; await reload(); } catch (error) { message.error(error instanceof Error ? error.message : "出车失败"); } finally { saving.value = false; } };
const openReturn = (value: Trip) => { selectedTrip.value = value; endOdometer.value = value.start_odometer || 0; returnOpen.value = true; };
const returnTrip = async () => { if (!selectedTrip.value) return; saving.value = true; try { await api.returnTrip(selectedTrip.value.id, endOdometer.value); message.success("收车成功"); returnOpen.value = false; await reload(); } catch (error) { message.error(error instanceof Error ? error.message : "收车失败"); } finally { saving.value = false; } };
const createInspection = async () => { if (!inspectionForm.vehicle_id || !inspectionForm.inspector) return message.warning("请完整填写检查信息"); saving.value = true; try { await api.createInspection({ ...inspectionForm, inspected_at: inspectionForm.inspected_at.toISOString() }); message.success("检查已创建"); inspectionOpen.value = false; await reload(); } catch (error) { message.error(error instanceof Error ? error.message : "创建失败"); } finally { saving.value = false; } };
const openInspectionItems = (value: Inspection) => { selectedInspection.value = value; itemOpen.value = true; };
const submitInspection = async () => { if (!selectedInspection.value) return; saving.value = true; try { for (const item of inspectionItems) await api.recordInspectionItem(selectedInspection.value.id, { code: item.code, result: item.result, notes: item.notes }); await api.submitInspection(selectedInspection.value.id); message.success("检查已提交"); itemOpen.value = false; await reload(); } catch (error) { message.error(error instanceof Error ? error.message : "提交失败"); } finally { saving.value = false; } };
const openMaintenance = async () => { if (!maintenanceForm.vehicle_id) return message.warning("请选择车辆"); saving.value = true; try { await api.openMaintenance({ ...maintenanceForm, due_at: maintenanceForm.due_at.toISOString() }); message.success("维修单已创建"); maintenanceOpen.value = false; await reload(); } catch (error) { message.error(error instanceof Error ? error.message : "创建失败"); } finally { saving.value = false; } };
const startMaintenance = async (value: Maintenance) => { try { await api.startMaintenance(value.id); await reload(); } catch (error) { message.error(error instanceof Error ? error.message : "操作失败"); } };
const completeMaintenance = async (value: Maintenance) => { try { await api.completeMaintenance(value.id); await reload(); } catch (error) { message.error(error instanceof Error ? error.message : "操作失败"); } };
const recordFuel = async () => { if (!fuelForm.vehicle_id) return message.warning("请选择车辆"); saving.value = true; try { await api.recordFuel({ ...fuelForm, recorded_at: fuelForm.recorded_at.toISOString() }); message.success("能源记录已保存"); fuelOpen.value = false; await reload(); } catch (error) { message.error(error instanceof Error ? error.message : "保存失败"); } finally { saving.value = false; } };
onMounted(reload);
</script>

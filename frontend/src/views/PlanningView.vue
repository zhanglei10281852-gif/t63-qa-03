<template>
  <div class="panel">
    <div class="toolbar"><div><a-typography-title :level="4" style="margin:0">路线与班次</a-typography-title><a-typography-text type="secondary">先创建服务路线，再安排班次并绑定车辆。冲突由后端事务校验。</a-typography-text></div><a-space><a-button @click="reload"><ReloadOutlined />刷新</a-button><a-button @click="routeOpen = true"><PlusOutlined />新增路线</a-button><a-button type="primary" @click="shiftOpen = true"><ScheduleOutlined />新增班次</a-button></a-space></div>
    <a-tabs v-model:active-key="tab">
      <a-tab-pane key="shifts" tab="班次排班">
        <a-table :columns="shiftColumns" :data-source="shifts" :loading="loading" row-key="id" :pagination="false">
          <template #bodyCell="{ column, record }"><span v-if="column.key === 'route'">{{ routeName(record.route_id) }}</span><span v-else-if="column.key === 'vehicle'">{{ vehiclePlate(record.assigned_vehicle_id) }}</span><a-tag v-else-if="column.key === 'status'" :color="shiftColor(record.status)">{{ shiftText(record.status) }}</a-tag><span v-else-if="column.key === 'window'">{{ format(record.start_at) }} - {{ format(record.end_at) }}</span><a-button v-else-if="column.key === 'action' && record.status === 'scheduled'" type="link" @click="openAssign(record)">分配车辆</a-button><span v-else-if="column.key === 'action'">已处理</span></template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="routes" tab="路线目录"><a-table :columns="routeColumns" :data-source="routes" :loading="loading" row-key="id" :pagination="false"><template #bodyCell="{ column, record }"><a-tag v-if="column.key === 'status'" color="green">运营中</a-tag><span v-else-if="column.key === 'capacity'">{{ record.required_capacity_kg.toLocaleString() }} kg</span></template></a-table></a-tab-pane>
    </a-tabs>
  </div>

  <a-modal v-model:open="routeOpen" title="新增服务路线" :confirm-loading="saving" @ok="createRoute">
    <a-form ref="routeFormRef" :model="routeForm" :rules="rules" layout="vertical"><a-form-item label="路线编号" name="code"><a-input v-model:value="routeForm.code" placeholder="如 H-002" /></a-form-item><a-form-item label="路线名称" name="name"><a-input v-model:value="routeForm.name" /></a-form-item><a-form-item label="作业片区" name="zone"><a-input v-model:value="routeForm.zone" /></a-form-item><a-form-item label="车辆最低额定载重 (kg)" name="required_capacity_kg"><a-input-number v-model:value="routeForm.required_capacity_kg" :min="1" style="width:100%" /></a-form-item></a-form>
  </a-modal>
  <a-modal v-model:open="shiftOpen" title="新增班次" :confirm-loading="saving" @ok="createShift">
    <a-form ref="shiftFormRef" :model="shiftForm" :rules="rules" layout="vertical"><a-form-item label="服务路线" name="route_id"><a-select v-model:value="shiftForm.route_id" placeholder="选择路线"><a-select-option v-for="item in routes" :key="item.id" :value="item.id">{{ item.route_code }} · {{ item.name }}</a-select-option></a-select></a-form-item><a-form-item label="服务日期" name="service_date"><a-date-picker v-model:value="shiftForm.service_date" style="width:100%" /></a-form-item><a-row :gutter="12"><a-col :span="12"><a-form-item label="开始时间" name="start_at"><a-time-picker v-model:value="shiftForm.start_at" format="HH:mm" style="width:100%" /></a-form-item></a-col><a-col :span="12"><a-form-item label="结束时间" name="end_at"><a-time-picker v-model:value="shiftForm.end_at" format="HH:mm" style="width:100%" /></a-form-item></a-col></a-row></a-form>
  </a-modal>
  <a-modal v-model:open="assignOpen" title="分配车辆" :confirm-loading="saving" @ok="assignShift"><a-alert type="warning" show-icon message="分配会检查载重、年检、维修和时间冲突" style="margin-bottom:16px" /><a-form layout="vertical"><a-form-item label="车辆"><a-select v-model:value="assignVehicle" placeholder="选择可用车辆"><a-select-option v-for="vehicle in availableVehicles" :key="vehicle.id" :value="vehicle.id">{{ vehicle.plate_number }} · {{ vehicle.capacity_kg }} kg</a-select-option></a-select></a-form-item></a-form></a-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { message, type FormInstance } from "ant-design-vue";
import { CalendarOutlined as ScheduleOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons-vue";
import dayjs, { type Dayjs } from "dayjs";
import { api } from "../api/client";
import type { Route, Shift, Vehicle } from "../types";

const tab = ref("shifts"); const loading = ref(false); const saving = ref(false); const routeOpen = ref(false); const shiftOpen = ref(false); const assignOpen = ref(false); const assignVehicle = ref(""); const selectedShift = ref<Shift>();
const routes = ref<Route[]>([]); const shifts = ref<Shift[]>([]); const vehicles = ref<Vehicle[]>([]); const routeFormRef = ref<FormInstance>(); const shiftFormRef = ref<FormInstance>();
const routeForm = reactive({ code: "", name: "", zone: "", required_capacity_kg: 5000 });
const shiftForm = reactive({ route_id: "", service_date: dayjs(), start_at: dayjs().hour(6).minute(0), end_at: dayjs().hour(10).minute(0) });
const rules = { code: [{ required: true, message: "此项为必填项" }], name: [{ required: true, message: "此项为必填项" }], zone: [{ required: true, message: "此项为必填项" }], required_capacity_kg: [{ required: true, message: "此项为必填项" }], route_id: [{ required: true, message: "此项为必填项" }], service_date: [{ required: true, message: "此项为必填项" }], start_at: [{ required: true, message: "此项为必填项" }], end_at: [{ required: true, message: "此项为必填项" }] };
const routeColumns = [{ title: "编号", dataIndex: "route_code" }, { title: "路线", dataIndex: "name" }, { title: "片区", dataIndex: "zone" }, { title: "车辆最低额定载重", key: "capacity" }, { title: "状态", key: "status" }];
const shiftColumns = [{ title: "服务日期", dataIndex: "service_date" }, { title: "路线", key: "route" }, { title: "时间窗口", key: "window" }, { title: "状态", key: "status" }, { title: "车辆", key: "vehicle" }, { title: "操作", key: "action" }];
const availableVehicles = computed(() => vehicles.value.filter(v => v.status === "available"));
const format = (value: string) => dayjs(value).format("MM-DD HH:mm");
const routeName = (id: string) => routes.value.find(item => item.id === id)?.name || id;
const vehiclePlate = (id?: string) => vehicles.value.find(item => item.id === id)?.plate_number || "未分配";
const shiftColor = (value: string) => ({ scheduled: "blue", assigned: "cyan", in_progress: "green", completed: "default" }[value] || "orange");
const shiftText = (value: string) => ({ scheduled: "待分配", assigned: "已分配", in_progress: "执行中", completed: "已完成" }[value] || value);
const reload = async () => { loading.value = true; try { const [routePage, shiftPage, vehiclePage] = await Promise.all([api.routes(), api.shifts(), api.vehicles({ limit: 100 })]); routes.value = routePage.items; shifts.value = shiftPage.items; vehicles.value = vehiclePage.items; } catch (error) { message.error(error instanceof Error ? error.message : "加载失败"); } finally { loading.value = false; } };
const createRoute = async () => { try { await routeFormRef.value?.validate(); saving.value = true; await api.createRoute({ code: routeForm.code, name: routeForm.name, zone: routeForm.zone, required_capacity_kg: routeForm.required_capacity_kg }); message.success("路线已创建"); routeOpen.value = false; await reload(); } catch (error) { message.error(error instanceof Error ? error.message : "创建失败"); } finally { saving.value = false; } };
const createShift = async () => { try { await shiftFormRef.value?.validate(); saving.value = true; const date = shiftForm.service_date.format("YYYY-MM-DD"); const start = shiftForm.service_date.hour(shiftForm.start_at.hour()).minute(shiftForm.start_at.minute()).second(0); const end = shiftForm.service_date.hour(shiftForm.end_at.hour()).minute(shiftForm.end_at.minute()).second(0); await api.createShift({ route_id: shiftForm.route_id, service_date: date, start_at: start.toISOString(), end_at: end.toISOString() }); message.success("班次已创建"); shiftOpen.value = false; await reload(); } catch (error) { message.error(error instanceof Error ? error.message : "创建失败"); } finally { saving.value = false; } };
const openAssign = (shift: Shift) => { selectedShift.value = shift; assignVehicle.value = ""; assignOpen.value = true; };
const assignShift = async () => { if (!selectedShift.value || !assignVehicle.value) return message.warning("请选择车辆"); saving.value = true; try { await api.assignShift({ shift_id: selectedShift.value.id, vehicle_id: assignVehicle.value }); message.success("车辆已分配"); assignOpen.value = false; await reload(); } catch (error) { message.error(error instanceof Error ? error.message : "分配失败"); } finally { saving.value = false; } };
onMounted(reload);
</script>

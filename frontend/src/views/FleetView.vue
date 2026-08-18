<template>
  <div class="status-grid">
    <div class="metric">车辆总数<strong>{{ vehiclePage.total }}</strong></div>
    <div class="metric">可用车辆<strong>{{ availableCount }}</strong></div>
    <div class="metric">驾驶员总数<strong>{{ driverPage.total }}</strong></div>
    <div class="metric">在岗驾驶员<strong>{{ activeDrivers }}</strong></div>
  </div>
  <div class="panel">
    <a-tabs v-model:active-key="activeTab">
      <a-tab-pane key="vehicles" tab="车辆台账">
        <div class="toolbar">
          <a-space><a-input-search v-model:value="vehicleQuery" placeholder="车牌、车型或车场" allow-clear @search="() => loadVehicles(1)" /><a-select v-model:value="vehicleStatus" allow-clear placeholder="状态" style="width: 130px" @change="() => loadVehicles(1)"><a-select-option value="available">可用</a-select-option><a-select-option value="on_duty">出车中</a-select-option><a-select-option value="maintenance">维修中</a-select-option></a-select></a-space>
          <a-space><a-button @click="() => loadVehicles(1)"><ReloadOutlined />刷新</a-button><a-button type="primary" @click="vehicleOpen = true"><PlusOutlined />新增车辆</a-button></a-space>
        </div>
        <a-table :columns="vehicleColumns" :data-source="vehiclePage.items" :loading="loadingVehicles" row-key="id" :pagination="vehiclePagination" @change="changeVehiclePage">
          <template #bodyCell="{ column, record }">
            <a-tag v-if="column.key === 'status'" :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
            <span v-else-if="column.key === 'inspection_due_at'">{{ formatDate(record.inspection_due_at) }}</span>
          </template>
        </a-table>
      </a-tab-pane>
      <a-tab-pane key="drivers" tab="驾驶员与资格">
        <div class="toolbar"><a-select v-model:value="driverStatus" allow-clear placeholder="人员状态" style="width: 150px" @change="loadDrivers"><a-select-option value="active">在岗</a-select-option><a-select-option value="suspended">停岗</a-select-option></a-select><a-space><a-button @click="loadDrivers"><ReloadOutlined />刷新</a-button><a-button type="primary" @click="driverOpen = true"><UserAddOutlined />新增驾驶员</a-button></a-space></div>
        <a-table :columns="driverColumns" :data-source="driverPage.items" :loading="loadingDrivers" row-key="id" :pagination="false">
          <template #bodyCell="{ column, record }">
            <a-tag v-if="column.key === 'status'" :color="record.status === 'active' ? 'green' : 'orange'">{{ statusText(record.status) }}</a-tag>
            <span v-else-if="column.key === 'certifications'">{{ record.certifications.map((item: Certification) => item.vehicle_type).join('、') || '暂无' }}</span>
            <a-space v-else-if="column.key === 'action'">
              <a-button type="link" @click="openCertification(record)">维护资格</a-button>
              <a-popconfirm v-if="record.status === 'active'" title="确认暂停该驾驶员排班资格？" @confirm="toggleDriver(record)"><a-button type="link" danger>停岗</a-button></a-popconfirm>
              <a-button v-else type="link" @click="toggleDriver(record)">复岗</a-button>
            </a-space>
          </template>
        </a-table>
      </a-tab-pane>
    </a-tabs>
  </div>

  <a-modal v-model:open="vehicleOpen" title="新增车辆" :confirm-loading="saving" @ok="createVehicle">
    <a-form ref="vehicleFormRef" :model="vehicleForm" :rules="vehicleRules" layout="vertical">
      <a-row :gutter="12"><a-col :span="12"><a-form-item label="车牌号" name="plate_number" extra="普通车牌如沪A12345，新能源车牌如沪AD12345"><a-input v-model:value="vehicleForm.plate_number" placeholder="沪A12345" @blur="normalizePlateInput" /></a-form-item></a-col><a-col :span="12"><a-form-item label="车型" name="vehicle_type"><a-select v-model:value="vehicleForm.vehicle_type"><a-select-option value="compactor">压缩车</a-select-option><a-select-option value="sweeper">清扫车</a-select-option><a-select-option value="electric">新能源车</a-select-option></a-select></a-form-item></a-col></a-row>
      <a-row :gutter="12"><a-col :span="12"><a-form-item label="车场" name="depot_code"><a-input v-model:value="vehicleForm.depot_code" /></a-form-item></a-col><a-col :span="12"><a-form-item label="载重 (kg)" name="capacity_kg"><a-input-number v-model:value="vehicleForm.capacity_kg" :min="1000" style="width:100%" /></a-form-item></a-col></a-row>
      <a-row :gutter="12"><a-col :span="12"><a-form-item label="当前里程" name="odometer_km"><a-input-number v-model:value="vehicleForm.odometer_km" :min="0" style="width:100%" /></a-form-item></a-col><a-col :span="12"><a-form-item label="年检有效期" name="inspection_due_at"><a-date-picker v-model:value="vehicleForm.inspection_due_at" show-time style="width:100%" /></a-form-item></a-col></a-row>
    </a-form>
  </a-modal>

  <a-modal v-model:open="driverOpen" title="新增驾驶员" :confirm-loading="saving" @ok="createDriver">
    <a-form ref="driverFormRef" :model="driverForm" :rules="driverRules" layout="vertical">
      <a-form-item label="工号" name="employee_no"><a-input v-model:value="driverForm.employee_no" /></a-form-item>
      <a-form-item label="姓名" name="name"><a-input v-model:value="driverForm.name" /></a-form-item>
      <a-row :gutter="12"><a-col :span="12"><a-form-item label="驾照等级" name="license_class"><a-select v-model:value="driverForm.license_class"><a-select-option value="B2">B2</a-select-option><a-select-option value="A2">A2</a-select-option></a-select></a-form-item></a-col><a-col :span="12"><a-form-item label="驾照有效期" name="license_expires_at"><a-date-picker v-model:value="driverForm.license_expires_at" style="width:100%" /></a-form-item></a-col></a-row>
    </a-form>
  </a-modal>

  <a-drawer v-model:open="certificationOpen" title="维护车辆操作资格" :width="420">
    <a-alert type="info" show-icon :message="selectedDriver ? `${selectedDriver.name} · ${selectedDriver.employee_no}` : ''" style="margin-bottom:16px" />
    <a-form :model="certificationForm" layout="vertical">
      <a-form-item label="资格编号"><a-input v-model:value="certificationForm.code" /></a-form-item>
      <a-form-item label="准驾车型"><a-select v-model:value="certificationForm.vehicle_type"><a-select-option value="compactor">压缩车</a-select-option><a-select-option value="sweeper">清扫车</a-select-option><a-select-option value="electric">新能源车</a-select-option></a-select></a-form-item>
      <a-form-item label="有效期"><a-date-picker v-model:value="certificationForm.expires_at" style="width:100%" /></a-form-item>
      <a-button type="primary" block :loading="saving" @click="saveCertification">保存资格</a-button>
    </a-form>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { message, type FormInstance } from "ant-design-vue";
import { PlusOutlined, ReloadOutlined, UserAddOutlined } from "@ant-design/icons-vue";
import dayjs, { type Dayjs } from "dayjs";
import { ApiError, api } from "../api/client";
import type { Certification, Driver, Page, Vehicle } from "../types";
import { isValidVehiclePlate, normalizeVehiclePlate } from "../validation";

const emptyPage = <T,>(): Page<T> => ({ items: [], total: 0, limit: 20, offset: 0 });
const activeTab = ref("vehicles");
const vehiclePage = ref<Page<Vehicle>>(emptyPage());
const driverPage = ref<Page<Driver>>(emptyPage());
const loadingVehicles = ref(false); const loadingDrivers = ref(false); const saving = ref(false);
const vehicleQuery = ref(""); const vehicleStatus = ref<string>(); const driverStatus = ref<string>();
const vehicleOpen = ref(false); const driverOpen = ref(false); const certificationOpen = ref(false);
const selectedDriver = ref<Driver>();
const vehicleFormRef = ref<FormInstance>(); const driverFormRef = ref<FormInstance>();
let vehicleController: AbortController | undefined; let driverController: AbortController | undefined;
const vehicleForm = reactive({ plate_number: "", vehicle_type: "compactor", depot_code: "H-01", capacity_kg: 8000, odometer_km: 0, inspection_due_at: dayjs().add(1, "year") as Dayjs });
const driverForm = reactive({ employee_no: "", name: "", license_class: "B2", license_expires_at: dayjs().add(1, "year") as Dayjs });
const certificationForm = reactive({ code: "", vehicle_type: "compactor", expires_at: dayjs().add(1, "year") as Dayjs });
const required = [{ required: true, message: "此项为必填项" }];
const vehicleRules = { plate_number: [...required, { validator: (_rule: unknown, value: string) => isValidVehiclePlate(value) ? Promise.resolve() : Promise.reject(new Error("请输入有效车牌号")) }], vehicle_type: required, depot_code: required, capacity_kg: required, odometer_km: required, inspection_due_at: required };
const driverRules = { employee_no: required, name: required, license_class: required, license_expires_at: required };
const vehicleColumns = [{ title: "车牌", dataIndex: "plate_number" }, { title: "车型", dataIndex: "vehicle_type" }, { title: "车场", dataIndex: "depot_code" }, { title: "状态", key: "status" }, { title: "载重", dataIndex: "capacity_kg" }, { title: "里程", dataIndex: "odometer_km" }, { title: "年检到期", key: "inspection_due_at" }];
const driverColumns = [{ title: "工号", dataIndex: "employee_no" }, { title: "姓名", dataIndex: "name" }, { title: "驾照", dataIndex: "license_class" }, { title: "状态", key: "status" }, { title: "车型资格", key: "certifications" }, { title: "操作", key: "action", width: 180 }];
const availableCount = computed(() => vehiclePage.value.items.filter(v => v.status === "available").length);
const activeDrivers = computed(() => driverPage.value.items.filter(v => v.status === "active").length);
const vehiclePagination = computed(() => ({ current: Math.floor(vehiclePage.value.offset / vehiclePage.value.limit) + 1, pageSize: vehiclePage.value.limit, total: vehiclePage.value.total, showSizeChanger: false }));
const notifyError = (error: unknown) => message.error(error instanceof ApiError ? `${error.message}${error.requestId ? ` (${error.requestId})` : ""}` : "请求失败");
const loadVehicles = async (page = 1) => { const safePage = Number.isInteger(page) && page > 0 ? page : 1; vehicleController?.abort(); vehicleController = new AbortController(); loadingVehicles.value = true; try { vehiclePage.value = await api.vehicles({ limit: 20, offset: (safePage - 1) * 20, q: vehicleQuery.value, status: vehicleStatus.value }, vehicleController.signal); } catch (error) { if ((error as Error).name !== "AbortError") notifyError(error); } finally { loadingVehicles.value = false; } };
const loadDrivers = async () => { driverController?.abort(); driverController = new AbortController(); loadingDrivers.value = true; try { driverPage.value = await api.drivers({ limit: 100, status: driverStatus.value }, driverController.signal); } catch (error) { if ((error as Error).name !== "AbortError") notifyError(error); } finally { loadingDrivers.value = false; } };
const changeVehiclePage = (value: { current?: number }) => loadVehicles(value.current || 1);
const normalizePlateInput = () => { vehicleForm.plate_number = normalizeVehiclePlate(vehicleForm.plate_number); };
const createVehicle = async () => { try { normalizePlateInput(); await vehicleFormRef.value?.validate(); saving.value = true; await api.createVehicle({ ...vehicleForm, inspection_due_at: vehicleForm.inspection_due_at.toISOString() }); message.success("车辆已创建"); vehicleOpen.value = false; await loadVehicles(1); } catch (error) { if (error instanceof ApiError) notifyError(error); } finally { saving.value = false; } };
const createDriver = async () => { try { await driverFormRef.value?.validate(); saving.value = true; await api.createDriver({ ...driverForm, license_expires_at: driverForm.license_expires_at.toISOString() }); message.success("驾驶员已创建"); driverOpen.value = false; await loadDrivers(); } catch (error) { if (error instanceof ApiError) notifyError(error); } finally { saving.value = false; } };
const openCertification = (driver: Driver) => { selectedDriver.value = driver; certificationForm.code = `CERT-${driver.employee_no}`; certificationOpen.value = true; };
const saveCertification = async () => { if (!selectedDriver.value || !certificationForm.code) return message.warning("请填写资格编号"); saving.value = true; try { await api.certifyDriver(selectedDriver.value.id, { ...certificationForm, expires_at: certificationForm.expires_at.toISOString() }); message.success("资格已保存"); certificationOpen.value = false; await loadDrivers(); } catch (error) { notifyError(error); } finally { saving.value = false; } };
const toggleDriver = async (driver: Driver) => { try { driver.status === "active" ? await api.suspendDriver(driver.id) : await api.reactivateDriver(driver.id); message.success("人员状态已更新"); await loadDrivers(); } catch (error) { notifyError(error); } };
const statusColor = (value: string) => ({ available: "green", on_duty: "blue", maintenance: "orange", active: "green", suspended: "orange" }[value] || "default");
const statusText = (value: string) => ({ available: "可用", on_duty: "出车中", maintenance: "维修中", active: "在岗", suspended: "停岗" }[value] || value);
const formatDate = (value: string) => dayjs(value).format("YYYY-MM-DD");
onMounted(() => { loadVehicles(); loadDrivers(); });
onBeforeUnmount(() => { vehicleController?.abort(); driverController?.abort(); });
</script>

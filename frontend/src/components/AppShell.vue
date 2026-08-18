<template>
  <a-layout class="app-layout">
    <a-layout-sider v-model:collapsed="collapsed" collapsible breakpoint="lg" :collapsed-width="0" :width="224" theme="dark">
      <div class="brand"><CarOutlined /><span v-if="!collapsed">环卫运营中心</span></div>
      <a-menu theme="dark" mode="inline" :selected-keys="[route.path]" @click="navigate">
        <a-menu-item key="/fleet"><CarOutlined /><span>车辆与驾驶员</span></a-menu-item>
        <a-menu-item key="/planning"><CalendarOutlined /><span>路线与排班</span></a-menu-item>
        <a-menu-item key="/operations"><ControlOutlined /><span>运营执行</span></a-menu-item>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="app-header">
        <div class="header-heading">
          <span class="header-title">{{ route.meta.title }}</span>
          <span class="header-subtitle">上海业务日 · 车队调度与安全闭环</span>
        </div>
        <div class="header-actions">
          <a-badge class="service-status" :status="healthy ? 'success' : 'error'" :text="healthy ? '服务正常' : '服务异常'" />
          <a-divider type="vertical" />
          <div class="operator-chip"><a-avatar size="small"><template #icon><UserOutlined /></template></a-avatar><span>{{ currentOperator?.display_name || '当前操作员' }}</span></div>
          <a-tooltip title="检查服务状态"><a-button type="text" shape="circle" :loading="checking" aria-label="检查服务状态" @click="checkHealth"><ReloadOutlined /></a-button></a-tooltip>
          <a-tooltip title="退出登录"><a-button type="text" shape="circle" aria-label="退出登录" @click="logout"><LogoutOutlined /></a-button></a-tooltip>
        </div>
      </a-layout-header>
      <a-layout-content class="content"><router-view /></a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { CalendarOutlined, CarOutlined, ControlOutlined, LogoutOutlined, ReloadOutlined, UserOutlined } from "@ant-design/icons-vue";
import { api } from "../api/client";
import type { Operator } from "../types";

const collapsed = ref(false);
const checking = ref(false);
const healthy = ref(false);
const currentOperator = ref<Operator>();
const route = useRoute();
const router = useRouter();
const navigate = ({ key }: { key: string }) => router.push(key);
const checkHealth = async () => {
  checking.value = true;
  try { healthy.value = (await api.health()).status === "ready"; } catch { healthy.value = false; } finally { checking.value = false; }
};
const loadOperator = async () => {
  try { currentOperator.value = await api.me(); } catch { localStorage.removeItem("sanitation_session"); await router.replace("/login"); }
};
const logout = async () => {
  try { await api.logout(); } finally { localStorage.removeItem("sanitation_session"); localStorage.removeItem("sanitation_operator"); await router.replace("/login"); }
};
onMounted(() => { checkHealth(); loadOperator(); });
</script>

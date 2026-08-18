<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="login-brand"><SafetyCertificateOutlined /><div><h1>环卫运营中心</h1><p>车辆调度与安全作业平台</p></div></div>
      <a-alert v-if="errorMessage" type="error" show-icon :message="errorMessage" style="margin-bottom:18px" />
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" @finish="submit">
        <a-form-item label="用户名" name="username"><a-input v-model:value="form.username" size="large" autocomplete="username"><template #prefix><UserOutlined /></template></a-input></a-form-item>
        <a-form-item label="密码" name="password"><a-input-password v-model:value="form.password" size="large" autocomplete="current-password"><template #prefix><LockOutlined /></template></a-input-password></a-form-item>
        <a-button type="primary" html-type="submit" size="large" block :loading="loading">登录</a-button>
      </a-form>
      <div class="login-meta"><a-badge status="processing" text="运营专网访问" /><span>会话有效期 12 小时</span></div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { type FormInstance } from "ant-design-vue";
import { LockOutlined, SafetyCertificateOutlined, UserOutlined } from "@ant-design/icons-vue";
import { ApiError, api } from "../api/client";

const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const errorMessage = ref("");
const form = reactive({ username: "", password: "" });
const rules = {
  username: [{ required: true, message: "请输入用户名" }],
  password: [{ required: true, message: "请输入密码" }, { min: 8, message: "密码至少 8 位" }],
};
const submit = async () => {
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await api.login(form.username, form.password);
    localStorage.setItem("sanitation_session", result.token);
    localStorage.setItem("sanitation_operator", JSON.stringify(result.operator));
    await router.replace("/fleet");
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : "登录服务暂不可用";
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #eef2f4; }
.login-panel { width: min(420px, 100%); background: white; border: 1px solid #dfe5e8; border-top: 4px solid #087f5b; border-radius: 6px; padding: 32px; box-shadow: 0 14px 36px rgba(31, 41, 51, 0.12); }
.login-brand { display: flex; align-items: center; gap: 14px; margin-bottom: 26px; color: #087f5b; }
.login-brand > span { font-size: 38px; }
.login-brand h1 { margin: 0; font-size: 23px; color: #1f2933; }
.login-brand p { margin: 4px 0 0; color: #75808a; }
.login-meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 22px; color: #75808a; font-size: 12px; }
</style>

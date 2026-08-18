<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import zhCN from "ant-design-vue/es/locale/zh_CN";

const theme = {
  token: {
    colorPrimary: "#087f5b",
    colorInfo: "#1971c2",
    borderRadius: 6,
    fontSize: 14,
  },
};
</script>

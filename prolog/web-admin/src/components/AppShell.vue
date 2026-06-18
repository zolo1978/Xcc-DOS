<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const menuItems = [
  { index: "/rules", label: "规则管理" },
  { index: "/evolution/review", label: "自进化审核" },
  { index: "/synonyms", label: "同义词" },
  { index: "/tenants", label: "租户" },
  { index: "/sessions", label: "会话" }
];

const activeMenu = computed(() => String(route.meta.navKey ?? route.path));

function handleSelect(index: string) {
  router.push(index);
}

function handleLogout() {
  authStore.logout();
  router.push("/login");
}
</script>

<template>
  <el-container style="min-height: 100vh; padding: 24px">
    <el-aside width="240px" class="page-card" style="padding: 24px; margin-right: 24px">
      <div style="margin-bottom: 28px">
        <div style="font-size: 12px; letter-spacing: 0.12em; color: #0f766e">PROLOG AGENTTEAM</div>
        <h2 style="margin: 8px 0 0; font-size: 28px">管理端</h2>
      </div>
      <el-menu :default-active="activeMenu" @select="handleSelect">
        <el-menu-item v-for="item in menuItems" :key="item.index" :index="item.index">
          {{ item.label }}
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="page-card" style="height: auto; padding: 18px 24px; margin-bottom: 20px">
        <div style="display: flex; align-items: center; justify-content: space-between">
          <div>
            <div style="font-size: 12px; color: #52606d">当前租户</div>
            <div style="font-size: 20px; font-weight: 700">{{ authStore.tenantCode || "未选择" }}</div>
          </div>
          <div style="display: flex; gap: 12px; align-items: center">
            <el-tag type="success">{{ authStore.username || "匿名用户" }}</el-tag>
            <el-button plain @click="handleLogout">退出登录</el-button>
          </div>
        </div>
      </el-header>
      <el-main class="page-card" style="padding: 24px">
        <slot />
      </el-main>
    </el-container>
  </el-container>
</template>

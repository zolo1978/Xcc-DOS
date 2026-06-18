<script setup lang="ts">
import { api } from "@/lib/api";
import type { Tenant } from "@/lib/types";
import { onMounted, ref } from "vue";

const loading = ref(false);
const tenants = ref<Tenant[]>([]);

async function loadTenants() {
  loading.value = true;
  try {
    const response = await api.listTenants();
    tenants.value = response.items;
  } finally {
    loading.value = false;
  }
}

onMounted(loadTenants);
</script>

<template>
  <div class="page-header">
    <div>
      <h1 class="page-title">租户总览</h1>
      <p class="page-subtitle">当前为只读占位页，便于前台先接通菜单与列表视图。</p>
    </div>
    <el-button plain :loading="loading" @click="loadTenants">刷新</el-button>
  </div>

  <el-table v-loading="loading" :data="tenants" border>
    <el-table-column prop="tenantName" label="租户名称" min-width="180" />
    <el-table-column prop="tenantCode" label="租户编码" min-width="140" />
    <el-table-column prop="isolateType" label="隔离方式" min-width="120" />
    <el-table-column prop="status" label="状态" min-width="120" />
    <el-table-column prop="contactPerson" label="联系人" min-width="120" />
    <el-table-column prop="contactPhone" label="联系电话" min-width="140" />
  </el-table>
</template>

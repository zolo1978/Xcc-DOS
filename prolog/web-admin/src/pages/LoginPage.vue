<script setup lang="ts">
import { reactive } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
  username: "tenant_admin",
  password: "123456",
  tenantCode: "demo-tenant"
});

async function submit() {
  await authStore.login(form);
  await router.push("/rules");
}
</script>

<template>
  <div style="display: grid; place-items: center; min-height: 100vh; padding: 24px">
    <div class="page-card" style="width: min(480px, 100%); padding: 32px">
      <div style="margin-bottom: 24px">
        <div style="font-size: 12px; letter-spacing: 0.12em; color: #0f766e">PROLOG WEB ADMIN</div>
        <h1 style="margin: 10px 0 8px; font-size: 34px">登录</h1>
        <p class="muted" style="margin: 0">JWT + 租户头联动校验，登录后进入规则运营工作台。</p>
      </div>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" name="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" name="password" type="password" show-password />
        </el-form-item>
        <el-form-item label="租户编码">
          <el-input v-model="form.tenantCode" name="tenantCode" />
        </el-form-item>
        <el-button class="full-width" type="primary" :loading="authStore.busy" @click="submit">
          登录并进入管理端
        </el-button>
      </el-form>
    </div>
  </div>
</template>

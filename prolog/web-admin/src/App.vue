<script setup lang="ts">
import AppShell from "@/components/AppShell.vue";
import { RouterView, useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <RouterView v-slot="{ Component }">
    <AppShell v-if="route.meta.requiresAuth">
      <component :is="Component" />
    </AppShell>
    <component :is="Component" v-else />
  </RouterView>
</template>

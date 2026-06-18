import type { Router } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import { mount } from "@vue/test-utils";
import { createAppRouter } from "@/router";

export async function createTestRouter(path = "/") {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(pinia);
  await router.push(path);
  await router.isReady();
  return { pinia, router };
}

export function mountWithPlugins(component: object, router: Router, pinia = createPinia()) {
  return mount(component, {
    global: {
      plugins: [pinia, router]
    },
    attachTo: document.body
  });
}

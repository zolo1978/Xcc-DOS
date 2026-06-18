import { useAuthStore } from "@/stores/auth";
import type { Pinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import LoginPage from "@/pages/LoginPage.vue";
import RulesPage from "@/pages/RulesPage.vue";
import EvolutionReviewPage from "@/pages/EvolutionReviewPage.vue";
import SynonymsPage from "@/pages/SynonymsPage.vue";
import TenantsPage from "@/pages/TenantsPage.vue";
import SessionsPage from "@/pages/SessionsPage.vue";

const routes = [
  {
    path: "/",
    redirect: "/rules"
  },
  {
    path: "/login",
    name: "login",
    component: LoginPage
  },
  {
    path: "/rules",
    name: "rules",
    component: RulesPage,
    meta: { requiresAuth: true, navKey: "/rules" }
  },
  {
    path: "/evolution/review",
    name: "evolution-review",
    component: EvolutionReviewPage,
    meta: { requiresAuth: true, navKey: "/evolution/review" }
  },
  {
    path: "/synonyms",
    name: "synonyms",
    component: SynonymsPage,
    meta: { requiresAuth: true, navKey: "/synonyms" }
  },
  {
    path: "/tenants",
    name: "tenants",
    component: TenantsPage,
    meta: { requiresAuth: true, navKey: "/tenants" }
  },
  {
    path: "/sessions",
    name: "sessions",
    component: SessionsPage,
    meta: { requiresAuth: true, navKey: "/sessions" }
  }
];

export function createAppRouter(pinia: Pinia) {
  const router = createRouter({
    history: createWebHistory(),
    routes
  });

  router.beforeEach((to) => {
    const authStore = useAuthStore(pinia);

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      return { name: "login" };
    }

    if (to.name === "login" && authStore.isAuthenticated) {
      return { name: "rules" };
    }

    return true;
  });

  return router;
}

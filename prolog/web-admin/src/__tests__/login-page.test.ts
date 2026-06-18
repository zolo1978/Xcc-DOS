import LoginPage from "@/pages/LoginPage.vue";
import { useAuthStore } from "@/stores/auth";
import { flushPromises } from "@vue/test-utils";
import { createTestRouter, mountWithPlugins } from "@/__tests__/helpers";

describe("LoginPage", () => {
  it("submits the form and stores tokens", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ accessToken: "access-1", refreshToken: "refresh-1" }), { status: 200 })
    );

    const { pinia, router } = await createTestRouter("/login");
    const wrapper = mountWithPlugins(LoginPage, router, pinia);

    const inputs = wrapper.findAll("input");
    await inputs[0]?.setValue("ops_admin");
    await inputs[1]?.setValue("secret123");
    await inputs[2]?.setValue("tenant-x");
    await wrapper.find("button").trigger("click");
    await flushPromises();

    const authStore = useAuthStore(pinia);
    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.tenantCode).toBe("tenant-x");
    expect(router.currentRoute.value.path).toBe("/rules");
  });
});

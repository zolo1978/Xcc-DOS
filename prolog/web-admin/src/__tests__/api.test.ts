import { api } from "@/lib/api";
import { setAuthSession } from "@/lib/auth-session";

describe("api client", () => {
  it("injects bearer token and tenant header", async () => {
    setAuthSession({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      tenantCode: "tenant-a",
      username: "tester"
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 })
    );

    await api.listRules();

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toContain("/api/v1/rules");
    expect((init?.headers as Headers).get("Authorization")).toBe("Bearer access-1");
    expect((init?.headers as Headers).get("X-Tenant-Id")).toBe("tenant-a");
  });

  it("refreshes token on 401 and retries once", async () => {
    setAuthSession({
      accessToken: "expired-token",
      refreshToken: "refresh-1",
      tenantCode: "tenant-a",
      username: "tester"
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "access-2", refreshToken: "refresh-2" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), { status: 200 })
      );

    await api.listRules();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain("/api/v1/auth/refresh");
    expect((vi.mocked(fetch).mock.calls[2]?.[1]?.headers as Headers).get("Authorization")).toBe("Bearer access-2");
  });
});

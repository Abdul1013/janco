const TOKEN_KEY = "janco_admin_token";

/** Store token in both localStorage (for JS reads) and the
 *  httpOnly cookie is set by the Route Handler — not here. */
export function storeToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error ?? "Invalid credentials" };
    }
    const data = await res.json();
    storeToken(data.access_token);
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — please try again" };
  }
}

/** Decode a claim from the JWT payload client-side. Used only for UI guards;
 *  all real authorization is enforced server-side. */
function decodeClaim<T = unknown>(claim: string): T | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload[claim] as T) ?? null;
  } catch {
    return null;
  }
}

export function getCurrentUserId(): string | null {
  return decodeClaim<string>("sub");
}

/** Admin tier from the JWT: 'super_admin' | 'admin' | 'viewer' | null. */
export function getAdminLevel(): string | null {
  return decodeClaim<string>("admin_level");
}

export function isSuperAdmin(): boolean {
  return getAdminLevel() === "super_admin";
}

export function isViewer(): boolean {
  return getAdminLevel() === "viewer";
}

export async function logout(): Promise<void> {
  clearToken();
  // Clear the httpOnly cookie via the route handler
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.href = "/login";
}

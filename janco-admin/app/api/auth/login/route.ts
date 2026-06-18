import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  // Proxy to the FastAPI backend
  let backendRes: Response;
  try {
    backendRes = await fetch(`${API_URL}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }),
    });
  } catch {
    return NextResponse.json({ error: "Backend unreachable" }, { status: 502 });
  }

  if (!backendRes.ok) {
    const data = await backendRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: data.detail ?? "Invalid credentials" },
      { status: backendRes.status }
    );
  }

  const data = await backendRes.json();
  const token: string = data.access_token;

  if (!token) {
    return NextResponse.json({ error: "No token returned" }, { status: 502 });
  }

  const response = NextResponse.json({ access_token: token });

  // Set httpOnly cookie for middleware-based route protection
  response.cookies.set("janco_admin_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });

  return response;
}

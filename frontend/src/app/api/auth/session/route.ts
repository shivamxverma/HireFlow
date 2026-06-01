import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const authSession = request.cookies.get("auth_session");

    if (!token || !authSession) {
      const response = NextResponse.json({
        success: true,
        authenticated: false,
        user: null,
      });
      response.cookies.delete("auth_session");
      response.cookies.delete("token");
      return response;
    }

    const rawApi = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/+$/, "");
    const BACKEND_API = rawApi.endsWith("/api/v1") ? rawApi : `${rawApi}/api/v1`;

    try {
      const meRes = await fetch(`${BACKEND_API}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.success && meData.data?.user) {
          const backendUser = meData.data.user;
          const userMetadata = {
            name: backendUser.displayName || backendUser.username || "User",
            email: backendUser.email,
            avatar: backendUser.avatarUrl || undefined,
            provider: JSON.parse(authSession.value).provider || "google",
            sessionToken: token,
          };

          return NextResponse.json({
            success: true,
            authenticated: true,
            user: userMetadata,
          });
        }
      }
    } catch (err) {
      console.error("[Session Fetch Dynamic Error]", err);
      // If backend is down or unreachable, fall back to cached session cookies
      try {
        const user = JSON.parse(authSession.value);
        return NextResponse.json({
          success: true,
          authenticated: true,
          user,
        });
      } catch {}
    }

    // Session is invalid or user was deleted/banned
    const response = NextResponse.json({
      success: true,
      authenticated: false,
      user: null,
    });
    response.cookies.delete("auth_session");
    response.cookies.delete("token");
    return response;
  } catch (error) {
    console.error("[Auth Session API Error]", error);
    return NextResponse.json({
      success: true,
      authenticated: false,
      user: null,
    });
  }
}

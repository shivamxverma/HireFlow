import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { provider, token, user } = await request.json();

    if (!provider || !["google", "github"].includes(provider)) {
      return NextResponse.json(
        { success: false, message: "Invalid OAuth provider." },
        { status: 400 }
      );
    }

    const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

    // Scenario A: If token and user details are supplied, this is a synchronization call from /oauth-success
    if (token && user) {
      const userMetadata = {
        name: user.displayName || user.username || "User",
        email: user.email,
        avatar: user.avatarUrl || undefined,
        provider,
        sessionToken: token,
      };

      const response = NextResponse.json({
        success: true,
        message: "Session established successfully.",
        data: { user: userMetadata },
      });

      // 1. Establish secure cookie 'auth_session' for frontend compatibility
      response.cookies.set("auth_session", JSON.stringify(userMetadata), {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 Week
        secure: process.env.NODE_ENV === "production",
      });

      // 2. Establish 'token' cookie containing real backend JWT for Edge middleware checks
      response.cookies.set("token", token, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 1 Week
        secure: process.env.NODE_ENV === "production",
      });

      return response;
    }

    // Scenario B: Initiating OAuth login flow - return redirect URL to the backend auth gateway
    // Determine the frontend web origin dynamically
    const origin = request.nextUrl.origin;
    const redirectUrl = `${BACKEND_API}/auth/${provider}?origin=${encodeURIComponent(origin)}`;

    return NextResponse.json({
      success: true,
      message: "Redirection initiated.",
      data: { redirectUrl },
    });
  } catch (error) {
    console.error("[Auth Login API Error]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error established." },
      { status: 500 }
    );
  }
}

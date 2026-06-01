import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

    if (token) {
      try {
        // Notify the Express backend to clear its cookie tokens
        await fetch(`${BACKEND_API}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.error("[Session Logout Backend Notification Failed]", err);
      }
    }

    const response = NextResponse.json({
      success: true,
      message: "Successfully signed out. Session invalidated.",
    });

    // Clear secure Next.js cookies
    response.cookies.delete("auth_session");
    response.cookies.delete("token");

    return response;
  } catch (error) {
    console.error("[Auth Logout API Error]", error);
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

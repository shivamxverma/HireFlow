import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  try {
    const userMetadata = {
      name: "Shivam Verma",
      email: "shivam@example.com",
      avatar: null,
      provider: "google",
      sessionToken: "oauth-mock-session-token-admin",
    };

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: userMetadata,
    });
  } catch (error) {
    console.error("[Auth Session API Error]", error);
    return NextResponse.json({
      success: true,
      authenticated: false,
      user: null,
    });
  }
}

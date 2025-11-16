import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create a Supabase client that can read and set auth cookies via middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("ban_reason, banned_until, is_moderator")
      .eq("id", user.id)
      .maybeSingle();

    const path = request.nextUrl.pathname;
    const allowPaths = ["/banned", "/auth", "/api/auth", "/logout"]; // allow auth flows while banned
    const isAllowedPath = allowPaths.some((allowed) => path === allowed || path.startsWith(`${allowed}/`));
    const isStaticAsset =
      path.startsWith("/_next") ||
      path.startsWith("/images") ||
      path.startsWith("/assets") ||
      path === "/favicon.ico";

    if (profile) {
      const banReason = profile.ban_reason;
      const bannedUntilValue = profile.banned_until ? new Date(profile.banned_until) : null;
      const isBanActive = Boolean(banReason) && (!bannedUntilValue || bannedUntilValue.getTime() > Date.now());

      if (isBanActive) {
        if (path.startsWith("/api/")) {
          return NextResponse.json(
            {
              error: "Account banned",
              reason: banReason,
              bannedUntil: profile.banned_until,
            },
            { status: 403 }
          );
        }

        if (!isAllowedPath && !isStaticAsset) {
          return NextResponse.redirect(new URL("/banned", request.url));
        }

        response.headers.set("x-user-banned", "true");
        if (profile.banned_until) {
          response.headers.set("x-user-banned-until", profile.banned_until);
        }
      }

      if (profile.is_moderator) {
        response.headers.set("x-user-role", "moderator");
      }
    }
  }

  return response;
}

// Run on all routes so auth cookies stay in sync server-side
export const config = {
  matcher: ["/(.*)"],
};



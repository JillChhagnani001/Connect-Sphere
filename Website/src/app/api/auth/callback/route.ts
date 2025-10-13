import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/feed";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name, options) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );
    const { error, data: { session } } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session) {
      const user = session.user;
      
      // Helper to build a safe username
      const sanitize = (value?: string | null) =>
        (value || "")
          .toString()
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_\-]+/g, "-")
          .replace(/^-+|-+$/g, "");

      const emailLocal = user.email?.split('@')[0];
      const rawUsername = (user.user_metadata.user_name || user.user_metadata.preferred_username || user.user_metadata.full_name || emailLocal || `user-${user.id.slice(0, 6)}`) as string;
      const safeUsername = sanitize(rawUsername) || `user-${user.id.slice(0, 6)}`;
      const displayName = (user.user_metadata.full_name || user.user_metadata.name || emailLocal || "User");

      // Check if a profile already exists.
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (!profile) {
        // If no profile exists, create one.
        const { error: profileError } = await supabase.from('profiles').insert({
          id: user.id,
          display_name: displayName,
          avatar_url: user.user_metadata.avatar_url,
          username: safeUsername,
          bio: ''
        });

        if (profileError) {
          return NextResponse.redirect(`${origin}/login?error=Could not create your profile. Please try again.`);
        }
      } else {
        // Backfill missing/null fields to avoid /profile/null links
        const needsUsername = !profile.username || profile.username === 'null' || profile.username === '';
        const needsDisplay = !profile.display_name || profile.display_name === '';
        if (needsUsername || needsDisplay) {
          await supabase
            .from('profiles')
            .update({
              username: needsUsername ? safeUsername : profile.username,
              display_name: needsDisplay ? displayName : profile.display_name,
              avatar_url: profile.avatar_url || user.user_metadata.avatar_url
            })
            .eq('id', user.id);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Authentication failed. Please try again.`);
}
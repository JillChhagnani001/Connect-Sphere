import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper to build a safe username
const sanitize = (value?: string | null) =>
  (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, "-")
    .replace(/^-+|-+$/g, "");

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
      
      // Use service role client to check for existing users with this email
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Check if other users exist with this email (prevents duplicate accounts)
      if (user.email && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          // Get user by email using admin API
          const { data: { users: existingUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1000
          });
          
          if (!listError && existingUsers) {
            const otherUsersWithEmail = existingUsers.filter(
              u => u.email?.toLowerCase() === user.email?.toLowerCase() && u.id !== user.id
            );
            
            if (otherUsersWithEmail.length > 0) {
              // Another account exists with this email
              const otherUser = otherUsersWithEmail[0];
              const hasEmailProvider = otherUser.identities?.some(id => id.provider === 'email');
              
              if (hasEmailProvider) {
                console.log(`Duplicate account detected: ${user.email} - Logging into existing account`);
                
                // Delete the duplicate OAuth user first
                await supabaseAdmin.auth.admin.deleteUser(user.id);
                
                // Create a session link for the existing user and sign them in automatically
                // We set redirectTo to our OAuth callback so the session cookie is created server-side
                const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
                  type: 'magiclink',
                  email: otherUser.email!,
                  options: {
                    redirectTo: `${origin}/api/auth/callback?next=/feed`
                  }
                });
                
                if (!sessionError && sessionData?.properties?.action_link) {
                  // Redirect to the action link which will create a session and redirect to feed
                  console.log('Auto-signing in user to existing account');
                  return NextResponse.redirect(sessionData.properties.action_link);
                }
                
                // If auto-signin fails, redirect to login with message
                console.error('Failed to generate session:', sessionError);
                return NextResponse.redirect(
                  `${origin}/login?error=${encodeURIComponent(
                    'This email is already registered. Please sign in with your email and password.'
                  )}`
                );
              }
            }
          }
        } catch (err) {
          console.error('Error checking for duplicate users:', err);
          // Continue with normal flow if check fails
        }
      }
      
      // Check if a profile already exists with this user ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (profile && profile.username) {
        // Profile exists and is complete
        return NextResponse.redirect(`${origin}${next}`);
      }

      if (profile && !profile.username) {
        // Profile exists but username is not set - redirect to complete-profile
        return NextResponse.redirect(`${origin}/complete-profile`);
      }

      // No profile exists - this is a new OAuth user
      // Create a basic profile and redirect to complete-profile
      const emailLocal = user.email?.split('@')[0];
      const displayName = user.user_metadata.full_name || user.user_metadata.name || user.user_metadata.display_name || emailLocal || "New User";

      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        username: null, // Username will be set in complete-profile
        display_name: displayName,
        avatar_url: user.user_metadata.avatar_url,
        bio: '',
      });

      if (profileError) {
        console.error("Error creating basic profile during OAuth callback:", profileError);
      }

      // Create privacy settings
      const { error: privacyError } = await supabase.from('privacy_settings').insert({
        user_id: user.id,
      });

      if (privacyError) {
        console.error("Error creating privacy settings during OAuth callback:", privacyError);
        // Privacy settings might already exist, don't block the flow
      }

      // Redirect to complete-profile page
      return NextResponse.redirect(`${origin}/complete-profile`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Authentication failed. Please try again.`);
}

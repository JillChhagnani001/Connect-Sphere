import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PrivacySettings } from "@/components/privacy/privacy-settings";
import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserProfile } from "@/lib/types";
import { ProfileForm } from "@/components/settings/profile-form";
import { evaluateUserVerification } from "@/lib/verification";
import { VerificationStatusCard } from "@/components/settings/verification-status-card";
import { ArchivedPostList } from "@/components/settings/archived-posts-list-ui";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";

export default async function SettingsPage() {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const verification = await evaluateUserVerification(supabase, user.id);

  // If for some reason the profile doesn't exist, provide sensible defaults
  const userProfile: UserProfile = profile || {
    id: user.id,
    display_name: 'User',
    username: 'user',
    bio: '',
    avatar_url: '',
    is_private: false,
    is_verified: verification.eligible,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (profile) {
    userProfile.is_verified = profile.is_verified ?? false;
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

        <ProfileForm profile={userProfile} />

        <VerificationStatusCard result={verification} />
        
        <PrivacySettings userId={user.id} />

        <Card>
            <CardHeader>
                <CardTitle>Archived Posts</CardTitle>
                <CardDescription>View and restore posts that are hidden from your profile and public feeds.</CardDescription>
            </CardHeader>
            <CardContent>
                <ArchivedPostList />
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Manage actions related to your account.</CardDescription>
            </CardHeader>
            <CardContent>
                <DeleteAccountDialog username={userProfile.username || ''} />
                <p className="text-sm text-muted-foreground mt-2">Permanently delete your ConnectSphere account and all of its content.</p>
            </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

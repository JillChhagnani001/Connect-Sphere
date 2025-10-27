import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PrivacySettings } from "@/components/privacy/privacy-settings";
import { DatabaseTest } from "@/components/debug/database-test";
import { TableStructure } from "@/components/debug/table-structure";
import { PostsTableTest } from "@/components/debug/posts-table-test";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your public profile information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue="Jane Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" defaultValue="janedoe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" defaultValue="Photographer & Traveler 📸 | Exploring the world one city at a time." />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <DatabaseTest />
        
        <TableStructure />
        
        <PostsTableTest />
        
        <PrivacySettings userId={user.id} />
        
        <Card>
            <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Manage actions related to your account.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="destructive">Delete Account</Button>
                <p className="text-sm text-muted-foreground mt-2">Permanently delete your ConnectSphere account and all of its content.</p>
            </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: { code: string };
}) {
  const cookieStore = cookies();
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // This will be true if the user clicked the link in the password reset email
  // and is not already logged in.
  if (!session && searchParams.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(searchParams.code);
    if (error) {
      // Handle error, e.g., redirect to an error page
      return redirect("/login?error=Invalid password reset link.");
    }
  }

  // After exchanging the code, a session should exist.
  // If the user is logged in, they can update their password.
  // If not, redirect them.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex items-center gap-2">
                <Logo className="h-10 w-10 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">ConnectSphere</h1>
            </div>
          <CardTitle className="text-2xl">Update Your Password</CardTitle>
          <CardDescription>Enter a new password below to update your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

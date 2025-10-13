import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex items-center gap-2">
                <Logo className="h-10 w-10 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">ConnectSphere</h1>
            </div>
          <CardTitle className="text-2xl">Forgot Password?</CardTitle>
          <CardDescription>Enter your email below and we&apos;ll send you a link to reset your password.</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
           <p className="mt-8 text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

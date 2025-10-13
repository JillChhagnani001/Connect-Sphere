'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SeedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Seeding Disabled</CardTitle>
          <CardDescription>
            Database seeding is currently disabled to focus on UI/UX design.
            The application is using mock data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled className="w-full">
            Seeding Disabled
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

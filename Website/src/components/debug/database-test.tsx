"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function DatabaseTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const testDatabase = async () => {
    setIsLoading(true);
    setResults(null);
    
    try {
      const supabase = createClient();
      const testResults: any = {};

      // Test 1: Check authentication
      console.log("Test 1: Checking authentication...");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      testResults.authentication = {
        user: user ? { id: user.id, email: user.email } : null,
        error: authError
      };

      // Test 2: Check if profiles table exists
      console.log("Test 2: Checking profiles table...");
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);
      testResults.profilesTable = {
        data: profilesData,
        error: profilesError
      };

      // Test 3: Check table structure
      console.log("Test 3: Checking table structure...");
      const { data: tableInfo, error: tableError } = await supabase
        .rpc('get_table_columns', { table_name: 'profiles' })
        .catch(() => ({ data: null, error: 'RPC function not available' }));
      testResults.tableStructure = {
        data: tableInfo,
        error: tableError
      };

      // Test 4: Try to insert a test profile
      if (user) {
        console.log("Test 4: Testing profile insert...");
        const { data: insertData, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            display_name: 'Test User',
            username: `test_${Date.now()}`,
            bio: 'Test bio',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select();
        testResults.profileInsert = {
          data: insertData,
          error: insertError
        };

        // Test 5: Try to update the profile
        if (!insertError) {
          console.log("Test 5: Testing profile update...");
          const { data: updateData, error: updateError } = await supabase
            .from('profiles')
            .update({
              bio: 'Updated test bio',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)
            .select();
          testResults.profileUpdate = {
            data: updateData,
            error: updateError
          };
        }
      }

      // Test 6: Check RLS policies
      console.log("Test 6: Checking RLS policies...");
      const { data: policiesData, error: policiesError } = await supabase
        .rpc('get_table_policies', { table_name: 'profiles' })
        .catch(() => ({ data: null, error: 'RPC function not available' }));
      testResults.rlsPolicies = {
        data: policiesData,
        error: policiesError
      };

      setResults(testResults);
      
      toast({
        title: "Database Test Complete",
        description: "Check the results below for any issues.",
      });

    } catch (error) {
      console.error('Database test error:', error);
      setResults({ error: error });
      
      toast({
        title: "Database Test Failed",
        description: "An error occurred during testing.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Database Connection Test</CardTitle>
        <CardDescription>
          This tool helps diagnose database connection and table issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testDatabase} disabled={isLoading}>
          {isLoading ? "Testing..." : "Run Database Test"}
        </Button>

        {results && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Test Results:</h3>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


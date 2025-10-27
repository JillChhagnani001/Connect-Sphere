"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function PostsTableTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const { toast } = useToast();

  const testPostsTable = async () => {
    setIsLoading(true);
    setTestResults(null);
    
    try {
      const supabase = createClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const results: any = {};

      // Test 1: Check if posts table exists
      console.log("Test 1: Checking posts table existence...");
      const { data: tableTest, error: tableError } = await supabase
        .from('posts')
        .select('*')
        .limit(1);
      
      results.tableExists = !tableError;
      results.tableError = tableError;

      if (tableError) {
        results.error = `Posts table error: ${JSON.stringify(tableError)}`;
        setTestResults(results);
        return;
      }

      // Test 2: Check table structure
      console.log("Test 2: Checking table structure...");
      const { data: structureTest, error: structureError } = await supabase
        .from('posts')
        .select('*')
        .limit(1);
      
      results.tableStructure = {
        columns: structureTest && structureTest.length > 0 ? Object.keys(structureTest[0]) : [],
        sampleData: structureTest && structureTest.length > 0 ? structureTest[0] : null,
        error: structureError
      };

      // Test 3: Try to create a test post
      console.log("Test 3: Testing post creation...");
      const testPostData = {
        user_id: user.id,
        text: `Test post created at ${new Date().toISOString()}`,
      };

      const { data: insertData, error: insertError } = await supabase
        .from('posts')
        .insert(testPostData)
        .select();

      results.postCreation = {
        data: insertData,
        error: insertError,
        success: !insertError
      };

      // Test 4: Try to read posts
      console.log("Test 4: Testing post reading...");
      const { data: readData, error: readError } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      results.postReading = {
        data: readData,
        error: readError,
        count: readData ? readData.length : 0
      };

      // Test 5: Check if we can update a post
      if (insertData && insertData.length > 0) {
        console.log("Test 5: Testing post update...");
        const { data: updateData, error: updateError } = await supabase
          .from('posts')
          .update({ text: 'Updated test post' })
          .eq('id', insertData[0].id)
          .select();

        results.postUpdate = {
          data: updateData,
          error: updateError,
          success: !updateError
        };

        // Clean up test post
        await supabase
          .from('posts')
          .delete()
          .eq('id', insertData[0].id);
      }

      setTestResults(results);
      
      toast({
        title: "Posts Table Test Complete",
        description: `Table exists: ${results.tableExists}, Posts found: ${results.postReading.count}`,
      });

    } catch (error) {
      console.error('Posts table test error:', error);
      setTestResults({ 
        error: error instanceof Error ? error.message : String(error),
        tableExists: false
      });
      
      toast({
        title: "Posts Table Test Failed",
        description: "Could not test the posts table.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Posts Table Test</CardTitle>
        <CardDescription>
          Test if the posts table exists and works correctly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testPostsTable} disabled={isLoading}>
          {isLoading ? "Testing..." : "Test Posts Table"}
        </Button>

        {testResults && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Table Status</h3>
                <Badge variant={testResults.tableExists ? "default" : "destructive"}>
                  {testResults.tableExists ? "Table Exists" : "Table Not Found"}
                </Badge>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Post Creation</h3>
                <Badge variant={testResults.postCreation?.success ? "default" : "destructive"}>
                  {testResults.postCreation?.success ? "Success" : "Failed"}
                </Badge>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Posts Found</h3>
                <Badge variant="outline">
                  {testResults.postReading?.count || 0} posts
                </Badge>
              </div>
            </div>

            {testResults.tableStructure?.columns && testResults.tableStructure.columns.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Table Columns</h3>
                <div className="flex flex-wrap gap-2">
                  {testResults.tableStructure.columns.map((column: string) => (
                    <Badge key={column} variant="secondary">
                      {column}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {testResults.error && (
              <div>
                <h3 className="font-semibold mb-2 text-destructive">Error Details</h3>
                <pre className="bg-destructive/10 p-4 rounded-lg overflow-auto text-sm text-destructive">
                  {testResults.error}
                </pre>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Full Test Results</h3>
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


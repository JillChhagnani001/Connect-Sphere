"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function TableStructure() {
  const [isLoading, setIsLoading] = useState(false);
  const [tableInfo, setTableInfo] = useState<any>(null);
  const { toast } = useToast();

  const checkTableStructure = async () => {
    setIsLoading(true);
    setTableInfo(null);
    
    try {
      const supabase = createClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Try to get a sample profile to see what columns exist
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('Profile data:', profileData);
      console.log('Profile error:', profileError);

      if (profileError && profileError.code !== 'PGRST116') {
        throw new Error(`Profile fetch error: ${JSON.stringify(profileError)}`);
      }

      // Get table information using a simple query
      const { data: allProfiles, error: allError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

      console.log('All profiles sample:', allProfiles);
      console.log('All profiles error:', allError);

      if (allError) {
        throw new Error(`Table access error: ${JSON.stringify(allError)}`);
      }

      // Analyze the structure
      const structure = {
        tableExists: true,
        columns: allProfiles && allProfiles.length > 0 ? Object.keys(allProfiles[0]) : [],
        sampleData: allProfiles && allProfiles.length > 0 ? allProfiles[0] : null,
        userProfile: profileData,
        errors: {
          profileError,
          allError
        }
      };

      setTableInfo(structure);
      
      toast({
        title: "Table Structure Check Complete",
        description: `Found ${structure.columns.length} columns in profiles table.`,
      });

    } catch (error) {
      console.error('Table structure check error:', error);
      setTableInfo({ 
        tableExists: false, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      toast({
        title: "Table Structure Check Failed",
        description: "Could not access the profiles table.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Profiles Table Structure</CardTitle>
        <CardDescription>
          Check what columns exist in your profiles table.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={checkTableStructure} disabled={isLoading}>
          {isLoading ? "Checking..." : "Check Table Structure"}
        </Button>

        {tableInfo && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Table Status</h3>
                <Badge variant={tableInfo.tableExists ? "default" : "destructive"}>
                  {tableInfo.tableExists ? "Table Exists" : "Table Not Found"}
                </Badge>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Columns Found</h3>
                <Badge variant="outline">
                  {tableInfo.columns ? tableInfo.columns.length : 0} columns
                </Badge>
              </div>
            </div>

            {tableInfo.columns && tableInfo.columns.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Available Columns</h3>
                <div className="flex flex-wrap gap-2">
                  {tableInfo.columns.map((column: string) => (
                    <Badge key={column} variant="secondary">
                      {column}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {tableInfo.sampleData && (
              <div>
                <h3 className="font-semibold mb-2">Sample Data</h3>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                  {JSON.stringify(tableInfo.sampleData, null, 2)}
                </pre>
              </div>
            )}

            {tableInfo.userProfile && (
              <div>
                <h3 className="font-semibold mb-2">Your Profile Data</h3>
                <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                  {JSON.stringify(tableInfo.userProfile, null, 2)}
                </pre>
              </div>
            )}

            {tableInfo.error && (
              <div>
                <h3 className="font-semibold mb-2 text-destructive">Error Details</h3>
                <pre className="bg-destructive/10 p-4 rounded-lg overflow-auto text-sm text-destructive">
                  {tableInfo.error}
                </pre>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-2">Full Debug Info</h3>
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(tableInfo, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


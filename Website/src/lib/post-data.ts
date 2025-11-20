import { createServerClient } from "@/lib/supabase/server";

export async function archivePost(postId: number) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated.");
  }

  const { error } = await supabase
    .from("posts")
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq("id", postId) 
    .eq("user_id", user.id); 

  if (error) {
    throw new Error(error.message);
  }
}

export async function unarchivePost(postId: number) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated.");
  }

  const { error } = await supabase
    .from("posts")
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchArchivedPosts() {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("posts")
    .select("*") 
    .eq("user_id", user.id)
    .eq("is_archived", true) 
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
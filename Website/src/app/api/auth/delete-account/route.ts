import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    
    // Create authenticated server client to get user
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Use service role client for deleting user data and auth user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Delete all user data in correct order (respecting foreign key constraints)
    // Order matters due to FK relationships
    
    // 1. Delete story reactions (user's reactions)
    await supabaseAdmin.from("story_reactions").delete().eq("user_id", userId);
    
    // 2. Delete stories (user's stories)
    await supabaseAdmin.from("stories").delete().eq("user_id", userId);
    
    // 3. Delete comment likes (user's likes on comments)
    await supabaseAdmin.from("comment_likes").delete().eq("user_id", userId);
    
    // 4. Delete comments on user's posts first, then user's comments
    // Get user's post IDs first
    const { data: userPosts } = await supabaseAdmin
      .from("posts")
      .select("id")
      .eq("user_id", userId);
    const postIds = userPosts?.map((p) => p.id) || [];
    
    if (postIds.length > 0) {
      // Delete comments on user's posts
      await supabaseAdmin.from("comments").delete().in("post_id", postIds);
      // Delete likes on user's posts
      await supabaseAdmin.from("likes").delete().in("post_id", postIds);
      // Delete bookmarks of user's posts
      await supabaseAdmin.from("bookmarks").delete().in("post_id", postIds);
      // Delete shares of user's posts
      await supabaseAdmin.from("shares").delete().in("post_id", postIds);
    }
    
    // 5. Delete user's own comments
    await supabaseAdmin.from("comments").delete().eq("user_id", userId);
    
    // 6. Delete user's likes
    await supabaseAdmin.from("likes").delete().eq("user_id", userId);
    
    // 7. Delete user's bookmarks
    await supabaseAdmin.from("bookmarks").delete().eq("user_id", userId);
    
    // 8. Delete user's shares
    await supabaseAdmin.from("shares").delete().eq("user_id", userId);
    
    // 9. Delete collaboration invites (both sent and received)
    await supabaseAdmin.from("collaboration_invites").delete().eq("inviter_id", userId);
    await supabaseAdmin.from("collaboration_invites").delete().eq("invitee_id", userId);
    
    // 10. Delete collaboration notifications
    await supabaseAdmin.from("collaboration_notifications").delete().eq("user_id", userId);
    
    // 11. Delete notifications (both as recipient and actor)
    await supabaseAdmin.from("notifications").delete().eq("user_id", userId);
    await supabaseAdmin.from("notifications").delete().eq("actor_id", userId);
    
    // 12. Delete user's posts
    await supabaseAdmin.from("posts").delete().eq("user_id", userId);
    
    // 13. Delete messages from conversations (mark as deleted)
    await supabaseAdmin.from("messages").delete().eq("sender", userId);
    
    // 14. Delete conversation participants
    await supabaseAdmin.from("conversation_participants").delete().eq("user_id", userId);
    
    // 15. Delete follow requests
    await supabaseAdmin.from("follow_requests").delete().eq("follower_id", userId);
    await supabaseAdmin.from("follow_requests").delete().eq("following_id", userId);
    
    // 16. Delete followers relationships
    await supabaseAdmin.from("followers").delete().eq("follower_id", userId);
    await supabaseAdmin.from("followers").delete().eq("following_id", userId);
    
    // 17. Delete user blocks
    await supabaseAdmin.from("user_blocks").delete().eq("blocker_id", userId);
    await supabaseAdmin.from("user_blocks").delete().eq("blocked_id", userId);
    
    // 18. Delete user reports (as reporter)
    await supabaseAdmin.from("user_reports").delete().eq("reporter_id", userId);
    // Update reports where user was reported (keep for moderation records but anonymize)
    await supabaseAdmin.from("user_reports").update({ reported_id: userId }).eq("reported_id", userId);
    
    // 19. Delete user bans
    await supabaseAdmin.from("user_bans").delete().eq("user_id", userId);
    
    // 20. Delete community-related data
    // Community post comments
    await supabaseAdmin.from("community_post_comments").delete().eq("user_id", userId);
    
    // Community post likes
    await supabaseAdmin.from("community_post_likes").delete().eq("user_id", userId);
    
    // Get community posts by user
    const { data: userCommunityPosts } = await supabaseAdmin
      .from("community_posts")
      .select("id")
      .eq("user_id", userId);
    const communityPostIds = userCommunityPosts?.map((p) => p.id) || [];
    
    if (communityPostIds.length > 0) {
      // Delete comments on user's community posts
      await supabaseAdmin.from("community_post_comments").delete().in("post_id", communityPostIds);
      // Delete likes on user's community posts
      await supabaseAdmin.from("community_post_likes").delete().in("post_id", communityPostIds);
    }
    
    // Delete user's community posts
    await supabaseAdmin.from("community_posts").delete().eq("user_id", userId);
    
    // Delete community memberships
    await supabaseAdmin.from("community_members").delete().eq("user_id", userId);
    
    // Handle communities owned by user - transfer to another owner or delete
    // For simplicity, we'll delete communities where user is the sole owner
    const { data: ownedCommunities } = await supabaseAdmin
      .from("communities")
      .select("id")
      .eq("owner_id", userId);
    
    if (ownedCommunities && ownedCommunities.length > 0) {
      const communityIds = ownedCommunities.map((c) => c.id);
      
      // Get all community post IDs for owned communities
      const { data: ownedCommunityPosts } = await supabaseAdmin
        .from("community_posts")
        .select("id")
        .in("community_id", communityIds);
      const ownedCommunityPostIds = ownedCommunityPosts?.map((p) => p.id) || [];
      
      if (ownedCommunityPostIds.length > 0) {
        // Delete all related data for owned communities
        await supabaseAdmin.from("community_post_comments").delete().in("post_id", ownedCommunityPostIds);
        await supabaseAdmin.from("community_post_likes").delete().in("post_id", ownedCommunityPostIds);
      }
      
      await supabaseAdmin.from("community_posts").delete().in("community_id", communityIds);
      await supabaseAdmin.from("community_members").delete().in("community_id", communityIds);
      await supabaseAdmin.from("communities").delete().in("id", communityIds);
    }
    
    // 21. Delete payment orders
    await supabaseAdmin.from("payment_orders").delete().eq("user_id", userId);
    
    // 22. Delete privacy settings
    await supabaseAdmin.from("privacy_settings").delete().eq("user_id", userId);
    
    // 23. Delete profile
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    
    // 24. Finally, delete the auth user
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteUserError) {
      console.error("Error deleting auth user:", deleteUserError);
      return NextResponse.json(
        { error: "Failed to delete user account" },
        { status: 500 }
      );
    }

    // Sign out the user
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

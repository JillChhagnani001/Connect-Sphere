

export type UserProfile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  email?: string;
  phone?: string;
  website?: string;
  location?: string;
  is_private: boolean;
  is_verified: boolean;
  is_moderator?: boolean;
  banned_until?: string | null;
  ban_reason?: string | null;
  ban_last_updated?: string | null;
  created_at: string;
  updated_at: string;
  follower_count?: number;
  following_count?: number;
};

export type PostCollaborator = {
  user_id: string;
  role?: string;
  accepted?: boolean;
  invited_at?: string;
};

export type Post = {
  id: number;
  user_id: string;
  text: string;
  created_at: string;
  author: UserProfile;
  media: {
    id: number;
    url: string;
    mime_type: string;
    width?: number;
    height?: number;
  }[];
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  is_private: boolean;
  visibility: 'public' | 'followers' | 'private';
  like_count?: number;
  share_count?: number;
  save_count?: number;
  comment_count?: number;
  collaborators?: PostCollaborator[];
};

export type Comment = {
  id: number;
  post_id: number;
  user_id: string;
  text: string;
  created_at: string;
  author: UserProfile;
  parent_id?: number;
  replies?: Comment[];
};

export type Like = {
  id: number;
  post_id: number;
  user_id: string;
  created_at: string;
};

export type Bookmark = {
  id: number;
  post_id: number;
  user_id: string;
  created_at: string;
};
export type Share = {
  id: number;
  post_id: number;
  user_id: string;
  created_at: string;
};

export type Follower = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type FollowRequest = {
  id: number;
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type Story = {
  id: number;
  user_id: string;
  media_url: string;
  text?: string;
  created_at: string;
  expires_at: string;
  author: UserProfile;
  reactions?: StoryReaction[];
};

export type StoryReaction = {
  id: number;
  story_id: number;
  user_id: string;
  reaction_type: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';
  created_at: string;
};

export type Message = {
  id: number;
  conversation_id: number;
  sender: UserProfile;
  content: string;
  created_at: string;
  image_url?: string | null;
  is_read?: boolean;
  deleted_by?: string[];
  deleted_for_everyone?: boolean;
};

export type Conversation = {
  id: number;
  created_at: string;
  participants: {
    data: UserProfile[];
  };
  last_message: Message | null;
  unread_count: number;
};

export type ReportCategory =
  | "harassment_or_bullying"
  | "hate_or_violence"
  | "sexual_or_graphic_content"
  | "fraud_or_scam"
  | "impersonation"
  | "spam"
  | "other";

export type ReportStatus = "pending" | "under_review" | "action_taken" | "dismissed";

export type UserReport = {
  id: number;
  reporter_id: string;
  reported_id: string;
  category: ReportCategory;
  status: ReportStatus;
  description: string | null;
  evidence_urls: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
};

export type UserBan = {
  id: string;
  user_id: string;
  reason: string | null;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  lifted_at: string | null;
  lifted_by: string | null;
  lift_reason: string | null;
};

export type CommunityMember = {
  id: number;
  community_id: number;
  user_id: string;
  role: 'owner' | 'co_owner' | 'admin' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'left';
  joined_at?: string;
  user?: {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string | null;
  };
};
    
export type Community = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  avatar_url?: string | null;
  cover_image_url?: string | null;
  membership_type: 'free' | 'paid';
  price?: number | null;
  currency?: string | null;
  is_active: boolean;
  owner_id: string;
  member_count?: number;
  post_count?: number;
};

export type CommunityPost = {
  id: number;
  community_id?: number;
  user_id?: string;
  created_at?: string;
  text?: string | null;
  media?: { url: string; mime_type: string }[] | null;
  hashtags?: string[] | null;
  is_premium?: boolean;
  is_liked?: boolean;
  like_count?: number;
  comment_count?: number;
};


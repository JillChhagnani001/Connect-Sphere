

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
  created_at: string;
  updated_at: string;
  follower_count?: number;
  following_count?: number;
};

export type PostCollaborator = {
  user_id: string;
  role?: 'coauthor' | 'editor' | 'contributor' | string;
  accepted?: boolean;
  invited_at?: string;
};

export type Post = {
  id: number;
  user_id: string; // Added user_id
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

export type Follow = {
export type Follow = {
  id: number;
  follower_id: string;
  following_id: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'declined';
  status: 'pending' | 'accepted' | 'declined';
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
  image_url?: string | null;
  created_at: string;
};

export type Participant = UserProfile;

export type Conversation = {
  id: number;
  created_at: string;
  participants: {
    data: Participant[];
  };
  last_message: Message | null;
  unread_count: number;
};

export type Community = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  avatar_url: string | null;
  membership_type: 'free' | 'paid';
  price: number | null;
  currency: string | null;
  owner_id: string;
  owner: UserProfile;
  member_count: number;
  post_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type CommunityMember = {
  id: number;
  community_id: number;
  user_id: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'suspended' | 'left';
  joined_at: string;
  payment_status: string | null;
  user?: UserProfile;
};

export type CommunityPost = {
  id: number;
  community_id: number;
  user_id: string;
  text: string | null;
  media: any[] | null;
  hashtags: string[] | null;
  is_premium: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string | null;
  author: UserProfile;
  is_liked?: boolean;
};

export type CommunityPostComment = {
  id: number;
  post_id: number;
  user_id: string;
  text: string;
  parent_id: number | null;
  created_at: string;
  updated_at: string | null;
  author: UserProfile;
};

export type CommunityPostLike = {
  id: number;
  post_id: number;
  user_id: string;
  created_at: string;
};
    

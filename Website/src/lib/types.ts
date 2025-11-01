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

  // ✅ New persistent count fields from your DB
  like_count?: number;
  share_count?: number;
  save_count?: number;
  comment_count?: number;


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
  id: number;
  follower_id: string;
  following_id: string;
  created_at: string;
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

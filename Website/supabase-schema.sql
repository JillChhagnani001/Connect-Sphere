-- Connect-Sphere Database Schema
-- Run this in your Supabase SQL editor to set up the required tables

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  location TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT,
  media JSONB DEFAULT '[]'::jsonb,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private')),
  is_private BOOLEAN DEFAULT FALSE,
  location TEXT,
  hashtags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create shares table
CREATE TABLE IF NOT EXISTS shares (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create follows table
CREATE TABLE IF NOT EXISTS follows (
  id SERIAL PRIMARY KEY,
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Create stories table
CREATE TABLE IF NOT EXISTS stories (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create story_reactions table
CREATE TABLE IF NOT EXISTS story_reactions (
  id SERIAL PRIMARY KEY,
  story_id INTEGER REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

-- Create privacy_settings table
CREATE TABLE IF NOT EXISTS privacy_settings (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  profile_visibility TEXT DEFAULT 'public' CHECK (profile_visibility IN ('public', 'followers', 'private')),
  post_visibility TEXT DEFAULT 'public' CHECK (post_visibility IN ('public', 'followers', 'private')),
  show_online_status BOOLEAN DEFAULT TRUE,
  allow_follow_requests BOOLEAN DEFAULT TRUE,
  allow_direct_messages TEXT DEFAULT 'everyone' CHECK (allow_direct_messages IN ('everyone', 'followers', 'none')),
  show_followers BOOLEAN DEFAULT TRUE,
  show_following BOOLEAN DEFAULT TRUE,
  allow_tagging BOOLEAN DEFAULT TRUE,
  allow_mentions TEXT DEFAULT 'everyone' CHECK (allow_mentions IN ('everyone', 'followers', 'none')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories(expires_at);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for posts
CREATE POLICY "Users can view public posts" ON posts FOR SELECT USING (visibility = 'public' OR auth.uid() = user_id);
CREATE POLICY "Users can create their own posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for comments
CREATE POLICY "Users can view comments on visible posts" ON comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM posts 
    WHERE posts.id = comments.post_id 
    AND (posts.visibility = 'public' OR posts.user_id = auth.uid())
  )
);
CREATE POLICY "Users can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for likes
CREATE POLICY "Users can view likes on visible posts" ON likes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM posts 
    WHERE posts.id = likes.post_id 
    AND (posts.visibility = 'public' OR posts.user_id = auth.uid())
  )
);
CREATE POLICY "Users can manage their own likes" ON likes FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for bookmarks
CREATE POLICY "Users can manage their own bookmarks" ON bookmarks FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for shares
CREATE POLICY "Users can view shares on visible posts" ON shares FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM posts 
    WHERE posts.id = shares.post_id 
    AND (posts.visibility = 'public' OR posts.user_id = auth.uid())
  )
);
CREATE POLICY "Users can create shares" ON shares FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for follows
CREATE POLICY "Users can view follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can manage their own follows" ON follows FOR ALL USING (auth.uid() = follower_id);
CREATE POLICY "Users can manage follows to them" ON follows FOR UPDATE USING (auth.uid() = following_id);

-- RLS Policies for stories
CREATE POLICY "Users can view stories from followed users" ON stories FOR SELECT USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM follows 
    WHERE follows.following_id = stories.user_id 
    AND follows.follower_id = auth.uid() 
    AND follows.status = 'accepted'
  )
);
CREATE POLICY "Users can create their own stories" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stories" ON stories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own stories" ON stories FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for story_reactions
CREATE POLICY "Users can view story reactions" ON story_reactions FOR SELECT USING (true);
CREATE POLICY "Users can manage their own story reactions" ON story_reactions FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for privacy_settings
CREATE POLICY "Users can view their own privacy settings" ON privacy_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own privacy settings" ON privacy_settings FOR ALL USING (auth.uid() = user_id);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

-- Storage policies
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Media files are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "Users can upload media files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own media files" ON storage.objects FOR UPDATE USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own media files" ON storage.objects FOR DELETE USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);


-- comments
create table if not exists comments (
  id serial primary key,
  post_id integer not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  parent_id integer references comments(id) on delete cascade,
  created_at timestamptz default now()
);
alter table comments enable row level security;
create policy if not exists "comments_select" on comments for select using (true);
create policy if not exists "comments_insert" on comments for insert with check (auth.uid() = user_id);

-- likes
create table if not exists likes (
  id serial primary key,
  post_id integer not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);
alter table likes enable row level security;
create policy if not exists "likes_all" on likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- bookmarks
create table if not exists bookmarks (
  id serial primary key,
  post_id integer not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);
alter table bookmarks enable row level security;
create policy if not exists "bookmarks_all" on bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

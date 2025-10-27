# Database Setup Guide

## Quick Setup

1. **Go to your Supabase Dashboard**
   - Navigate to your project
   - Go to the SQL Editor

2. **Run the Schema**
   - Copy the contents of `supabase-schema.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute the schema

3. **Verify Tables Created**
   - Go to Table Editor in Supabase
   - You should see these tables:
     - `profiles`
     - `posts`
     - `comments`
     - `likes`
     - `bookmarks`
     - `shares`
     - `follows`
     - `stories`
     - `story_reactions`
     - `privacy_settings`

## What the Schema Includes

### Tables
- **profiles**: User profile information
- **posts**: Social media posts with privacy controls
- **comments**: Threaded comments system
- **likes**: Post likes with unique constraints
- **bookmarks**: Post bookmarks/saves
- **shares**: Post sharing tracking
- **follows**: User following system with request management
- **stories**: Temporary story posts
- **story_reactions**: Story reaction system
- **privacy_settings**: User privacy preferences

### Security
- Row Level Security (RLS) enabled on all tables
- Proper policies for data access control
- User can only modify their own data
- Public posts are visible to everyone
- Private posts only visible to the author

### Storage
- `avatars` bucket for profile pictures
- `media` bucket for post media files
- Proper access policies for file uploads

### Triggers
- Automatic profile creation when user signs up
- Handles new user registration seamlessly

## Troubleshooting

If you're still getting errors:

1. **Check if tables exist**:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

2. **Check RLS policies**:
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

3. **Test profile creation manually**:
   ```sql
   INSERT INTO profiles (id, display_name, username, bio) 
   VALUES ('your-user-id', 'Test User', 'testuser', 'Test bio');
   ```

4. **Check storage buckets**:
   ```sql
   SELECT * FROM storage.buckets;
   ```

## Environment Variables

Make sure your `.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Next Steps

After running the schema:
1. Test user registration
2. Try updating your profile
3. Create a test post
4. Test following/unfollowing users


-- =========================
-- 1) ENUMS (create if missing)
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_type') THEN
    CREATE TYPE membership_type AS ENUM ('free', 'paid');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_role') THEN
    CREATE TYPE member_role AS ENUM ('owner', 'admin', 'moderator', 'member');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') THEN
    CREATE TYPE membership_status AS ENUM ('active', 'pending', 'suspended', 'left');
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_role')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum
       WHERE enumtypid = 'member_role'::regtype
         AND enumlabel = 'co_owner'
     )
  THEN
    ALTER TYPE member_role ADD VALUE 'co_owner';
  END IF;
END$$;

-- =========================
-- 2) TABLES (already IF NOT EXISTS)
-- =========================

-- communities (ensure default INR if you want INR)
ALTER TABLE public.communities
  ALTER COLUMN currency SET DEFAULT 'INR';

-- =========================
-- 3) TRIGGER FUNCTIONS (OR REPLACE is fine)
-- =========================

CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE communities
     SET member_count = (
       SELECT COUNT(*)
         FROM community_members
        WHERE community_id = COALESCE(NEW.community_id, OLD.community_id)
          AND status = 'active'
     )
   WHERE id = COALESCE(NEW.community_id, OLD.community_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_community_post_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE communities
     SET post_count = (
       SELECT COUNT(*)
         FROM community_posts
        WHERE community_id = COALESCE(NEW.community_id, OLD.community_id)
     )
   WHERE id = COALESCE(NEW.community_id, OLD.community_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_community_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_posts
     SET like_count = (
       SELECT COUNT(*)
         FROM community_post_likes
        WHERE post_id = COALESCE(NEW.post_id, OLD.post_id)
     )
   WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_community_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_posts
     SET comment_count = (
       SELECT COUNT(*)
         FROM community_post_comments
        WHERE post_id = COALESCE(NEW.post_id, OLD.post_id)
     )
   WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they already exist, then create
DROP TRIGGER IF EXISTS community_members_after_change ON community_members;
CREATE TRIGGER community_members_after_change
AFTER INSERT OR UPDATE OR DELETE ON community_members
FOR EACH ROW EXECUTE FUNCTION update_community_member_count();

DROP TRIGGER IF EXISTS community_posts_after_change ON community_posts;
CREATE TRIGGER community_posts_after_change
AFTER INSERT OR DELETE ON community_posts
FOR EACH ROW EXECUTE FUNCTION update_community_post_count();

DROP TRIGGER IF EXISTS community_post_likes_after_change ON community_post_likes;
CREATE TRIGGER community_post_likes_after_change
AFTER INSERT OR DELETE ON community_post_likes
FOR EACH ROW EXECUTE FUNCTION update_community_post_like_count();

DROP TRIGGER IF EXISTS community_post_comments_after_change ON community_post_comments;
CREATE TRIGGER community_post_comments_after_change
AFTER INSERT OR DELETE ON community_post_comments
FOR EACH ROW EXECUTE FUNCTION update_community_post_comment_count();

-- =========================
-- 4) RLS (enable is idempotent; policies must be unique)
-- =========================

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist, then recreate.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communities' AND policyname='Communities are viewable by everyone') THEN
    DROP POLICY "Communities are viewable by everyone" ON public.communities;
  END IF;
END $$;
CREATE POLICY "Communities are viewable by everyone" ON public.communities FOR SELECT USING (true);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communities' AND policyname='Users can create communities') THEN
    DROP POLICY "Users can create communities" ON public.communities;
  END IF;
END $$;
CREATE POLICY "Users can create communities" ON public.communities FOR INSERT WITH CHECK (auth.uid() = owner_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communities' AND policyname='Users can update their own communities') THEN
    DROP POLICY "Users can update their own communities" ON public.communities;
  END IF;
END $$;
CREATE POLICY "Users can update their own communities" ON public.communities FOR UPDATE USING (auth.uid() = owner_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_members' AND policyname='Community members are viewable by everyone') THEN
    DROP POLICY "Community members are viewable by everyone" ON public.community_members;
  END IF;
END $$;
CREATE POLICY "Community members are viewable by everyone" ON public.community_members FOR SELECT USING (true);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_members' AND policyname='Users can join communities') THEN
    DROP POLICY "Users can join communities" ON public.community_members;
  END IF;
END $$;
CREATE POLICY "Users can join communities" ON public.community_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_members' AND policyname='Users can leave communities') THEN
    DROP POLICY "Users can leave communities" ON public.community_members;
  END IF;
END $$;
CREATE POLICY "Users can leave communities" ON public.community_members FOR DELETE USING (auth.uid() = user_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_members' AND policyname='Users can update their own membership') THEN
    DROP POLICY "Users can update their own membership" ON public.community_members;
  END IF;
END $$;
CREATE POLICY "Users can update their own membership" ON public.community_members FOR UPDATE USING (auth.uid() = user_id);

-- Posts policies
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_posts' AND policyname='Community posts are viewable by members') THEN
    DROP POLICY "Community posts are viewable by members" ON public.community_posts;
  END IF;
END $$;
CREATE POLICY "Community posts are viewable by members"
  ON public.community_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_posts.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.status = 'active'
        AND (
          NOT community_posts.is_premium
          OR community_members.role IN ('owner','co_owner','admin','moderator')
          OR EXISTS (
            SELECT 1 FROM communities c
            WHERE c.id = community_posts.community_id
              AND c.membership_type = 'paid'
          )
        )
      AND community_members.role IN ('owner','co_owner')
    )
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_posts' AND policyname='Members can create posts in communities they belong to') THEN
    DROP POLICY "Members can create posts in communities they belong to" ON public.community_posts;
  END IF;
END $$;
CREATE POLICY "Members can create posts in communities they belong to"
  ON public.community_posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_posts.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.status = 'active'
    )
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_posts' AND policyname='Users can update their own posts') THEN
    DROP POLICY "Users can update their own posts" ON public.community_posts;
  END IF;
END $$;
CREATE POLICY "Users can update their own posts" ON public.community_posts FOR UPDATE USING (auth.uid() = user_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_posts' AND policyname='Users can delete their own posts') THEN
    DROP POLICY "Users can delete their own posts" ON public.community_posts;
  END IF;
END $$;
CREATE POLICY "Users can delete their own posts" ON public.community_posts FOR DELETE USING (auth.uid() = user_id);

-- Likes policies
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_post_likes' AND policyname='Community post likes are viewable by everyone') THEN
    DROP POLICY "Community post likes are viewable by everyone" ON public.community_post_likes;
  END IF;
END $$;
CREATE POLICY "Community post likes are viewable by everyone" ON public.community_post_likes FOR SELECT USING (true);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_post_likes' AND policyname='Members can like posts') THEN
    DROP POLICY "Members can like posts" ON public.community_post_likes;
  END IF;
END $$;
CREATE POLICY "Members can like posts"
  ON public.community_post_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM community_members cm
      JOIN community_posts cp ON cp.id = community_post_likes.post_id
      WHERE cm.community_id = cp.community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_post_likes' AND policyname='Users can unlike their own likes') THEN
    DROP POLICY "Users can unlike their own likes" ON public.community_post_likes;
  END IF;
END $$;
CREATE POLICY "Users can unlike their own likes" ON public.community_post_likes FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_post_comments' AND policyname='Community post comments are viewable by members') THEN
    DROP POLICY "Community post comments are viewable by members" ON public.community_post_comments;
  END IF;
END $$;
CREATE POLICY "Community post comments are viewable by members"
  ON public.community_post_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      JOIN community_posts cp ON cp.id = community_post_comments.post_id
      WHERE cm.community_id = cp.community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_post_comments' AND policyname='Members can comment on posts') THEN
    DROP POLICY "Members can comment on posts" ON public.community_post_comments;
  END IF;
END $$;
CREATE POLICY "Members can comment on posts"
  ON public.community_post_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM community_members cm
      JOIN community_posts cp ON cp.id = community_post_comments.post_id
      WHERE cm.community_id = cp.community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_post_comments' AND policyname='Users can update their own comments') THEN
    DROP POLICY "Users can update their own comments" ON public.community_post_comments;
  END IF;
END $$;
CREATE POLICY "Users can update their own comments" ON public.community_post_comments FOR UPDATE USING (auth.uid() = user_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='community_post_comments' AND policyname='Users can delete their own comments') THEN
    DROP POLICY "Users can delete their own comments" ON public.community_post_comments;
  END IF;
END $$;
CREATE POLICY "Users can delete their own comments" ON public.community_post_comments FOR DELETE USING (auth.uid() = user_id);

-- =========================
-- 5) PAYMENTS (Razorpay) — new tables
-- =========================

-- Orders you create before opening checkout
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  community_id BIGINT NOT NULL,
  user_id UUID NOT NULL,
  amount_paise BIGINT NOT NULL,          -- store in paise for Razorpay
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT UNIQUE,         -- from Razorpay /orders
  status TEXT NOT NULL DEFAULT 'created',-- created|attempted|paid|failed|expired
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  CONSTRAINT payment_orders_community_fkey FOREIGN KEY (community_id) REFERENCES communities (id) ON DELETE CASCADE,
  CONSTRAINT payment_orders_user_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE
);

-- Payment confirmations (from handler + webhook)
CREATE TABLE IF NOT EXISTS public.payments (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  event TEXT,                             -- e.g., handler|payment.captured
  paid_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_order_fkey FOREIGN KEY (order_id) REFERENCES payment_orders (id) ON DELETE CASCADE
);

-- helpful index
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order ON public.payment_orders(razorpay_order_id);

-- Minimal RLS for orders/payments
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_orders' AND policyname='Users manage their orders') THEN
    CREATE POLICY "Users manage their orders"
      ON public.payment_orders
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='Users view their payments') THEN
    CREATE POLICY "Users view their payments"
      ON public.payments FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM payment_orders po
          WHERE po.id = payments.order_id
            AND po.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- After successful capture, you will:
-- 1) mark payment_orders.status='paid'
-- 2) set community_members.payment_status='paid', status='active', and expires_at (if subscription)
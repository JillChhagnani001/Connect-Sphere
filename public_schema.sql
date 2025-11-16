--
-- PostgreSQL database dump
--

\restrict DVZsX9GCEQLeQCULGeILYaK1sw6AUVTwiN18tXg9oKPhKI88m3f9NyTN73aFsUY

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: collab_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.collab_status AS ENUM (
    'pending',
    'accepted',
    'declined'
);


ALTER TYPE public.collab_status OWNER TO postgres;

--
-- Name: member_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.member_role AS ENUM (
    'owner',
    'admin',
    'moderator',
    'member',
    'co_owner'
);


ALTER TYPE public.member_role OWNER TO postgres;

--
-- Name: membership_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.membership_status AS ENUM (
    'active',
    'pending',
    'suspended',
    'left'
);


ALTER TYPE public.membership_status OWNER TO postgres;

--
-- Name: membership_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.membership_type AS ENUM (
    'free',
    'paid'
);


ALTER TYPE public.membership_type OWNER TO postgres;

--
-- Name: privacy_level; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.privacy_level AS ENUM (
    'public',
    'private',
    'followers'
);


ALTER TYPE public.privacy_level OWNER TO postgres;

--
-- Name: reaction_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.reaction_type AS ENUM (
    'like',
    'love',
    'laugh',
    'wow',
    'sad',
    'angry'
);


ALTER TYPE public.reaction_type OWNER TO postgres;

--
-- Name: report_category; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.report_category AS ENUM (
    'harassment_or_bullying',
    'hate_or_violence',
    'sexual_or_graphic_content',
    'fraud_or_scam',
    'impersonation',
    'spam',
    'other'
);


ALTER TYPE public.report_category OWNER TO postgres;

--
-- Name: report_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.report_status AS ENUM (
    'pending',
    'under_review',
    'action_taken',
    'dismissed'
);


ALTER TYPE public.report_status OWNER TO postgres;

--
-- Name: request_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.request_status AS ENUM (
    'pending',
    'accepted',
    'declined'
);


ALTER TYPE public.request_status OWNER TO postgres;

--
-- Name: accept_all_follow_requests(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.accept_all_follow_requests(user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  -- 1. Insert all pending requests into followers

  INSERT INTO public.followers (follower_id, following_id)

  SELECT follower_id, following_id FROM public.follow_requests

  WHERE following_id = user_id

  ON CONFLICT (follower_id, following_id) DO NOTHING;



  -- 2. Delete all those requests

  DELETE FROM public.follow_requests

  WHERE following_id = user_id;

END;

$$;


ALTER FUNCTION public.accept_all_follow_requests(user_id uuid) OWNER TO postgres;

--
-- Name: accept_collab_invite(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.accept_collab_invite(invite_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

DECLARE

  v_post_id bigint;

  v_invitee_id uuid;

BEGIN

  -- Verify invite exists, belongs to current user, AND is pending

  SELECT post_id, invitee_id INTO v_post_id, v_invitee_id

  FROM public.collaboration_invites

  WHERE id = invite_id AND invitee_id = auth.uid() AND status = 'pending';



  IF NOT FOUND THEN

     RAISE EXCEPTION 'Invite not found or already processed';

  END IF;



  -- Mark invite as accepted

  UPDATE public.collaboration_invites

  SET status = 'accepted', accepted_at = now(), responded_at = now()

  WHERE id = invite_id;



  -- Add user to the post's collaborators list

  UPDATE public.posts

  SET collaborators = COALESCE(collaborators, '[]'::jsonb) || jsonb_build_object(

      'user_id', v_invitee_id,

      'role', 'coauthor',

      'accepted', true,

      'accepted_at', now()

  ),

  collaborator_count = COALESCE(collaborator_count, 0) + 1

  WHERE id = v_post_id;

END;

$$;


ALTER FUNCTION public.accept_collab_invite(invite_id bigint) OWNER TO postgres;

--
-- Name: accept_collaboration_invite(bigint, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.accept_collaboration_invite(p_invite_id bigint, p_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

declare

  invite_row collaboration_invites;

  new_collaborator jsonb;

  now_ts timestamptz := now();

begin

  -- 1. Get the invite and lock the row

  select * into invite_row

  from public.collaboration_invites

  where id = p_invite_id

  for update; -- This lock prevents race conditions



  -- 2. Check permissions

  if invite_row is null then

    raise exception 'Invite not found';

  end if;

  if invite_row.invitee_id != p_user_id then

    raise exception 'Not authorized to accept this invite';

  end if;

  if invite_row.status != 'pending' then

    raise exception 'Invite is not pending';

  end if;



  -- 3. Create the new collaborator object

  new_collaborator := jsonb_build_object(

    'user_id', invite_row.invitee_id,

    'role', invite_row.role,

    'accepted', true, -- ⬅️ This is the logic you wanted

    'invited_at', invite_row.invited_at,

    'accepted_at', now_ts

  );



  -- 4. Atomically update the post, adding the user to the array

  update public.posts

  set collaborators = collaborators || new_collaborator

  where id = invite_row.post_id

  -- This check prevents adding the user if they are already in the array

  and not (collaborators @> jsonb_build_array(jsonb_build_object('user_id', invite_row.invitee_id)));



  -- 5. Update the invite status

  update public.collaboration_invites

  set

    status = 'accepted',

    accepted_at = now_ts,

    responded_at = now_ts

  where id = p_invite_id;



  -- 6. Return the necessary data for the notification

  return json_build_object(

    'id', invite_row.id,

    'post_id', invite_row.post_id,

    'inviter_id', invite_row.inviter_id,

    'invitee_id', invite_row.invitee_id,

    'status', 'accepted'

  );



exception

  when others then

    return json_build_object('error', SQLERRM);

end;

$$;


ALTER FUNCTION public.accept_collaboration_invite(p_invite_id bigint, p_user_id uuid) OWNER TO postgres;

--
-- Name: accept_follow_request(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.accept_follow_request(request_follower_id uuid, request_following_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  -- 1. Insert into followers table

  INSERT INTO public.followers (follower_id, following_id)

  VALUES (request_follower_id, request_following_id)

  ON CONFLICT (follower_id, following_id) DO NOTHING;



  -- 2. Delete from follow_requests table

  DELETE FROM public.follow_requests

  WHERE follower_id = request_follower_id AND following_id = request_following_id;

END;

$$;


ALTER FUNCTION public.accept_follow_request(request_follower_id uuid, request_following_id uuid) OWNER TO postgres;

--
-- Name: create_collab_notification(uuid, text, bigint, bigint, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_collab_notification(p_user_id uuid, p_event text, p_invite_id bigint, p_post_id bigint, p_inviter_id uuid, p_invitee_id uuid, p_status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

declare

  now_ts timestamptz := now();

  notification_data jsonb;

begin

  -- Build the 'data' payload

  if p_event = 'invited' then

    notification_data := jsonb_build_object('post_id', p_post_id, 'inviter_id', p_inviter_id);

  else

    notification_data := jsonb_build_object('post_id', p_post_id, 'invitee_id', p_invitee_id);

  end if;



  -- Insert the notification

  insert into public.collaboration_notifications(

    user_id,

    event,

    invite_id,

    post_id,

    inviter_id,

    invitee_id,

    status,

    data,

    created_at,

    read

  )

  values (

    p_user_id,

    p_event,

    p_invite_id,

    p_post_id,

    p_inviter_id,

    p_invitee_id,

    p_status,

    notification_data,

    now_ts,

    false

  );



end;

$$;


ALTER FUNCTION public.create_collab_notification(p_user_id uuid, p_event text, p_invite_id bigint, p_post_id bigint, p_inviter_id uuid, p_invitee_id uuid, p_status text) OWNER TO postgres;

--
-- Name: create_profile_for_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_profile_for_new_user() RETURNS trigger
    LANGUAGE plpgsql
    AS $$begin

  insert into public.profiles (id, display_name, username, avatar_url)

  values (

    new.id,

    new.raw_user_meta_data->>'full_name',

    -- Use the email's user part as a fallback for the username if not provided

    coalesce(new.raw_user_meta_data->>'user_name', split_part(new.email, '@', 1)),

    new.raw_user_meta_data->>'avatar_url'

  );

  return new;

end;$$;


ALTER FUNCTION public.create_profile_for_new_user() OWNER TO postgres;

--
-- Name: decline_collab_invite(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.decline_collab_invite(invite_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

BEGIN

  -- Update status to declined if it belongs to user and is pending

  UPDATE public.collaboration_invites

  SET status = 'declined', responded_at = now()

  WHERE id = invite_id AND invitee_id = auth.uid() AND status = 'pending';



  IF NOT FOUND THEN

     RAISE EXCEPTION 'Invite not found or already processed';

  END IF;

END;

$$;


ALTER FUNCTION public.decline_collab_invite(invite_id bigint) OWNER TO postgres;

--
-- Name: decline_collaboration_invite(bigint, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.decline_collaboration_invite(p_invite_id bigint, p_user_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

declare

  invite_row collaboration_invites;

  now_ts timestamptz := now();

  new_status text;

begin

  -- 1. Get the invite and lock the row

  select * into invite_row

  from public.collaboration_invites

  where id = p_invite_id

  for update;



  -- 2. Check permissions

  if invite_row is null then

    raise exception 'Invite not found';

  end if;

  

  -- Allow either invitee (declining) or inviter (revoking)

  if invite_row.invitee_id != p_user_id and invite_row.inviter_id != p_user_id then

    raise exception 'Not authorized to modify this invite';

  end if;

  

  if invite_row.status != 'pending' then

    raise exception 'Invite is not pending';

  end if;

  

  -- 3. Determine new status

  if invite_row.invitee_id = p_user_id then

    new_status := 'declined';

  else

    new_status := 'revoked'; -- Inviter is acting

  end if;



  -- 4. Update the invite status

  update public.collaboration_invites

  set

    status = new_status,

    responded_at = now_ts

  where id = p_invite_id;



  -- 5. Return data for notification

  return json_build_object(

    'id', invite_row.id,

    'post_id', invite_row.post_id,

    'inviter_id', invite_row.inviter_id,

    'invitee_id', invite_row.invitee_id,

    'status', new_status

  );

  

exception

  when others then

    return json_build_object('error', SQLERRM);

end;

$$;


ALTER FUNCTION public.decline_collaboration_invite(p_invite_id bigint, p_user_id uuid) OWNER TO postgres;

--
-- Name: get_all_suggestions(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_all_suggestions(current_user_id uuid) RETURNS TABLE(id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, display_name text, username text, bio text, avatar_url text, website text, location text, follower_count integer, following_count integer, is_verified boolean, is_private boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

DECLARE

    suggestion_count integer;

BEGIN

    -- Create temp table with specific columns

    CREATE TEMP TABLE temp_suggestions (

        id uuid,

        created_at timestamptz,

        updated_at timestamptz,

        display_name text,

        username text,

        bio text,

        avatar_url text,

        website text,

        location text,

        follower_count integer,

        following_count integer,

        is_verified boolean,

        is_private boolean

    ) ON COMMIT DROP;



    -- Track users we already follow or have requested

    CREATE TEMP TABLE already_connected AS (

      SELECT following_id FROM followers WHERE follower_id = current_user_id

      UNION

      SELECT following_id FROM follow_requests WHERE follower_id = current_user_id

    );



    -- Strategy 1: Friends of Friends

    INSERT INTO temp_suggestions

    WITH my_followings AS (

        SELECT following_id FROM followers WHERE follower_id = current_user_id

    ),

    suggestions AS (

        SELECT f2.following_id AS suggested_user_id, COUNT(*) as mutual_count

        FROM followers f2

        WHERE f2.follower_id IN (SELECT following_id FROM my_followings)

        GROUP BY f2.following_id

    )

    -- 🟢 FIX: Added the missing SELECT keyword below

    SELECT 

        p.id, 

        p.created_at, 

        p.updated_at, 

        p.display_name, 

        p.username, 

        p.bio, 

        p.avatar_url, 

        p.website, 

        p.location, 

        p.follower_count, 

        p.following_count, 

        p.is_verified,

        (COALESCE(ps.profile_visibility, 'public') != 'public') as is_private

    FROM profiles p

    JOIN suggestions s ON p.id = s.suggested_user_id

    LEFT JOIN privacy_settings ps ON p.id = ps.user_id 

    WHERE p.id != current_user_id

    AND p.id NOT IN (SELECT following_id FROM already_connected)

    ORDER BY s.mutual_count DESC

    LIMIT 5;



    GET DIAGNOSTICS suggestion_count = ROW_COUNT;



    -- Strategy 2: Popular Users (Fallback)

    IF suggestion_count < 5 THEN

        INSERT INTO temp_suggestions

        SELECT 

            p.id, 

            p.created_at, 

            p.updated_at, 

            p.display_name, 

            p.username, 

            p.bio, 

            p.avatar_url, 

            p.website, 

            p.location, 

            p.follower_count, 

            p.following_count, 

            p.is_verified,

            (COALESCE(ps.profile_visibility, 'public') != 'public') as is_private

        FROM profiles p

        LEFT JOIN privacy_settings ps ON p.id = ps.user_id 

        WHERE p.id != current_user_id

        AND p.id NOT IN (SELECT following_id FROM already_connected)

        AND p.id NOT IN (SELECT ts.id FROM temp_suggestions ts) 

        ORDER BY p.follower_count DESC, p.created_at DESC

        LIMIT (5 - suggestion_count); 

    END IF;



    DROP TABLE already_connected;

    

    RETURN QUERY SELECT * FROM temp_suggestions;

END;

$$;


ALTER FUNCTION public.get_all_suggestions(current_user_id uuid) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posts (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    text text,
    media jsonb[],
    hashtags text[],
    location text,
    visibility public.privacy_level DEFAULT 'public'::public.privacy_level NOT NULL,
    is_private boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    like_count integer DEFAULT 0,
    share_count integer DEFAULT 0,
    save_count integer DEFAULT 0,
    comment_count integer DEFAULT 0,
    collaborators jsonb DEFAULT '[]'::jsonb,
    collaborator_count integer DEFAULT 0
);


ALTER TABLE public.posts OWNER TO postgres;

--
-- Name: TABLE posts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.posts IS 'Stores all user posts, including text, media, and metadata.';


--
-- Name: get_home_feed(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_home_feed(current_user_id uuid) RETURNS SETOF public.posts
    LANGUAGE sql SECURITY DEFINER
    AS $$

  SELECT *

  FROM posts

  WHERE 

    -- 1. Include my own posts

    user_id = current_user_id

    OR 

    -- 2. Include posts from people I follow

    user_id IN (

      SELECT following_id 

      FROM followers 

      WHERE follower_id = current_user_id

    )

  ORDER BY created_at DESC;

$$;


ALTER FUNCTION public.get_home_feed(current_user_id uuid) OWNER TO postgres;

--
-- Name: get_mutual_count(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_mutual_count(viewer_id uuid, target_id uuid) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    AS $$

  SELECT count(*)

  FROM followers f1

  JOIN followers f2 ON f1.following_id = f2.follower_id

  WHERE f1.follower_id = viewer_id  -- People the viewer follows

  AND f2.following_id = target_id;  -- Who also follow the target profile

$$;


ALTER FUNCTION public.get_mutual_count(viewer_id uuid, target_id uuid) OWNER TO postgres;

--
-- Name: get_or_create_conversation_with_user(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_or_create_conversation_with_user(other_user_id uuid) RETURNS TABLE(id integer, created_at timestamp with time zone, participants json, last_message json, unread_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

DECLARE

    found_conversation_id int;

BEGIN

    -- Find existing conversation

    SELECT cp1.conversation_id INTO found_conversation_id

    FROM conversation_participants AS cp1

    JOIN conversation_participants AS cp2 ON cp1.conversation_id = cp2.conversation_id

    WHERE cp1.user_id = auth.uid() AND cp2.user_id = other_user_id;



    -- If not found, create a new one

    IF found_conversation_id IS NULL THEN

        INSERT INTO conversations DEFAULT VALUES

        RETURNING conversations.id INTO found_conversation_id;



        INSERT INTO conversation_participants (conversation_id, user_id)

        VALUES (found_conversation_id, auth.uid()), (found_conversation_id, other_user_id);

    END IF;



    -- Return the full conversation object

    RETURN QUERY

    SELECT

        c.id,

        c.created_at,

        (SELECT json_agg(p_json)

         FROM (

             SELECT p.id, p.display_name, p.username, p.avatar_url

             FROM conversation_participants cp

             JOIN profiles p ON cp.user_id = p.id

             WHERE cp.conversation_id = c.id

         ) p_json

        ) AS participants,

        (SELECT json_build_object(

            'id', m.id,

            'content', m.content,

            'created_at', m.created_at,

            'sender', (SELECT json_build_object('id', s.id, 'display_name', s.display_name, 'username', s.username, 'avatar_url', s.avatar_url) FROM profiles s WHERE s.id = m.sender)

          )

         FROM messages m

         WHERE m.conversation_id = c.id

         ORDER BY m.created_at DESC

         LIMIT 1

        ) AS last_message,

        (SELECT count(*)::int FROM messages m WHERE m.conversation_id = c.id AND m.is_read = false AND m.sender <> auth.uid()) as unread_count

    FROM conversations c

    WHERE c.id = found_conversation_id;

END;

$$;


ALTER FUNCTION public.get_or_create_conversation_with_user(other_user_id uuid) OWNER TO postgres;

--
-- Name: handle_lost_follower(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_lost_follower() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

    -- Recalculate the unfollower's 'following' count (The person who just unfollowed)

    UPDATE public.profiles

    SET following_count = (

        SELECT COUNT(*) 

        FROM public.followers 

        WHERE follower_id = OLD.follower_id

    )

    WHERE id = OLD.follower_id;



    -- Recalculate the unfollowed user's 'followers' count (The person who was just unfollowed)

    UPDATE public.profiles

    SET follower_count = (

        SELECT COUNT(*) 

        FROM public.followers 

        WHERE following_id = OLD.following_id

    )

    WHERE id = OLD.following_id;



    RETURN OLD;

END;

$$;


ALTER FUNCTION public.handle_lost_follower() OWNER TO postgres;

--
-- Name: handle_new_collab_invite(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_collab_invite() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

BEGIN

  -- Insert into generic notifications table so it appears in the main list

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, metadata)

  VALUES (

    NEW.invitee_id,

    NEW.inviter_id,

    'system', 

    'Collaboration Invite',

    'invited you to collaborate on a post.',

    jsonb_build_object('invite_id', NEW.id, 'post_id', NEW.post_id)

  );

  RETURN NEW;

END;

$$;


ALTER FUNCTION public.handle_new_collab_invite() OWNER TO postgres;

--
-- Name: handle_new_follower(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_follower() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

    -- Recalculate the follower's 'following' count (The person who just followed)

    UPDATE public.profiles

    SET following_count = (

        SELECT COUNT(*) 

        FROM public.followers 

        WHERE follower_id = NEW.follower_id

    )

    WHERE id = NEW.follower_id;



    -- Recalculate the followed user's 'followers' count (The person who was just followed)

    UPDATE public.profiles

    SET follower_count = (

        SELECT COUNT(*) 

        FROM public.followers 

        WHERE following_id = NEW.following_id

    )

    WHERE id = NEW.following_id;



    RETURN NEW;

END;

$$;


ALTER FUNCTION public.handle_new_follower() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

BEGIN

  INSERT INTO public.profiles (id, username, display_name, avatar_url)

  VALUES (new.id, new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');

  

  INSERT INTO public.privacy_settings (user_id)

  VALUES (new.id);

  

  RETURN new;

END;

$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: handle_new_user_report(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user_report() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  UPDATE public.profiles

  SET report_count = report_count + 1,

      last_reported_at = now(),

      verification_score = GREATEST(verification_score - 5, 0)

  WHERE id = NEW.reported_id;



  RETURN NEW;

END;

$$;


ALTER FUNCTION public.handle_new_user_report() OWNER TO postgres;

--
-- Name: handle_user_report_status_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_user_report_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  IF NEW.status = 'action_taken'::public.report_status

     AND OLD.status IS DISTINCT FROM NEW.status THEN

    UPDATE public.profiles

    SET violation_count = violation_count + 1,

        verification_score = GREATEST(verification_score - 10, 0),

        is_verified = false

    WHERE id = NEW.reported_id;

  END IF;



  RETURN NEW;

END;

$$;


ALTER FUNCTION public.handle_user_report_status_change() OWNER TO postgres;

--
-- Name: manage_follow_counts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.manage_follow_counts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

    -- --- 1. INSERT (Follow Action) ---

    IF (TG_OP = 'INSERT') THEN

        -- Increment FOLLOWING count for the follower immediately (User A's profile)

        UPDATE profiles

        SET following_count = COALESCE(following_count, 0) + 1

        WHERE id = NEW.follower_id;



        -- Increment FOLLOWER count for the followed user (User B's profile)

        -- ONLY if the follow status is 'accepted' (i.e., not a private profile request)

        IF NEW.status = 'accepted' THEN

            UPDATE profiles

            SET follower_count = COALESCE(follower_count, 0) + 1

            WHERE id = NEW.following_id;

        END IF;



        RETURN NEW;



    -- --- 2. DELETE (Unfollow/Cancel Request Action) ---

    ELSIF (TG_OP = 'DELETE') THEN

        -- Decrement FOLLOWING count for the follower immediately (User A's profile)

        UPDATE profiles

        SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0)

        WHERE id = OLD.follower_id;



        -- Decrement FOLLOWER count for the followed user (User B's profile)

        -- ONLY if the follow status was 'accepted' (we don't decrement for 'pending' requests)

        IF OLD.status = 'accepted' THEN

            UPDATE profiles

            SET follower_count = GREATEST(COALESCE(follower_count, 0) - 1, 0)

            WHERE id = OLD.following_id;

        END IF;



        RETURN OLD;

    END IF;



    RETURN NULL;

END;

$$;


ALTER FUNCTION public.manage_follow_counts() OWNER TO postgres;

--
-- Name: notify_follow(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_follow() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

begin

  if new.status = 'accepted' then

    insert into notifications(user_id, actor_id, type, title, body)

    values (

      new.following_id,

      new.follower_id,

      'follow',

      'You have a new follower',

      'Someone started following you'

    );

  end if;

  return new;

end;

$$;


ALTER FUNCTION public.notify_follow() OWNER TO postgres;

--
-- Name: notify_on_collab_accepted(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_collab_accepted() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN

    INSERT INTO public.notifications (user_id, actor_id, type, title, body, metadata)

    VALUES (

      NEW.inviter_id,

      NEW.invitee_id,

      'system',

      'Collaboration Accepted',

      'accepted your collaboration invite.',

      jsonb_build_object('post_id', NEW.post_id)

    );

  END IF;

  RETURN NEW;

END;

$$;


ALTER FUNCTION public.notify_on_collab_accepted() OWNER TO postgres;

--
-- Name: notify_on_collab_invite(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_on_collab_invite() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  INSERT INTO public.notifications (user_id, actor_id, type, title, body, metadata)

  VALUES (

    NEW.invitee_id,

    NEW.inviter_id,

    'system',

    'Collaboration Invite',

    'You have been invited to collaborate on a post.',

    jsonb_build_object('post_id', NEW.post_id, 'invite_id', NEW.id)

  );

  RETURN NEW;

END;

$$;


ALTER FUNCTION public.notify_on_collab_invite() OWNER TO postgres;

--
-- Name: notify_post_comment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_post_comment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

declare

  post_owner uuid;

begin

  -- Get the post owner

  select user_id into post_owner from posts where id = new.post_id;

  

  -- Skip if post not found or if user is commenting on their own post

  if post_owner is null or post_owner = new.user_id then

    return new;

  end if;

  

  -- Insert notification

  insert into notifications(user_id, actor_id, type, title, body, metadata)

  values (

    post_owner,

    new.user_id,

    'comment',

    'New comment on your post',

    new.text,

    jsonb_build_object('post_id', new.post_id, 'comment_id', new.id)

  );

  

  return new;

end;

$$;


ALTER FUNCTION public.notify_post_comment() OWNER TO postgres;

--
-- Name: notify_post_like(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_post_like() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

declare

  post_owner uuid;

begin

  select user_id into post_owner from posts where id = new.post_id;

  if post_owner is null or post_owner = new.user_id then

    return new; -- skip self-like

  end if;

  insert into notifications(user_id, actor_id, type, title, body, metadata)

  values (

    post_owner,

    new.user_id,

    'like',

    'New like on your post',

    'Someone liked your post',

    jsonb_build_object('post_id', new.post_id)

  );

  return new;

end;

$$;


ALTER FUNCTION public.notify_post_like() OWNER TO postgres;

--
-- Name: refresh_profile_ban_state(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_profile_ban_state(target_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

declare

  active_record public.user_bans;

begin

  select ub.* into active_record

  from public.user_bans ub

  where ub.user_id = target_user

    and ub.lifted_at is null

    and (ub.expires_at is null or ub.expires_at > now())

  order by coalesce(ub.expires_at, 'infinity'::timestamptz) desc, ub.created_at desc

  limit 1;



  if found then

    update public.profiles

    set banned_until = active_record.expires_at,

        ban_reason = active_record.reason,

        ban_last_updated = now()

    where id = target_user;

  else

    update public.profiles

    set banned_until = null,

        ban_reason = null,

        ban_last_updated = now()

    where id = target_user;

  end if;

end;

$$;


ALTER FUNCTION public.refresh_profile_ban_state(target_user uuid) OWNER TO postgres;

--
-- Name: set_user_report_timestamps(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_user_report_timestamps() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

  NEW.updated_at := now();



  IF NEW.status IN ('action_taken'::public.report_status, 'dismissed'::public.report_status)

     AND NEW.resolved_at IS NULL THEN

    NEW.resolved_at := now();

  END IF;



  RETURN NEW;

END;

$$;


ALTER FUNCTION public.set_user_report_timestamps() OWNER TO postgres;

--
-- Name: update_collaborator_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_collaborator_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

  NEW.collaborator_count := COALESCE(jsonb_array_length(NEW.collaborators), 0);

  RETURN NEW;

END;

$$;


ALTER FUNCTION public.update_collaborator_count() OWNER TO postgres;

--
-- Name: update_comment_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_comment_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

DECLARE

  target_post INTEGER := COALESCE(NEW.post_id, OLD.post_id);

BEGIN

  UPDATE posts

  SET comment_count = (SELECT COUNT(*) FROM comments WHERE post_id = target_post)

  WHERE id = target_post;

  RETURN NEW;

END;

$$;


ALTER FUNCTION public.update_comment_count() OWNER TO postgres;

--
-- Name: update_comment_like_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_comment_like_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

    IF TG_OP = 'INSERT' THEN

        UPDATE comments

        SET like_count = like_count + 1

        WHERE id = NEW.comment_id;

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN

        UPDATE comments

        SET like_count = GREATEST(like_count - 1, 0)

        WHERE id = OLD.comment_id;

        RETURN OLD;

    END IF;

END;

$$;


ALTER FUNCTION public.update_comment_like_count() OWNER TO postgres;

--
-- Name: update_community_member_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_community_member_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

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

$$;


ALTER FUNCTION public.update_community_member_count() OWNER TO postgres;

--
-- Name: update_community_post_comment_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_community_post_comment_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

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

$$;


ALTER FUNCTION public.update_community_post_comment_count() OWNER TO postgres;

--
-- Name: update_community_post_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_community_post_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

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

$$;


ALTER FUNCTION public.update_community_post_count() OWNER TO postgres;

--
-- Name: update_community_post_like_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_community_post_like_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

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

$$;


ALTER FUNCTION public.update_community_post_like_count() OWNER TO postgres;

--
-- Name: update_like_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_like_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  UPDATE posts

  SET like_count = (SELECT COUNT(*) FROM likes WHERE post_id = NEW.post_id)

  WHERE id = NEW.post_id;

  RETURN NEW;

END;

$$;


ALTER FUNCTION public.update_like_count() OWNER TO postgres;

--
-- Name: update_save_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_save_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  UPDATE posts

  SET save_count = (SELECT COUNT(*) FROM bookmarks WHERE post_id = NEW.post_id)

  WHERE id = NEW.post_id;

  RETURN NEW;

END;

$$;


ALTER FUNCTION public.update_save_count() OWNER TO postgres;

--
-- Name: update_share_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_share_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

  UPDATE posts

  SET share_count = (SELECT COUNT(*) FROM shares WHERE post_id = NEW.post_id)

  WHERE id = NEW.post_id;

  RETURN NEW;

END;

$$;


ALTER FUNCTION public.update_share_count() OWNER TO postgres;

--
-- Name: user_bans_after_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.user_bans_after_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

begin

  perform public.refresh_profile_ban_state(new.user_id);

  return new;

end;

$$;


ALTER FUNCTION public.user_bans_after_change() OWNER TO postgres;

--
-- Name: user_bans_after_delete(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.user_bans_after_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$

begin

  perform public.refresh_profile_ban_state(old.user_id);

  return old;

end;

$$;


ALTER FUNCTION public.user_bans_after_delete() OWNER TO postgres;

--
-- Name: bookmarks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookmarks (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bookmarks OWNER TO postgres;

--
-- Name: TABLE bookmarks; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bookmarks IS 'Stores user bookmarks for posts.';


--
-- Name: bookmarks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.bookmarks ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.bookmarks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: collaboration_invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collaboration_invites (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    inviter_id uuid NOT NULL,
    invitee_id uuid NOT NULL,
    role text DEFAULT 'coauthor'::text,
    status text DEFAULT 'pending'::text NOT NULL,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    responded_at timestamp with time zone
);


ALTER TABLE public.collaboration_invites OWNER TO postgres;

--
-- Name: collaboration_invites_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.collaboration_invites ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.collaboration_invites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: collaboration_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collaboration_notifications (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    event text NOT NULL,
    invite_id bigint,
    post_id bigint,
    inviter_id uuid,
    invitee_id uuid,
    status text,
    data jsonb,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.collaboration_notifications OWNER TO postgres;

--
-- Name: collaboration_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.collaboration_notifications ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.collaboration_notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: comment_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comment_likes (
    user_id uuid NOT NULL,
    comment_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.comment_likes OWNER TO postgres;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    user_id uuid NOT NULL,
    text text NOT NULL,
    parent_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    like_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: TABLE comments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.comments IS 'Stores comments on posts, allowing for threaded conversations.';


--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.comments ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: communities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.communities (
    id bigint NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    cover_image_url text,
    avatar_url text,
    membership_type public.membership_type DEFAULT 'free'::public.membership_type NOT NULL,
    price numeric(10,2),
    currency text DEFAULT 'INR'::text,
    owner_id uuid NOT NULL,
    member_count integer DEFAULT 0,
    post_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.communities OWNER TO postgres;

--
-- Name: communities_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.communities ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.communities_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: community_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.community_members (
    id bigint NOT NULL,
    community_id bigint NOT NULL,
    user_id uuid NOT NULL,
    role public.member_role DEFAULT 'member'::public.member_role NOT NULL,
    status public.membership_status DEFAULT 'active'::public.membership_status NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_status text,
    payment_date timestamp with time zone,
    expires_at timestamp with time zone
);


ALTER TABLE public.community_members OWNER TO postgres;

--
-- Name: community_members_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.community_members ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.community_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: community_post_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.community_post_comments (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    user_id uuid NOT NULL,
    text text NOT NULL,
    parent_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.community_post_comments OWNER TO postgres;

--
-- Name: community_post_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.community_post_comments ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.community_post_comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: community_post_likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.community_post_likes (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.community_post_likes OWNER TO postgres;

--
-- Name: community_post_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.community_post_likes ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.community_post_likes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: community_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.community_posts (
    id bigint NOT NULL,
    community_id bigint NOT NULL,
    user_id uuid NOT NULL,
    text text,
    media jsonb[],
    hashtags text[],
    is_premium boolean DEFAULT false,
    like_count integer DEFAULT 0,
    comment_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.community_posts OWNER TO postgres;

--
-- Name: community_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.community_posts ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.community_posts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_participants (
    id bigint NOT NULL,
    conversation_id bigint NOT NULL,
    user_id uuid NOT NULL,
    last_read timestamp with time zone,
    hidden_at timestamp with time zone
);


ALTER TABLE public.conversation_participants OWNER TO postgres;

--
-- Name: conversation_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.conversation_participants ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.conversation_participants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.conversations ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.conversations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: follow_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.follow_requests (
    id bigint NOT NULL,
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.follow_requests OWNER TO postgres;

--
-- Name: follow_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.follow_requests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.follow_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: followers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.followers (
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.followers OWNER TO postgres;

--
-- Name: likes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.likes (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.likes OWNER TO postgres;

--
-- Name: TABLE likes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.likes IS 'Tracks likes on posts.';


--
-- Name: likes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.likes ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.likes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id bigint NOT NULL,
    conversation_id bigint NOT NULL,
    sender uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text,
    deleted_by uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    deleted_for_everyone boolean DEFAULT false NOT NULL
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.messages ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    type text NOT NULL,
    title text,
    body text,
    metadata jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payment_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_orders (
    id bigint NOT NULL,
    community_id bigint NOT NULL,
    user_id uuid NOT NULL,
    amount_paise bigint NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    razorpay_order_id text,
    status text DEFAULT 'created'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.payment_orders OWNER TO postgres;

--
-- Name: payment_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_orders ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.payment_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    razorpay_payment_id text,
    razorpay_signature text,
    event text,
    paid_at timestamp with time zone,
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.payments ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: posts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.posts ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.posts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: privacy_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.privacy_settings (
    user_id uuid NOT NULL,
    profile_visibility public.privacy_level DEFAULT 'public'::public.privacy_level NOT NULL,
    post_visibility public.privacy_level DEFAULT 'public'::public.privacy_level NOT NULL,
    show_online_status boolean DEFAULT true NOT NULL,
    allow_follow_requests boolean DEFAULT true NOT NULL,
    allow_direct_messages public.privacy_level DEFAULT 'public'::public.privacy_level NOT NULL,
    show_followers boolean DEFAULT true NOT NULL,
    show_following boolean DEFAULT true NOT NULL,
    allow_tagging boolean DEFAULT true NOT NULL,
    allow_mentions public.privacy_level DEFAULT 'public'::public.privacy_level NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.privacy_settings OWNER TO postgres;

--
-- Name: TABLE privacy_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.privacy_settings IS 'Manages privacy settings for each user.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    display_name text,
    username text,
    bio text,
    avatar_url text,
    website text,
    location text,
    follower_count integer DEFAULT 0,
    following_count integer DEFAULT 0,
    is_verified boolean DEFAULT false NOT NULL,
    verification_score integer DEFAULT 0,
    report_count integer DEFAULT 0 NOT NULL,
    violation_count integer DEFAULT 0 NOT NULL,
    last_reported_at timestamp with time zone,
    is_moderator boolean DEFAULT false NOT NULL,
    banned_until timestamp with time zone,
    ban_reason text,
    ban_last_updated timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.profiles IS 'Stores public profile information for each user.';


--
-- Name: shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shares (
    id bigint NOT NULL,
    post_id bigint NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.shares OWNER TO postgres;

--
-- Name: TABLE shares; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.shares IS 'Tracks when users share posts.';


--
-- Name: shares_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.shares ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.shares_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stories (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    media_url text NOT NULL,
    text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL
);


ALTER TABLE public.stories OWNER TO postgres;

--
-- Name: TABLE stories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.stories IS 'Stores temporary stories that expire after 24 hours.';


--
-- Name: stories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.stories ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.stories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: story_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.story_reactions (
    id bigint NOT NULL,
    story_id bigint NOT NULL,
    user_id uuid NOT NULL,
    reaction_type public.reaction_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.story_reactions OWNER TO postgres;

--
-- Name: TABLE story_reactions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.story_reactions IS 'Stores user reactions to stories.';


--
-- Name: story_reactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.story_reactions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.story_reactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_bans; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_bans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reason text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    lifted_at timestamp with time zone,
    lifted_by uuid,
    lift_reason text
);


ALTER TABLE public.user_bans OWNER TO postgres;

--
-- Name: user_blocks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_blocks (
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_blocks OWNER TO postgres;

--
-- Name: user_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_reports (
    id bigint NOT NULL,
    reporter_id uuid NOT NULL,
    reported_id uuid NOT NULL,
    category public.report_category NOT NULL,
    status public.report_status DEFAULT 'pending'::public.report_status NOT NULL,
    description text,
    evidence_urls text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    resolution_note text,
    CONSTRAINT user_reports_not_self CHECK ((reporter_id <> reported_id))
);


ALTER TABLE public.user_reports OWNER TO postgres;

--
-- Name: user_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_reports_id_seq OWNER TO postgres;

--
-- Name: user_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_reports_id_seq OWNED BY public.user_reports.id;


--
-- Name: user_reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports ALTER COLUMN id SET DEFAULT nextval('public.user_reports_id_seq'::regclass);


--
-- Name: bookmarks bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (id);


--
-- Name: bookmarks bookmarks_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: collaboration_invites collaboration_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_invites
    ADD CONSTRAINT collaboration_invites_pkey PRIMARY KEY (id);


--
-- Name: collaboration_invites collaboration_invites_post_id_invitee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_invites
    ADD CONSTRAINT collaboration_invites_post_id_invitee_id_key UNIQUE (post_id, invitee_id);


--
-- Name: collaboration_invites collaboration_invites_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_invites
    ADD CONSTRAINT collaboration_invites_unique UNIQUE (post_id, invitee_id);


--
-- Name: collaboration_notifications collaboration_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_notifications
    ADD CONSTRAINT collaboration_notifications_pkey PRIMARY KEY (id);


--
-- Name: comment_likes comment_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_likes
    ADD CONSTRAINT comment_likes_pkey PRIMARY KEY (user_id, comment_id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: communities communities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_pkey PRIMARY KEY (id);


--
-- Name: communities communities_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_slug_key UNIQUE (slug);


--
-- Name: community_members community_members_community_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_members
    ADD CONSTRAINT community_members_community_id_user_id_key UNIQUE (community_id, user_id);


--
-- Name: community_members community_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_members
    ADD CONSTRAINT community_members_pkey PRIMARY KEY (id);


--
-- Name: community_post_comments community_post_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_post_comments
    ADD CONSTRAINT community_post_comments_pkey PRIMARY KEY (id);


--
-- Name: community_post_likes community_post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_post_likes
    ADD CONSTRAINT community_post_likes_pkey PRIMARY KEY (id);


--
-- Name: community_post_likes community_post_likes_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_post_likes
    ADD CONSTRAINT community_post_likes_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: community_posts community_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: follow_requests follow_requests_follower_id_following_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_requests
    ADD CONSTRAINT follow_requests_follower_id_following_id_key UNIQUE (follower_id, following_id);


--
-- Name: follow_requests follow_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_requests
    ADD CONSTRAINT follow_requests_pkey PRIMARY KEY (id);


--
-- Name: followers followers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.followers
    ADD CONSTRAINT followers_pkey PRIMARY KEY (follower_id, following_id);


--
-- Name: likes likes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_pkey PRIMARY KEY (id);


--
-- Name: likes likes_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payment_orders payment_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_pkey PRIMARY KEY (id);


--
-- Name: payment_orders payment_orders_razorpay_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_razorpay_order_id_key UNIQUE (razorpay_order_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: privacy_settings privacy_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.privacy_settings
    ADD CONSTRAINT privacy_settings_pkey PRIMARY KEY (user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: shares shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_pkey PRIMARY KEY (id);


--
-- Name: stories stories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_pkey PRIMARY KEY (id);


--
-- Name: story_reactions story_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_reactions
    ADD CONSTRAINT story_reactions_pkey PRIMARY KEY (id);


--
-- Name: story_reactions story_reactions_story_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_reactions
    ADD CONSTRAINT story_reactions_story_id_user_id_key UNIQUE (story_id, user_id);


--
-- Name: conversation_participants uniq_conv_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT uniq_conv_user UNIQUE (conversation_id, user_id);


--
-- Name: shares unique_share_per_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT unique_share_per_user UNIQUE (post_id, user_id);


--
-- Name: user_bans user_bans_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_bans
    ADD CONSTRAINT user_bans_pkey PRIMARY KEY (id);


--
-- Name: user_blocks user_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id);


--
-- Name: user_reports user_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_pkey PRIMARY KEY (id);


--
-- Name: collaboration_invites_invitee_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX collaboration_invites_invitee_id_idx ON public.collaboration_invites USING btree (invitee_id);


--
-- Name: collaboration_invites_inviter_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX collaboration_invites_inviter_id_idx ON public.collaboration_invites USING btree (inviter_id);


--
-- Name: collaboration_notifications_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX collaboration_notifications_user_id_idx ON public.collaboration_notifications USING btree (user_id);


--
-- Name: idx_bookmarks_user_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bookmarks_user_created_at ON public.bookmarks USING btree (user_id, created_at DESC);


--
-- Name: idx_collab_notifs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_collab_notifs_created_at ON public.collaboration_notifications USING btree (created_at);


--
-- Name: idx_collab_notifs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_collab_notifs_user_id ON public.collaboration_notifications USING btree (user_id);


--
-- Name: idx_communities_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_communities_owner_id ON public.communities USING btree (owner_id);


--
-- Name: idx_communities_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_communities_slug ON public.communities USING btree (slug);


--
-- Name: idx_community_members_community_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_community_members_community_id ON public.community_members USING btree (community_id);


--
-- Name: idx_community_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_community_members_user_id ON public.community_members USING btree (user_id);


--
-- Name: idx_community_posts_community_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_community_posts_community_id ON public.community_posts USING btree (community_id);


--
-- Name: idx_community_posts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_community_posts_created_at ON public.community_posts USING btree (created_at DESC);


--
-- Name: idx_community_posts_is_premium; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_community_posts_is_premium ON public.community_posts USING btree (is_premium);


--
-- Name: idx_community_posts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_community_posts_user_id ON public.community_posts USING btree (user_id);


--
-- Name: idx_conv_participants_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conv_participants_user ON public.conversation_participants USING btree (user_id);


--
-- Name: idx_followers_follower_follow; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_followers_follower_follow ON public.followers USING btree (follower_id, following_id);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_conversation_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_conversation_created_at ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_image_url; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_image_url ON public.messages USING btree (image_url) WHERE (image_url IS NOT NULL);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_participants_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_participants_user ON public.conversation_participants USING btree (user_id);


--
-- Name: idx_payment_orders_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_orders_order ON public.payment_orders USING btree (razorpay_order_id);


--
-- Name: idx_payment_orders_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_orders_user ON public.payment_orders USING btree (user_id);


--
-- Name: idx_posts_user_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_posts_user_created_at ON public.posts USING btree (user_id, created_at DESC);


--
-- Name: idx_privacy_settings_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_privacy_settings_user ON public.privacy_settings USING btree (user_id);


--
-- Name: idx_profiles_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);


--
-- Name: idx_user_reports_reported_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_reports_reported_id ON public.user_reports USING btree (reported_id, status);


--
-- Name: idx_user_reports_reporter_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_reports_reporter_id ON public.user_reports USING btree (reporter_id, created_at DESC);


--
-- Name: idx_user_reports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_reports_status ON public.user_reports USING btree (status, created_at DESC);


--
-- Name: notifications_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);


--
-- Name: posts_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX posts_user_id_idx ON public.posts USING btree (user_id);


--
-- Name: profiles_single_moderator_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX profiles_single_moderator_idx ON public.profiles USING btree (is_moderator) WHERE is_moderator;


--
-- Name: user_bans_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_bans_active_idx ON public.user_bans USING btree (user_id) WHERE (lifted_at IS NULL);


--
-- Name: user_bans_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_bans_user_id_idx ON public.user_bans USING btree (user_id, created_at DESC);


--
-- Name: bookmarks bookmarks_after_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER bookmarks_after_change AFTER INSERT OR DELETE ON public.bookmarks FOR EACH ROW EXECUTE FUNCTION public.update_save_count();


--
-- Name: comment_likes comment_likes_after_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER comment_likes_after_change AFTER INSERT OR DELETE ON public.comment_likes FOR EACH ROW EXECUTE FUNCTION public.update_comment_like_count();


--
-- Name: comments comments_after_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER comments_after_change AFTER INSERT OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_comment_count();


--
-- Name: comments comments_after_insert_notify; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER comments_after_insert_notify AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();


--
-- Name: community_members community_members_after_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER community_members_after_change AFTER INSERT OR DELETE OR UPDATE ON public.community_members FOR EACH ROW EXECUTE FUNCTION public.update_community_member_count();


--
-- Name: community_post_comments community_post_comments_after_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER community_post_comments_after_change AFTER INSERT OR DELETE ON public.community_post_comments FOR EACH ROW EXECUTE FUNCTION public.update_community_post_comment_count();


--
-- Name: community_post_likes community_post_likes_after_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER community_post_likes_after_change AFTER INSERT OR DELETE ON public.community_post_likes FOR EACH ROW EXECUTE FUNCTION public.update_community_post_like_count();


--
-- Name: community_posts community_posts_after_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER community_posts_after_change AFTER INSERT OR DELETE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.update_community_post_count();


--
-- Name: likes likes_after_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER likes_after_change AFTER INSERT OR DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.update_like_count();


--
-- Name: likes likes_after_insert_notify; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER likes_after_insert_notify AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();


--
-- Name: collaboration_invites on_collab_invite_created; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_collab_invite_created AFTER INSERT ON public.collaboration_invites FOR EACH ROW EXECUTE FUNCTION public.handle_new_collab_invite();


--
-- Name: collaboration_invites on_collab_invite_updated; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_collab_invite_updated AFTER UPDATE ON public.collaboration_invites FOR EACH ROW EXECUTE FUNCTION public.notify_on_collab_accepted();


--
-- Name: followers on_new_follow; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_new_follow AFTER INSERT ON public.followers FOR EACH ROW EXECUTE FUNCTION public.handle_new_follower();


--
-- Name: followers on_unfollow; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_unfollow AFTER DELETE ON public.followers FOR EACH ROW EXECUTE FUNCTION public.handle_lost_follower();


--
-- Name: shares shares_after_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER shares_after_change AFTER INSERT OR DELETE ON public.shares FOR EACH ROW EXECUTE FUNCTION public.update_share_count();


--
-- Name: posts trg_update_collab_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_collab_count BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_collaborator_count();


--
-- Name: user_bans user_bans_after_change_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_bans_after_change_trg AFTER INSERT OR UPDATE ON public.user_bans FOR EACH ROW EXECUTE FUNCTION public.user_bans_after_change();


--
-- Name: user_bans user_bans_after_delete_trg; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_bans_after_delete_trg AFTER DELETE ON public.user_bans FOR EACH ROW EXECUTE FUNCTION public.user_bans_after_delete();


--
-- Name: user_reports user_reports_after_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_reports_after_insert AFTER INSERT ON public.user_reports FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_report();


--
-- Name: user_reports user_reports_after_status_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_reports_after_status_change AFTER UPDATE ON public.user_reports FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.handle_user_report_status_change();


--
-- Name: user_reports user_reports_before_update; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_reports_before_update BEFORE UPDATE ON public.user_reports FOR EACH ROW EXECUTE FUNCTION public.set_user_report_timestamps();


--
-- Name: bookmarks bookmarks_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: bookmarks bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookmarks
    ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: collaboration_invites collaboration_invites_invitee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_invites
    ADD CONSTRAINT collaboration_invites_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: collaboration_invites collaboration_invites_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_invites
    ADD CONSTRAINT collaboration_invites_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: collaboration_invites collaboration_invites_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_invites
    ADD CONSTRAINT collaboration_invites_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: collaboration_notifications collaboration_notifications_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_notifications
    ADD CONSTRAINT collaboration_notifications_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.collaboration_invites(id) ON DELETE CASCADE;


--
-- Name: collaboration_notifications collaboration_notifications_invitee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_notifications
    ADD CONSTRAINT collaboration_notifications_invitee_id_fkey FOREIGN KEY (invitee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: collaboration_notifications collaboration_notifications_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_notifications
    ADD CONSTRAINT collaboration_notifications_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: collaboration_notifications collaboration_notifications_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_notifications
    ADD CONSTRAINT collaboration_notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: collaboration_notifications collaboration_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collaboration_notifications
    ADD CONSTRAINT collaboration_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: comment_likes comment_likes_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_likes
    ADD CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments(id);


--
-- Name: comment_likes comment_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comment_likes
    ADD CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: communities communities_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: community_members community_members_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_members
    ADD CONSTRAINT community_members_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE CASCADE;


--
-- Name: community_members community_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_members
    ADD CONSTRAINT community_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: community_post_comments community_post_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_post_comments
    ADD CONSTRAINT community_post_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.community_post_comments(id) ON DELETE CASCADE;


--
-- Name: community_post_comments community_post_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_post_comments
    ADD CONSTRAINT community_post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;


--
-- Name: community_post_comments community_post_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_post_comments
    ADD CONSTRAINT community_post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: community_post_likes community_post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_post_likes
    ADD CONSTRAINT community_post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;


--
-- Name: community_post_likes community_post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_post_likes
    ADD CONSTRAINT community_post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: community_posts community_posts_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE CASCADE;


--
-- Name: community_posts community_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: follow_requests follow_requests_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_requests
    ADD CONSTRAINT follow_requests_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id);


--
-- Name: follow_requests follow_requests_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.follow_requests
    ADD CONSTRAINT follow_requests_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id);


--
-- Name: followers followers_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.followers
    ADD CONSTRAINT followers_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id);


--
-- Name: followers followers_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.followers
    ADD CONSTRAINT followers_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id);


--
-- Name: likes likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: likes likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_fkey FOREIGN KEY (sender) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: payment_orders payment_orders_community_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_community_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE CASCADE;


--
-- Name: payment_orders payment_orders_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_user_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: payments payments_order_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_fkey FOREIGN KEY (order_id) REFERENCES public.payment_orders(id) ON DELETE CASCADE;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: privacy_settings privacy_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.privacy_settings
    ADD CONSTRAINT privacy_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: shares shares_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: shares shares_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shares
    ADD CONSTRAINT shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: stories stories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: story_reactions story_reactions_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_reactions
    ADD CONSTRAINT story_reactions_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;


--
-- Name: story_reactions story_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_reactions
    ADD CONSTRAINT story_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_bans user_bans_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_bans
    ADD CONSTRAINT user_bans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: user_bans user_bans_lifted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_bans
    ADD CONSTRAINT user_bans_lifted_by_fkey FOREIGN KEY (lifted_by) REFERENCES public.profiles(id);


--
-- Name: user_bans user_bans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_bans
    ADD CONSTRAINT user_bans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_reports user_reports_reported_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_reported_id_fkey FOREIGN KEY (reported_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_reports user_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_reports user_reports_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_reports
    ADD CONSTRAINT user_reports_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: followers Allow authenticated read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated read" ON public.followers FOR SELECT TO authenticated USING (true);


--
-- Name: privacy_settings Allow authenticated read on privacy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated read on privacy" ON public.privacy_settings FOR SELECT TO authenticated USING (true);


--
-- Name: comment_likes Allow authenticated user to like a comment; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated user to like a comment" ON public.comment_likes FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: comment_likes Allow authenticated user to unlike their comment; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated user to unlike their comment" ON public.comment_likes FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: privacy_settings Allow individual user insert access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow individual user insert access" ON public.privacy_settings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: privacy_settings Allow individual user read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow individual user read access" ON public.privacy_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: privacy_settings Allow individual user update access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow individual user update access" ON public.privacy_settings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: collaboration_notifications Allow insert collaboration notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow insert collaboration notifications" ON public.collaboration_notifications FOR INSERT WITH CHECK (true);


--
-- Name: notifications Allow insert notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: collaboration_invites Allow invitees to read their own invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow invitees to read their own invites" ON public.collaboration_invites FOR SELECT USING ((auth.uid() = invitee_id));


--
-- Name: privacy_settings Allow public read access to all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read access to all users" ON public.privacy_settings FOR SELECT USING (true);


--
-- Name: follow_requests Allow read on requests received; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow read on requests received" ON public.follow_requests FOR SELECT USING ((auth.uid() = following_id));


--
-- Name: follow_requests Allow user to delete a request; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow user to delete a request" ON public.follow_requests FOR DELETE USING (((auth.uid() = follower_id) OR (auth.uid() = following_id)));


--
-- Name: follow_requests Allow user to delete/action a request; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow user to delete/action a request" ON public.follow_requests FOR DELETE TO authenticated USING (((auth.uid() = follower_id) OR (auth.uid() = following_id)));


--
-- Name: comment_likes Allow user to read their own comment likes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow user to read their own comment likes" ON public.comment_likes FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: follow_requests Allow user to send a request; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow user to send a request" ON public.follow_requests FOR INSERT WITH CHECK ((auth.uid() = follower_id));


--
-- Name: follow_requests Allow users to read their own requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to read their own requests" ON public.follow_requests FOR SELECT TO authenticated USING (((auth.uid() = follower_id) OR (auth.uid() = following_id)));


--
-- Name: profiles Allow users to update their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: posts Anyone can view posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view posts" ON public.posts FOR SELECT USING (true);


--
-- Name: posts Anyone can view public posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can view public posts" ON public.posts FOR SELECT USING ((visibility = 'public'::public.privacy_level));


--
-- Name: communities Communities are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Communities are viewable by everyone" ON public.communities FOR SELECT USING (true);


--
-- Name: community_members Community members are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Community members are viewable by everyone" ON public.community_members FOR SELECT USING (true);


--
-- Name: community_post_comments Community post comments are viewable by members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Community post comments are viewable by members" ON public.community_post_comments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.community_members cm
     JOIN public.community_posts cp ON ((cp.id = community_post_comments.post_id)))
  WHERE ((cm.community_id = cp.community_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::public.membership_status)))));


--
-- Name: community_post_likes Community post likes are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Community post likes are viewable by everyone" ON public.community_post_likes FOR SELECT USING (true);


--
-- Name: community_posts Community posts are viewable by members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Community posts are viewable by members" ON public.community_posts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.community_members
  WHERE ((community_members.community_id = community_posts.community_id) AND (community_members.user_id = auth.uid()) AND (community_members.status = 'active'::public.membership_status) AND ((NOT community_posts.is_premium) OR (community_members.role = ANY (ARRAY['owner'::public.member_role, 'co_owner'::public.member_role, 'admin'::public.member_role, 'moderator'::public.member_role])) OR (EXISTS ( SELECT 1
           FROM public.communities c
          WHERE ((c.id = community_posts.community_id) AND (c.membership_type = 'paid'::public.membership_type)))))))));


--
-- Name: conversations Insert conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Insert conversations" ON public.conversations FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: collaboration_invites Invitee can update own invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invitee can update own invites" ON public.collaboration_invites FOR UPDATE USING ((auth.uid() = invitee_id)) WITH CHECK ((auth.uid() = invitee_id));


--
-- Name: posts Invitee may add self as collaborator on accept; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invitee may add self as collaborator on accept" ON public.posts FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.collaboration_invites ci
  WHERE ((ci.post_id = posts.id) AND (ci.invitee_id = auth.uid()) AND (ci.status = ANY (ARRAY['pending'::text, 'accepted'::text])))))) WITH CHECK (true);


--
-- Name: collaboration_invites Invitees can update their own invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Invitees can update their own invites" ON public.collaboration_invites FOR UPDATE TO authenticated USING ((auth.uid() = invitee_id));


--
-- Name: collaboration_invites Inviter can cancel pending invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Inviter can cancel pending invites" ON public.collaboration_invites FOR UPDATE USING (((inviter_id = auth.uid()) AND (status = 'pending'::text))) WITH CHECK ((inviter_id = auth.uid()));


--
-- Name: collaboration_invites Inviter can insert for own posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Inviter can insert for own posts" ON public.collaboration_invites FOR INSERT WITH CHECK (((inviter_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.posts p
  WHERE ((p.id = collaboration_invites.post_id) AND (p.user_id = auth.uid()))))));


--
-- Name: user_blocks Manage own blocks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Manage own blocks" ON public.user_blocks USING ((blocker_id = auth.uid())) WITH CHECK ((blocker_id = auth.uid()));


--
-- Name: conversation_participants Manage own participation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Manage own participation" ON public.conversation_participants USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: community_post_comments Members can comment on posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can comment on posts" ON public.community_post_comments FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM (public.community_members cm
     JOIN public.community_posts cp ON ((cp.id = community_post_comments.post_id)))
  WHERE ((cm.community_id = cp.community_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::public.membership_status))))));


--
-- Name: community_posts Members can create posts in communities they belong to; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can create posts in communities they belong to" ON public.community_posts FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.community_members
  WHERE ((community_members.community_id = community_posts.community_id) AND (community_members.user_id = auth.uid()) AND (community_members.status = 'active'::public.membership_status) AND (community_members.role = ANY (ARRAY['owner'::public.member_role, 'co_owner'::public.member_role])))))));


--
-- Name: community_post_likes Members can like posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can like posts" ON public.community_post_likes FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM (public.community_members cm
     JOIN public.community_posts cp ON ((cp.id = community_post_likes.post_id)))
  WHERE ((cm.community_id = cp.community_id) AND (cm.user_id = auth.uid()) AND (cm.status = 'active'::public.membership_status))))));


--
-- Name: messages Participants can insert messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Participants can insert messages" ON public.messages FOR INSERT WITH CHECK (((sender = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid()))))));


--
-- Name: messages Participants can read messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Participants can read messages" ON public.messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid())))));


--
-- Name: collaboration_invites Post owners can insert collab invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Post owners can insert collab invites" ON public.collaboration_invites FOR INSERT TO authenticated WITH CHECK (((auth.uid() = inviter_id) AND (EXISTS ( SELECT 1
   FROM public.posts
  WHERE ((posts.id = collaboration_invites.post_id) AND (posts.user_id = auth.uid()))))));


--
-- Name: posts Post owners can manage their posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Post owners can manage their posts" ON public.posts USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Public profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: user_reports Reported users can view; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reported users can view" ON public.user_reports FOR SELECT USING ((auth.uid() = reported_id));


--
-- Name: user_reports Reporters can insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reporters can insert" ON public.user_reports FOR INSERT WITH CHECK ((auth.uid() = reporter_id));


--
-- Name: user_reports Reporters can view their submissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Reporters can view their submissions" ON public.user_reports FOR SELECT USING ((auth.uid() = reporter_id));


--
-- Name: conversations Select conversations by participant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Select conversations by participant" ON public.conversations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversations.id) AND (cp.user_id = auth.uid())))));


--
-- Name: user_reports Service role can manage; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage" ON public.user_reports USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: notifications System can insert notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: collaboration_notifications User can read own collaboration notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "User can read own collaboration notifications" ON public.collaboration_notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications User can read own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "User can read own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: collaboration_notifications User can update own collaboration notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "User can update own collaboration notifications" ON public.collaboration_notifications FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: notifications User can update own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "User can update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: communities Users can create communities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create communities" ON public.communities FOR INSERT WITH CHECK ((auth.uid() = owner_id));


--
-- Name: followers Users can create/accept follow relationships; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create/accept follow relationships" ON public.followers FOR INSERT TO authenticated WITH CHECK (((auth.uid() = follower_id) OR (auth.uid() = following_id)));


--
-- Name: followers Users can delete follow relationships; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete follow relationships" ON public.followers FOR DELETE TO authenticated USING (((auth.uid() = follower_id) OR (auth.uid() = following_id)));


--
-- Name: community_post_comments Users can delete their own comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own comments" ON public.community_post_comments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can delete their own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: community_posts Users can delete their own posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own posts" ON public.community_posts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: messages Users can insert messages in their conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert messages in their conversations" ON public.messages FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.conversation_participants
  WHERE ((conversation_participants.conversation_id = conversation_participants.conversation_id) AND (conversation_participants.user_id = auth.uid())))));


--
-- Name: posts Users can insert their own posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own posts" ON public.posts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: community_members Users can join communities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can join communities" ON public.community_members FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: community_members Users can leave communities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can leave communities" ON public.community_members FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: messages Users can see messages in their conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can see messages in their conversations" ON public.messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants
  WHERE ((conversation_participants.conversation_id = messages.conversation_id) AND (conversation_participants.user_id = auth.uid())))));


--
-- Name: notifications Users can see their own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can see their own notifications" ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: community_post_likes Users can unlike their own likes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can unlike their own likes" ON public.community_post_likes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: community_post_comments Users can update their own comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own comments" ON public.community_post_comments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: communities Users can update their own communities; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own communities" ON public.communities FOR UPDATE USING ((auth.uid() = owner_id));


--
-- Name: community_members Users can update their own membership; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own membership" ON public.community_members FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: community_posts Users can update their own posts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own posts" ON public.community_posts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_bans Users can view their bans; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their bans" ON public.user_bans FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: collaboration_invites Users can view their own collab invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own collab invites" ON public.collaboration_invites FOR SELECT TO authenticated USING (((auth.uid() = inviter_id) OR (auth.uid() = invitee_id)));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: payment_orders Users manage their orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users manage their orders" ON public.payment_orders USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: payments Users view their payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users view their payments" ON public.payments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.payment_orders po
  WHERE ((po.id = payments.order_id) AND (po.user_id = auth.uid())))));


--
-- Name: conversations allow_public_insert_conversation_shell; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY allow_public_insert_conversation_shell ON public.conversations FOR INSERT WITH CHECK (true);


--
-- Name: bookmarks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

--
-- Name: bookmarks bookmarks_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bookmarks_delete ON public.bookmarks FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: bookmarks bookmarks_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bookmarks_insert ON public.bookmarks FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: bookmarks bookmarks_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bookmarks_select ON public.bookmarks FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: collaboration_invites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.collaboration_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: collaboration_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.collaboration_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: comment_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: comments comments_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comments_delete ON public.comments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: comments comments_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comments_insert ON public.comments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: comments comments_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comments_select ON public.comments FOR SELECT USING (true);


--
-- Name: comments comments_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comments_update ON public.comments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: communities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

--
-- Name: community_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

--
-- Name: community_post_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: community_post_likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.community_post_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: community_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_select_member; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conversations_select_member ON public.conversations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversations.id) AND (cp.user_id = auth.uid())))));


--
-- Name: conversation_participants cp_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cp_select_own ON public.conversation_participants FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: collaboration_invites create_invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY create_invites ON public.collaboration_invites FOR INSERT TO authenticated WITH CHECK (((auth.uid() = inviter_id) AND (EXISTS ( SELECT 1
   FROM public.posts
  WHERE ((posts.id = collaboration_invites.post_id) AND (posts.user_id = auth.uid()))))));


--
-- Name: follow_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: followers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

--
-- Name: likes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

--
-- Name: likes likes_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY likes_delete ON public.likes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: likes likes_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY likes_insert ON public.likes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: likes likes_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY likes_select ON public.likes FOR SELECT USING (true);


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_insert_in_convo; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_insert_in_convo ON public.messages FOR INSERT TO authenticated WITH CHECK (((sender = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid()))))));


--
-- Name: messages messages_select_in_convo; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY messages_select_in_convo ON public.messages FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid())))));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_insert_to_target; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_insert_to_target ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: notifications notifications_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: conversation_participants participant_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY participant_insert_own ON public.conversation_participants FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: conversation_participants participant_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY participant_select_own ON public.conversation_participants FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: conversation_participants participant_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY participant_update_own ON public.conversation_participants FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: messages participants_can_insert_messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY participants_can_insert_messages ON public.messages FOR INSERT WITH CHECK (((auth.uid() = sender) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid()))))));


--
-- Name: conversations participants_can_select_conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY participants_can_select_conversations ON public.conversations FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversations.id) AND (cp.user_id = auth.uid())))));


--
-- Name: messages participants_can_select_messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY participants_can_select_messages ON public.messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid())))));


--
-- Name: payment_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: posts posts_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY posts_delete ON public.posts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: posts posts_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY posts_insert ON public.posts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: posts posts_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY posts_select ON public.posts FOR SELECT USING (((visibility = 'public'::public.privacy_level) OR ((visibility = 'followers'::public.privacy_level) AND (auth.uid() IN ( SELECT followers.follower_id
   FROM public.followers
  WHERE (followers.following_id = posts.user_id)))) OR (auth.uid() = user_id)));


--
-- Name: posts posts_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY posts_update ON public.posts FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: privacy_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: privacy_settings privacy_settings_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY privacy_settings_select ON public.privacy_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: privacy_settings privacy_settings_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY privacy_settings_update ON public.privacy_settings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (true);


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: shares; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

--
-- Name: shares shares_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shares_insert ON public.shares FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: shares shares_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY shares_select ON public.shares FOR SELECT USING (true);


--
-- Name: stories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

--
-- Name: stories stories_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY stories_delete ON public.stories FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: stories stories_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY stories_insert ON public.stories FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: stories stories_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY stories_select ON public.stories FOR SELECT USING (((auth.uid() = user_id) OR ((expires_at > now()) AND (EXISTS ( SELECT 1
   FROM public.followers
  WHERE ((followers.follower_id = auth.uid()) AND (followers.following_id = stories.user_id)))))));


--
-- Name: story_reactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: story_reactions story_reactions_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY story_reactions_delete ON public.story_reactions FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: story_reactions story_reactions_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY story_reactions_insert ON public.story_reactions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: story_reactions story_reactions_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY story_reactions_select ON public.story_reactions FOR SELECT TO authenticated USING (true);


--
-- Name: story_reactions story_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY story_update ON public.story_reactions FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: collaboration_invites update_own_invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY update_own_invites ON public.collaboration_invites FOR UPDATE TO authenticated USING ((auth.uid() = invitee_id));


--
-- Name: user_bans; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

--
-- Name: user_blocks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: user_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: collaboration_invites view_own_invites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY view_own_invites ON public.collaboration_invites FOR SELECT TO authenticated USING (((auth.uid() = inviter_id) OR (auth.uid() = invitee_id)));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION accept_all_follow_requests(user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.accept_all_follow_requests(user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.accept_all_follow_requests(user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.accept_all_follow_requests(user_id uuid) TO service_role;


--
-- Name: FUNCTION accept_collab_invite(invite_id bigint); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.accept_collab_invite(invite_id bigint) TO anon;
GRANT ALL ON FUNCTION public.accept_collab_invite(invite_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.accept_collab_invite(invite_id bigint) TO service_role;


--
-- Name: FUNCTION accept_collaboration_invite(p_invite_id bigint, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.accept_collaboration_invite(p_invite_id bigint, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.accept_collaboration_invite(p_invite_id bigint, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.accept_collaboration_invite(p_invite_id bigint, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION accept_follow_request(request_follower_id uuid, request_following_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.accept_follow_request(request_follower_id uuid, request_following_id uuid) TO anon;
GRANT ALL ON FUNCTION public.accept_follow_request(request_follower_id uuid, request_following_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.accept_follow_request(request_follower_id uuid, request_following_id uuid) TO service_role;


--
-- Name: FUNCTION create_collab_notification(p_user_id uuid, p_event text, p_invite_id bigint, p_post_id bigint, p_inviter_id uuid, p_invitee_id uuid, p_status text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_collab_notification(p_user_id uuid, p_event text, p_invite_id bigint, p_post_id bigint, p_inviter_id uuid, p_invitee_id uuid, p_status text) TO anon;
GRANT ALL ON FUNCTION public.create_collab_notification(p_user_id uuid, p_event text, p_invite_id bigint, p_post_id bigint, p_inviter_id uuid, p_invitee_id uuid, p_status text) TO authenticated;
GRANT ALL ON FUNCTION public.create_collab_notification(p_user_id uuid, p_event text, p_invite_id bigint, p_post_id bigint, p_inviter_id uuid, p_invitee_id uuid, p_status text) TO service_role;


--
-- Name: FUNCTION create_profile_for_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_profile_for_new_user() TO anon;
GRANT ALL ON FUNCTION public.create_profile_for_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.create_profile_for_new_user() TO service_role;


--
-- Name: FUNCTION decline_collab_invite(invite_id bigint); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.decline_collab_invite(invite_id bigint) TO anon;
GRANT ALL ON FUNCTION public.decline_collab_invite(invite_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.decline_collab_invite(invite_id bigint) TO service_role;


--
-- Name: FUNCTION decline_collaboration_invite(p_invite_id bigint, p_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.decline_collaboration_invite(p_invite_id bigint, p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.decline_collaboration_invite(p_invite_id bigint, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.decline_collaboration_invite(p_invite_id bigint, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_all_suggestions(current_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_all_suggestions(current_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_all_suggestions(current_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_all_suggestions(current_user_id uuid) TO service_role;


--
-- Name: TABLE posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.posts TO anon;
GRANT ALL ON TABLE public.posts TO authenticated;
GRANT ALL ON TABLE public.posts TO service_role;


--
-- Name: FUNCTION get_home_feed(current_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_home_feed(current_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_home_feed(current_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_home_feed(current_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_mutual_count(viewer_id uuid, target_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_mutual_count(viewer_id uuid, target_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_mutual_count(viewer_id uuid, target_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_mutual_count(viewer_id uuid, target_id uuid) TO service_role;


--
-- Name: FUNCTION get_or_create_conversation_with_user(other_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_or_create_conversation_with_user(other_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_or_create_conversation_with_user(other_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_or_create_conversation_with_user(other_user_id uuid) TO service_role;


--
-- Name: FUNCTION handle_lost_follower(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_lost_follower() TO anon;
GRANT ALL ON FUNCTION public.handle_lost_follower() TO authenticated;
GRANT ALL ON FUNCTION public.handle_lost_follower() TO service_role;


--
-- Name: FUNCTION handle_new_collab_invite(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_collab_invite() TO anon;
GRANT ALL ON FUNCTION public.handle_new_collab_invite() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_collab_invite() TO service_role;


--
-- Name: FUNCTION handle_new_follower(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_follower() TO anon;
GRANT ALL ON FUNCTION public.handle_new_follower() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_follower() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_new_user_report(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user_report() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user_report() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user_report() TO service_role;


--
-- Name: FUNCTION handle_user_report_status_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_user_report_status_change() TO anon;
GRANT ALL ON FUNCTION public.handle_user_report_status_change() TO authenticated;
GRANT ALL ON FUNCTION public.handle_user_report_status_change() TO service_role;


--
-- Name: FUNCTION manage_follow_counts(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.manage_follow_counts() TO anon;
GRANT ALL ON FUNCTION public.manage_follow_counts() TO authenticated;
GRANT ALL ON FUNCTION public.manage_follow_counts() TO service_role;


--
-- Name: FUNCTION notify_follow(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_follow() TO anon;
GRANT ALL ON FUNCTION public.notify_follow() TO authenticated;
GRANT ALL ON FUNCTION public.notify_follow() TO service_role;


--
-- Name: FUNCTION notify_on_collab_accepted(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_collab_accepted() TO anon;
GRANT ALL ON FUNCTION public.notify_on_collab_accepted() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_collab_accepted() TO service_role;


--
-- Name: FUNCTION notify_on_collab_invite(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_on_collab_invite() TO anon;
GRANT ALL ON FUNCTION public.notify_on_collab_invite() TO authenticated;
GRANT ALL ON FUNCTION public.notify_on_collab_invite() TO service_role;


--
-- Name: FUNCTION notify_post_comment(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_post_comment() TO anon;
GRANT ALL ON FUNCTION public.notify_post_comment() TO authenticated;
GRANT ALL ON FUNCTION public.notify_post_comment() TO service_role;


--
-- Name: FUNCTION notify_post_like(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_post_like() TO anon;
GRANT ALL ON FUNCTION public.notify_post_like() TO authenticated;
GRANT ALL ON FUNCTION public.notify_post_like() TO service_role;


--
-- Name: FUNCTION refresh_profile_ban_state(target_user uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.refresh_profile_ban_state(target_user uuid) TO anon;
GRANT ALL ON FUNCTION public.refresh_profile_ban_state(target_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public.refresh_profile_ban_state(target_user uuid) TO service_role;


--
-- Name: FUNCTION set_user_report_timestamps(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_user_report_timestamps() TO anon;
GRANT ALL ON FUNCTION public.set_user_report_timestamps() TO authenticated;
GRANT ALL ON FUNCTION public.set_user_report_timestamps() TO service_role;


--
-- Name: FUNCTION update_collaborator_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_collaborator_count() TO anon;
GRANT ALL ON FUNCTION public.update_collaborator_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_collaborator_count() TO service_role;


--
-- Name: FUNCTION update_comment_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_comment_count() TO anon;
GRANT ALL ON FUNCTION public.update_comment_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_comment_count() TO service_role;


--
-- Name: FUNCTION update_comment_like_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_comment_like_count() TO anon;
GRANT ALL ON FUNCTION public.update_comment_like_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_comment_like_count() TO service_role;


--
-- Name: FUNCTION update_community_member_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_community_member_count() TO anon;
GRANT ALL ON FUNCTION public.update_community_member_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_community_member_count() TO service_role;


--
-- Name: FUNCTION update_community_post_comment_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_community_post_comment_count() TO anon;
GRANT ALL ON FUNCTION public.update_community_post_comment_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_community_post_comment_count() TO service_role;


--
-- Name: FUNCTION update_community_post_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_community_post_count() TO anon;
GRANT ALL ON FUNCTION public.update_community_post_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_community_post_count() TO service_role;


--
-- Name: FUNCTION update_community_post_like_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_community_post_like_count() TO anon;
GRANT ALL ON FUNCTION public.update_community_post_like_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_community_post_like_count() TO service_role;


--
-- Name: FUNCTION update_like_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_like_count() TO anon;
GRANT ALL ON FUNCTION public.update_like_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_like_count() TO service_role;


--
-- Name: FUNCTION update_save_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_save_count() TO anon;
GRANT ALL ON FUNCTION public.update_save_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_save_count() TO service_role;


--
-- Name: FUNCTION update_share_count(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_share_count() TO anon;
GRANT ALL ON FUNCTION public.update_share_count() TO authenticated;
GRANT ALL ON FUNCTION public.update_share_count() TO service_role;


--
-- Name: FUNCTION user_bans_after_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.user_bans_after_change() TO anon;
GRANT ALL ON FUNCTION public.user_bans_after_change() TO authenticated;
GRANT ALL ON FUNCTION public.user_bans_after_change() TO service_role;


--
-- Name: FUNCTION user_bans_after_delete(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.user_bans_after_delete() TO anon;
GRANT ALL ON FUNCTION public.user_bans_after_delete() TO authenticated;
GRANT ALL ON FUNCTION public.user_bans_after_delete() TO service_role;


--
-- Name: TABLE bookmarks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bookmarks TO anon;
GRANT ALL ON TABLE public.bookmarks TO authenticated;
GRANT ALL ON TABLE public.bookmarks TO service_role;


--
-- Name: SEQUENCE bookmarks_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.bookmarks_id_seq TO anon;
GRANT ALL ON SEQUENCE public.bookmarks_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bookmarks_id_seq TO service_role;


--
-- Name: TABLE collaboration_invites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.collaboration_invites TO anon;
GRANT ALL ON TABLE public.collaboration_invites TO authenticated;
GRANT ALL ON TABLE public.collaboration_invites TO service_role;


--
-- Name: SEQUENCE collaboration_invites_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.collaboration_invites_id_seq TO anon;
GRANT ALL ON SEQUENCE public.collaboration_invites_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.collaboration_invites_id_seq TO service_role;


--
-- Name: TABLE collaboration_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.collaboration_notifications TO anon;
GRANT ALL ON TABLE public.collaboration_notifications TO authenticated;
GRANT ALL ON TABLE public.collaboration_notifications TO service_role;


--
-- Name: SEQUENCE collaboration_notifications_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.collaboration_notifications_id_seq TO anon;
GRANT ALL ON SEQUENCE public.collaboration_notifications_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.collaboration_notifications_id_seq TO service_role;


--
-- Name: TABLE comment_likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.comment_likes TO anon;
GRANT ALL ON TABLE public.comment_likes TO authenticated;
GRANT ALL ON TABLE public.comment_likes TO service_role;


--
-- Name: TABLE comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.comments TO anon;
GRANT ALL ON TABLE public.comments TO authenticated;
GRANT ALL ON TABLE public.comments TO service_role;


--
-- Name: SEQUENCE comments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.comments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.comments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.comments_id_seq TO service_role;


--
-- Name: TABLE communities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.communities TO anon;
GRANT ALL ON TABLE public.communities TO authenticated;
GRANT ALL ON TABLE public.communities TO service_role;


--
-- Name: SEQUENCE communities_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.communities_id_seq TO anon;
GRANT ALL ON SEQUENCE public.communities_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.communities_id_seq TO service_role;


--
-- Name: TABLE community_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.community_members TO anon;
GRANT ALL ON TABLE public.community_members TO authenticated;
GRANT ALL ON TABLE public.community_members TO service_role;


--
-- Name: SEQUENCE community_members_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.community_members_id_seq TO anon;
GRANT ALL ON SEQUENCE public.community_members_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.community_members_id_seq TO service_role;


--
-- Name: TABLE community_post_comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.community_post_comments TO anon;
GRANT ALL ON TABLE public.community_post_comments TO authenticated;
GRANT ALL ON TABLE public.community_post_comments TO service_role;


--
-- Name: SEQUENCE community_post_comments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.community_post_comments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.community_post_comments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.community_post_comments_id_seq TO service_role;


--
-- Name: TABLE community_post_likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.community_post_likes TO anon;
GRANT ALL ON TABLE public.community_post_likes TO authenticated;
GRANT ALL ON TABLE public.community_post_likes TO service_role;


--
-- Name: SEQUENCE community_post_likes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.community_post_likes_id_seq TO anon;
GRANT ALL ON SEQUENCE public.community_post_likes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.community_post_likes_id_seq TO service_role;


--
-- Name: TABLE community_posts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.community_posts TO anon;
GRANT ALL ON TABLE public.community_posts TO authenticated;
GRANT ALL ON TABLE public.community_posts TO service_role;


--
-- Name: SEQUENCE community_posts_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.community_posts_id_seq TO anon;
GRANT ALL ON SEQUENCE public.community_posts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.community_posts_id_seq TO service_role;


--
-- Name: TABLE conversation_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversation_participants TO anon;
GRANT ALL ON TABLE public.conversation_participants TO authenticated;
GRANT ALL ON TABLE public.conversation_participants TO service_role;


--
-- Name: SEQUENCE conversation_participants_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.conversation_participants_id_seq TO anon;
GRANT ALL ON SEQUENCE public.conversation_participants_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.conversation_participants_id_seq TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- Name: SEQUENCE conversations_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.conversations_id_seq TO anon;
GRANT ALL ON SEQUENCE public.conversations_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.conversations_id_seq TO service_role;


--
-- Name: TABLE follow_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.follow_requests TO anon;
GRANT ALL ON TABLE public.follow_requests TO authenticated;
GRANT ALL ON TABLE public.follow_requests TO service_role;


--
-- Name: SEQUENCE follow_requests_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.follow_requests_id_seq TO anon;
GRANT ALL ON SEQUENCE public.follow_requests_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.follow_requests_id_seq TO service_role;


--
-- Name: TABLE followers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.followers TO anon;
GRANT ALL ON TABLE public.followers TO authenticated;
GRANT ALL ON TABLE public.followers TO service_role;


--
-- Name: TABLE likes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.likes TO anon;
GRANT ALL ON TABLE public.likes TO authenticated;
GRANT ALL ON TABLE public.likes TO service_role;


--
-- Name: SEQUENCE likes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.likes_id_seq TO anon;
GRANT ALL ON SEQUENCE public.likes_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.likes_id_seq TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: SEQUENCE messages_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.messages_id_seq TO anon;
GRANT ALL ON SEQUENCE public.messages_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.messages_id_seq TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: SEQUENCE notifications_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.notifications_id_seq TO anon;
GRANT ALL ON SEQUENCE public.notifications_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.notifications_id_seq TO service_role;


--
-- Name: TABLE payment_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payment_orders TO anon;
GRANT ALL ON TABLE public.payment_orders TO authenticated;
GRANT ALL ON TABLE public.payment_orders TO service_role;


--
-- Name: SEQUENCE payment_orders_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.payment_orders_id_seq TO anon;
GRANT ALL ON SEQUENCE public.payment_orders_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payment_orders_id_seq TO service_role;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;


--
-- Name: SEQUENCE payments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.payments_id_seq TO anon;
GRANT ALL ON SEQUENCE public.payments_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.payments_id_seq TO service_role;


--
-- Name: SEQUENCE posts_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.posts_id_seq TO anon;
GRANT ALL ON SEQUENCE public.posts_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.posts_id_seq TO service_role;


--
-- Name: TABLE privacy_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.privacy_settings TO anon;
GRANT ALL ON TABLE public.privacy_settings TO authenticated;
GRANT ALL ON TABLE public.privacy_settings TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE shares; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.shares TO anon;
GRANT ALL ON TABLE public.shares TO authenticated;
GRANT ALL ON TABLE public.shares TO service_role;


--
-- Name: SEQUENCE shares_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.shares_id_seq TO anon;
GRANT ALL ON SEQUENCE public.shares_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.shares_id_seq TO service_role;


--
-- Name: TABLE stories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stories TO anon;
GRANT ALL ON TABLE public.stories TO authenticated;
GRANT ALL ON TABLE public.stories TO service_role;


--
-- Name: SEQUENCE stories_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stories_id_seq TO anon;
GRANT ALL ON SEQUENCE public.stories_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.stories_id_seq TO service_role;


--
-- Name: TABLE story_reactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.story_reactions TO anon;
GRANT ALL ON TABLE public.story_reactions TO authenticated;
GRANT ALL ON TABLE public.story_reactions TO service_role;


--
-- Name: SEQUENCE story_reactions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.story_reactions_id_seq TO anon;
GRANT ALL ON SEQUENCE public.story_reactions_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.story_reactions_id_seq TO service_role;


--
-- Name: TABLE user_bans; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_bans TO anon;
GRANT ALL ON TABLE public.user_bans TO authenticated;
GRANT ALL ON TABLE public.user_bans TO service_role;


--
-- Name: TABLE user_blocks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_blocks TO anon;
GRANT ALL ON TABLE public.user_blocks TO authenticated;
GRANT ALL ON TABLE public.user_blocks TO service_role;


--
-- Name: TABLE user_reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_reports TO anon;
GRANT ALL ON TABLE public.user_reports TO authenticated;
GRANT ALL ON TABLE public.user_reports TO service_role;


--
-- Name: SEQUENCE user_reports_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_reports_id_seq TO anon;
GRANT ALL ON SEQUENCE public.user_reports_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.user_reports_id_seq TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict DVZsX9GCEQLeQCULGeILYaK1sw6AUVTwiN18tXg9oKPhKI88m3f9NyTN73aFsUY


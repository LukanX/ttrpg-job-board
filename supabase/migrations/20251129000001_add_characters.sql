


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_campaign_invitation"("invitation_token" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_invitation campaign_invitations%ROWTYPE;
  v_user_id UUID;
  v_user_email TEXT;
  v_display_name TEXT;
  v_user_role TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user email from auth.users
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User email not found';
  END IF;

  -- Get and validate invitation
  SELECT * INTO v_invitation
  FROM campaign_invitations
  WHERE token = invitation_token
    AND email = v_user_email
    AND NOT accepted
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or already accepted invitation';
  END IF;

  -- Ensure user profile exists in public.users
  -- Get display name and role from auth metadata
  SELECT 
    COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
    COALESCE(raw_user_meta_data->>'role', 'player')
  INTO v_display_name, v_user_role
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO users (id, email, display_name, role)
  VALUES (v_user_id, v_user_email, v_display_name, v_user_role)
  ON CONFLICT (id) DO NOTHING;

  -- Add to campaign (ignore if already exists)
  INSERT INTO campaign_members (campaign_id, user_id, role)
  VALUES (v_invitation.campaign_id, v_user_id, v_invitation.role)
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  -- Mark invitation as accepted
  UPDATE campaign_invitations
  SET accepted = true, 
      invited_user_id = v_user_id,
      accepted_at = NOW()
  WHERE id = v_invitation.id;

  RETURN json_build_object(
    'success', true,
    'campaign_id', v_invitation.campaign_id,
    'role', v_invitation.role
  );
END;
$$;


ALTER FUNCTION "public"."accept_campaign_invitation"("invitation_token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."accept_campaign_invitation"("invitation_token" "text") IS 'Allows authenticated users to accept campaign invitations. Uses SECURITY DEFINER to bypass RLS for profile creation and member insertion.';



CREATE OR REPLACE FUNCTION "public"."add_campaign_creator_as_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO campaign_members (campaign_id, user_id, role)
  VALUES (NEW.id, NEW.gm_id, 'owner')
  ON CONFLICT (campaign_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_campaign_creator_as_owner"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_invitations"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete invitations that:
  -- 1. Have an expiry date
  -- 2. Expired more than 30 days ago
  DELETE FROM campaign_invitations
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_invitations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_campaign_member_role"("p_campaign_id" "uuid", "p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM campaign_members 
  WHERE campaign_id = p_campaign_id 
    AND user_id = p_user_id;
  
  RETURN user_role;
END;
$$;


ALTER FUNCTION "public"."get_campaign_member_role"("p_campaign_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_campaign_member"("p_campaign_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM campaign_members 
    WHERE campaign_id = p_campaign_id 
      AND user_id = p_user_id
  );
END;
$$;


ALTER FUNCTION "public"."is_campaign_member"("p_campaign_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_via_invite_link"("link_token" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_link campaign_invite_links%ROWTYPE;
  v_user_id UUID;
  v_user_email TEXT;
  v_display_name TEXT;
  v_user_role TEXT;
  v_existing_member BOOLEAN;
  v_existing_request campaign_join_requests%ROWTYPE;
  v_result JSON;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Get and validate invite link (with lock for use_count update)
  SELECT * INTO v_link
  FROM campaign_invite_links
  WHERE token = link_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR use_count < max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, revoked, or exhausted invite link';
  END IF;

  -- Check if user is already a member
  SELECT EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = v_link.campaign_id
      AND user_id = v_user_id
  ) INTO v_existing_member;

  IF v_existing_member THEN
    RAISE EXCEPTION 'Already a member of this campaign';
  END IF;

  -- Handle approval requirement
  IF v_link.require_approval THEN
    -- Check for existing join request
    SELECT * INTO v_existing_request
    FROM campaign_join_requests
    WHERE campaign_id = v_link.campaign_id
      AND user_id = v_user_id;

    IF FOUND THEN
      IF v_existing_request.status = 'pending' THEN
        v_result := json_build_object(
          'requiresApproval', true,
          'status', 'pending',
          'message', 'Your join request is pending approval'
        );
      ELSIF v_existing_request.status = 'rejected' THEN
        RAISE EXCEPTION 'Your previous join request was rejected';
      ELSIF v_existing_request.status = 'approved' THEN
        -- Should have been added as member, but wasn't - fix it
        INSERT INTO campaign_members (campaign_id, user_id, role)
        VALUES (v_link.campaign_id, v_user_id, 'viewer')
        ON CONFLICT (campaign_id, user_id) DO NOTHING;
        
        v_result := json_build_object(
          'requiresApproval', false,
          'status', 'joined',
          'campaign_id', v_link.campaign_id
        );
      END IF;
    ELSE
      -- Create new join request
      INSERT INTO campaign_join_requests (campaign_id, user_id, invite_link_id, status)
      VALUES (v_link.campaign_id, v_user_id, v_link.id, 'pending')
      RETURNING * INTO v_existing_request;
      
      v_result := json_build_object(
        'requiresApproval', true,
        'status', 'pending',
        'requestId', v_existing_request.id,
        'message', 'Join request submitted. Waiting for campaign owner approval.'
      );
    END IF;
  ELSE
    -- No approval required - add user directly
    
    -- Ensure user profile exists
    SELECT 
      COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
      COALESCE(raw_user_meta_data->>'role', 'player')
    INTO v_display_name, v_user_role
    FROM auth.users
    WHERE id = v_user_id;

    INSERT INTO users (id, email, display_name, role)
    VALUES (v_user_id, v_user_email, v_display_name, v_user_role)
    ON CONFLICT (id) DO NOTHING;

    -- Add member with 'viewer' role
    INSERT INTO campaign_members (campaign_id, user_id, role)
    VALUES (v_link.campaign_id, v_user_id, 'viewer');

    v_result := json_build_object(
      'requiresApproval', false,
      'status', 'joined',
      'campaign_id', v_link.campaign_id,
      'message', 'Successfully joined campaign'
    );
  END IF;

  -- Increment use count
  UPDATE campaign_invite_links
  SET use_count = use_count + 1
  WHERE id = v_link.id;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."join_via_invite_link"("link_token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."join_via_invite_link"("link_token" "text") IS 'Allows authenticated users to join campaigns via shareable invite links. Handles both auto-join and approval-required flows. Uses SECURITY DEFINER to bypass RLS.';



CREATE OR REPLACE FUNCTION "public"."prevent_member_column_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Prevent changing role, campaign_id, or user_id
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  IF OLD.campaign_id IS DISTINCT FROM NEW.campaign_id THEN
    RAISE EXCEPTION 'Not allowed to change campaign_id';
  END IF;
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Not allowed to change user_id';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_member_column_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_join_request"("request_id" "uuid", "action" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_request campaign_join_requests%ROWTYPE;
  v_user_id UUID;
  v_is_owner BOOLEAN;
  v_new_status TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate action
  IF action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action. Must be "approve" or "reject"';
  END IF;

  -- Get request with lock
  SELECT * INTO v_request
  FROM campaign_join_requests
  WHERE id = request_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found or already reviewed';
  END IF;

  -- Verify user is campaign owner
  -- Check both gm_id field and campaign_members with owner role
  SELECT EXISTS(
    SELECT 1 FROM campaigns
    WHERE id = v_request.campaign_id
      AND gm_id = v_user_id
  ) OR EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = v_request.campaign_id
      AND user_id = v_user_id
      AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only campaign owners can review join requests';
  END IF;

  -- Determine new status
  v_new_status := CASE WHEN action = 'approve' THEN 'approved' ELSE 'rejected' END;

  -- Update request status
  UPDATE campaign_join_requests
  SET status = v_new_status,
      reviewed_at = NOW(),
      reviewed_by = v_user_id
  WHERE id = request_id;

  -- If approved, add user to campaign
  IF action = 'approve' THEN
    -- Check if user is already a member (safety check)
    IF NOT EXISTS(
      SELECT 1 FROM campaign_members
      WHERE campaign_id = v_request.campaign_id
        AND user_id = v_request.user_id
    ) THEN
      -- Add member with 'viewer' role (default for approved requests)
      INSERT INTO campaign_members (campaign_id, user_id, role)
      VALUES (v_request.campaign_id, v_request.user_id, 'viewer');
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'action', action,
    'status', v_new_status,
    'requestId', request_id,
    'message', 'Join request ' || v_new_status
  );
END;
$$;


ALTER FUNCTION "public"."review_join_request"("request_id" "uuid", "action" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."review_join_request"("request_id" "uuid", "action" "text") IS 'Allows campaign owners to approve or reject join requests. Uses SECURITY DEFINER to bypass RLS for member insertion.';



CREATE OR REPLACE FUNCTION "public"."run_invitation_cleanup"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  cleaned INTEGER;
BEGIN
  cleaned := cleanup_expired_invitations();
  
  -- Log the cleanup run
  INSERT INTO invitation_cleanup_log (cleaned_count)
  VALUES (cleaned);
  
  -- Optional: Log to server logs
  IF cleaned > 0 THEN
    RAISE NOTICE 'Cleaned up % expired invitations', cleaned;
  END IF;
END;
$$;


ALTER FUNCTION "public"."run_invitation_cleanup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_access_campaign"("campaign_uuid" "uuid", "user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Check if user is the owner OR is a member
  RETURN EXISTS (
    SELECT 1 FROM campaigns WHERE id = campaign_uuid AND gm_id = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM campaign_members WHERE campaign_id = campaign_uuid AND user_id = user_uuid
  );
END;
$$;


ALTER FUNCTION "public"."user_can_access_campaign"("campaign_uuid" "uuid", "user_uuid" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."campaign_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "token" "text" NOT NULL,
    "invited_by" "uuid",
    "invited_user_id" "uuid",
    "accepted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    CONSTRAINT "campaign_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "campaign_invitations_role_check" CHECK (("role" = ANY (ARRAY['co-gm'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."campaign_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_invite_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone,
    "max_uses" integer,
    "use_count" integer DEFAULT 0 NOT NULL,
    "require_approval" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid"
);


ALTER TABLE "public"."campaign_invite_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "invite_link_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "campaign_join_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."campaign_join_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'co-gm'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "character_name" "text",
    "character_id" "uuid",
    CONSTRAINT "campaign_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'co-gm'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."campaign_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "gm_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "party_level" integer DEFAULT 1 NOT NULL,
    "share_code" "text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campaigns_party_level_check" CHECK ((("party_level" >= 1) AND ("party_level" <= 20)))
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."characters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "class" "text" NOT NULL,
    "ancestry" "text" NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "stats" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."characters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."encounters" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "encounter_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "enemies" "jsonb",
    "challenge_rating" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."encounters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitation_cleanup_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cleaned_count" integer NOT NULL,
    "run_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invitation_cleanup_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "mission_type_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "difficulty" integer NOT NULL,
    "reward" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "gm_notes" "text",
    "llm_raw_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    CONSTRAINT "jobs_difficulty_check" CHECK ((("difficulty" >= 1) AND ("difficulty" <= 10))),
    CONSTRAINT "jobs_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mission_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."npcs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text",
    "personality" "text",
    "stats_block" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."npcs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "faction_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "display_name" "text",
    "role" "text" DEFAULT 'player'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['gm'::"text", 'player'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."votes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "vote_value" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "votes_vote_value_check" CHECK (("vote_value" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."votes" OWNER TO "postgres";


DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_invitations_token_key') THEN
        ALTER TABLE "public"."campaign_invitations" ADD CONSTRAINT "campaign_invitations_token_key" UNIQUE ("token");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_invite_links_pkey') THEN
        ALTER TABLE "public"."campaign_invite_links" ADD CONSTRAINT "campaign_invite_links_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_invite_links_token_key') THEN
        ALTER TABLE "public"."campaign_invite_links" ADD CONSTRAINT "campaign_invite_links_token_key" UNIQUE ("token");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_join_requests_campaign_id_user_id_key') THEN
        ALTER TABLE "public"."campaign_join_requests" ADD CONSTRAINT "campaign_join_requests_campaign_id_user_id_key" UNIQUE ("campaign_id", "user_id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_join_requests_pkey') THEN
        ALTER TABLE "public"."campaign_join_requests" ADD CONSTRAINT "campaign_join_requests_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_members_campaign_id_user_id_key') THEN
        ALTER TABLE "public"."campaign_members" ADD CONSTRAINT "campaign_members_campaign_id_user_id_key" UNIQUE ("campaign_id", "user_id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_members_pkey') THEN
        ALTER TABLE "public"."campaign_members" ADD CONSTRAINT "campaign_members_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_pkey') THEN
        ALTER TABLE "public"."campaigns" ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_share_code_key') THEN
        ALTER TABLE "public"."campaigns" ADD CONSTRAINT "campaigns_share_code_key" UNIQUE ("share_code");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'characters_pkey') THEN
        ALTER TABLE "public"."characters" ADD CONSTRAINT "characters_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'encounters_pkey') THEN
        ALTER TABLE "public"."encounters" ADD CONSTRAINT "encounters_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invitation_cleanup_log_pkey') THEN
        ALTER TABLE "public"."invitation_cleanup_log" ADD CONSTRAINT "invitation_cleanup_log_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_pkey') THEN
        ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mission_types_pkey') THEN
        ALTER TABLE "public"."mission_types" ADD CONSTRAINT "mission_types_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'npcs_pkey') THEN
        ALTER TABLE "public"."npcs" ADD CONSTRAINT "npcs_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_pkey') THEN
        ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey') THEN
        ALTER TABLE "public"."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_pkey') THEN
        ALTER TABLE "public"."votes" ADD CONSTRAINT "votes_pkey" PRIMARY KEY ("id");
    END IF;
END $$;



CREATE INDEX IF NOT EXISTS "idx_campaign_invitations_campaign" ON "public"."campaign_invitations" USING "btree" ("campaign_id");



CREATE INDEX IF NOT EXISTS "idx_campaign_invitations_email" ON "public"."campaign_invitations" USING "btree" ("email");



CREATE INDEX IF NOT EXISTS "idx_campaign_invitations_expires_at" ON "public"."campaign_invitations" USING "btree" ("expires_at");



CREATE INDEX IF NOT EXISTS "idx_campaign_invite_links_active" ON "public"."campaign_invite_links" USING "btree" ("is_active");



CREATE INDEX IF NOT EXISTS "idx_campaign_invite_links_campaign" ON "public"."campaign_invite_links" USING "btree" ("campaign_id");



CREATE INDEX IF NOT EXISTS "idx_campaign_invite_links_token" ON "public"."campaign_invite_links" USING "btree" ("token");



CREATE INDEX IF NOT EXISTS "idx_campaign_join_requests_campaign" ON "public"."campaign_join_requests" USING "btree" ("campaign_id");



CREATE INDEX IF NOT EXISTS "idx_campaign_join_requests_status" ON "public"."campaign_join_requests" USING "btree" ("status");



CREATE INDEX IF NOT EXISTS "idx_campaign_join_requests_user" ON "public"."campaign_join_requests" USING "btree" ("user_id");



CREATE INDEX IF NOT EXISTS "idx_campaign_members_campaign" ON "public"."campaign_members" USING "btree" ("campaign_id");



CREATE INDEX IF NOT EXISTS "idx_campaign_members_character" ON "public"."campaign_members" USING "btree" ("character_name") WHERE ("character_name" IS NOT NULL);



CREATE INDEX IF NOT EXISTS "idx_campaign_members_role" ON "public"."campaign_members" USING "btree" ("campaign_id", "role");



CREATE INDEX IF NOT EXISTS "idx_campaign_members_user" ON "public"."campaign_members" USING "btree" ("user_id");



CREATE INDEX IF NOT EXISTS "idx_campaigns_gm_id" ON "public"."campaigns" USING "btree" ("gm_id");



CREATE INDEX IF NOT EXISTS "idx_campaigns_share_code" ON "public"."campaigns" USING "btree" ("share_code");



CREATE INDEX IF NOT EXISTS "idx_encounters_job_id" ON "public"."encounters" USING "btree" ("job_id");



CREATE INDEX IF NOT EXISTS "idx_jobs_campaign_id" ON "public"."jobs" USING "btree" ("campaign_id");



CREATE INDEX IF NOT EXISTS "idx_jobs_created_by" ON "public"."jobs" USING "btree" ("created_by");



CREATE INDEX IF NOT EXISTS "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");



CREATE INDEX IF NOT EXISTS "idx_mission_types_campaign_id" ON "public"."mission_types" USING "btree" ("campaign_id");



CREATE INDEX IF NOT EXISTS "idx_npcs_job_id" ON "public"."npcs" USING "btree" ("job_id");



CREATE INDEX IF NOT EXISTS "idx_organizations_campaign_id" ON "public"."organizations" USING "btree" ("campaign_id");



CREATE INDEX IF NOT EXISTS "idx_votes_job_id" ON "public"."votes" USING "btree" ("job_id");



CREATE UNIQUE INDEX IF NOT EXISTS "votes_job_session_unique" ON "public"."votes" USING "btree" ("job_id", "session_id") WHERE ("session_id" IS NOT NULL);



CREATE UNIQUE INDEX IF NOT EXISTS "votes_job_user_unique" ON "public"."votes" USING "btree" ("job_id", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "on_campaign_created" AFTER INSERT ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."add_campaign_creator_as_owner"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."encounters" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."mission_types" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."npcs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prevent_member_column_changes" BEFORE UPDATE ON "public"."campaign_members" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_member_column_changes"();



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_invitations_campaign_id_fkey') THEN
        ALTER TABLE "public"."campaign_invitations" ADD CONSTRAINT "campaign_invitations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_invitations_invited_by_fkey') THEN
        ALTER TABLE "public"."campaign_invitations" ADD CONSTRAINT "campaign_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_invitations_invited_user_id_fkey') THEN
        ALTER TABLE "public"."campaign_invitations" ADD CONSTRAINT "campaign_invitations_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_invite_links_campaign_id_fkey') THEN
        ALTER TABLE "public"."campaign_invite_links" ADD CONSTRAINT "campaign_invite_links_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_invite_links_created_by_fkey') THEN
        ALTER TABLE "public"."campaign_invite_links" ADD CONSTRAINT "campaign_invite_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_invite_links_revoked_by_fkey') THEN
        ALTER TABLE "public"."campaign_invite_links" ADD CONSTRAINT "campaign_invite_links_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_join_requests_campaign_id_fkey') THEN
        ALTER TABLE "public"."campaign_join_requests" ADD CONSTRAINT "campaign_join_requests_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_join_requests_invite_link_id_fkey') THEN
        ALTER TABLE "public"."campaign_join_requests" ADD CONSTRAINT "campaign_join_requests_invite_link_id_fkey" FOREIGN KEY ("invite_link_id") REFERENCES "public"."campaign_invite_links"("id") ON DELETE SET NULL;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_join_requests_reviewed_by_fkey') THEN
        ALTER TABLE "public"."campaign_join_requests" ADD CONSTRAINT "campaign_join_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_join_requests_user_id_fkey') THEN
        ALTER TABLE "public"."campaign_join_requests" ADD CONSTRAINT "campaign_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_members_campaign_id_fkey') THEN
        ALTER TABLE "public"."campaign_members" ADD CONSTRAINT "campaign_members_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_members_character_id_fkey') THEN
        ALTER TABLE "public"."campaign_members" ADD CONSTRAINT "campaign_members_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_members_user_id_fkey') THEN
        ALTER TABLE "public"."campaign_members" ADD CONSTRAINT "campaign_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_gm_id_fkey') THEN
        ALTER TABLE "public"."campaigns" ADD CONSTRAINT "campaigns_gm_id_fkey" FOREIGN KEY ("gm_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'characters_user_id_fkey') THEN
        ALTER TABLE "public"."characters" ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'encounters_job_id_fkey') THEN
        ALTER TABLE "public"."encounters" ADD CONSTRAINT "encounters_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_campaign_id_fkey') THEN
        ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_created_by_fkey') THEN
        ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_mission_type_id_fkey') THEN
        ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_mission_type_id_fkey" FOREIGN KEY ("mission_type_id") REFERENCES "public"."mission_types"("id") ON DELETE SET NULL;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_organization_id_fkey') THEN
        ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mission_types_campaign_id_fkey') THEN
        ALTER TABLE "public"."mission_types" ADD CONSTRAINT "mission_types_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'npcs_job_id_fkey') THEN
        ALTER TABLE "public"."npcs" ADD CONSTRAINT "npcs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_campaign_id_fkey') THEN
        ALTER TABLE "public"."organizations" ADD CONSTRAINT "organizations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_id_fkey') THEN
        ALTER TABLE "public"."users" ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_job_id_fkey') THEN
        ALTER TABLE "public"."votes" ADD CONSTRAINT "votes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_user_id_fkey') THEN
        ALTER TABLE "public"."votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Access NPCs if can access job' AND polrelid = 'public.npcs'::regclass) THEN
        CREATE POLICY "Access NPCs if can access job" ON "public"."npcs" FOR SELECT USING ((EXISTS ( SELECT 1
           FROM "public"."jobs"
          WHERE ("jobs"."id" = "npcs"."job_id"))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Access encounters if can access job' AND polrelid = 'public.encounters'::regclass) THEN
        CREATE POLICY "Access encounters if can access job" ON "public"."encounters" FOR SELECT USING ((EXISTS ( SELECT 1
           FROM "public"."jobs"
          WHERE ("jobs"."id" = "encounters"."job_id"))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Anyone can vote on active jobs' AND polrelid = 'public.votes'::regclass) THEN
        CREATE POLICY "Anyone can vote on active jobs" ON "public"."votes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
           FROM "public"."jobs"
          WHERE (("jobs"."id" = "votes"."job_id") AND ("jobs"."status" = 'active'::"text")))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Authenticated users can create join requests' AND polrelid = 'public.campaign_join_requests'::regclass) THEN
        CREATE POLICY "Authenticated users can create join requests" ON "public"."campaign_join_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign members can create jobs' AND polrelid = 'public.jobs'::regclass) THEN
        CREATE POLICY "Campaign members can create jobs" ON "public"."jobs" FOR INSERT WITH CHECK ((("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE ("campaign_members"."user_id" = "auth"."uid"()))) AND ("created_by" = "auth"."uid"())));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign members can create mission types' AND polrelid = 'public.mission_types'::regclass) THEN
        CREATE POLICY "Campaign members can create mission types" ON "public"."mission_types" FOR INSERT WITH CHECK (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE ("campaign_members"."user_id" = "auth"."uid"()))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign members can create organizations' AND polrelid = 'public.organizations'::regclass) THEN
        CREATE POLICY "Campaign members can create organizations" ON "public"."organizations" FOR INSERT WITH CHECK (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE ("campaign_members"."user_id" = "auth"."uid"()))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign members can view invite links' AND polrelid = 'public.campaign_invite_links'::regclass) THEN
        CREATE POLICY "Campaign members can view invite links" ON "public"."campaign_invite_links" FOR SELECT USING ((EXISTS ( SELECT 1
           FROM "public"."campaign_members"
          WHERE (("campaign_members"."campaign_id" = "campaign_invite_links"."campaign_id") AND ("campaign_members"."user_id" = "auth"."uid"())))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign members can view jobs' AND polrelid = 'public.jobs'::regclass) THEN
        CREATE POLICY "Campaign members can view jobs" ON "public"."jobs" FOR SELECT USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE ("campaign_members"."user_id" = "auth"."uid"()))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign members can view mission types' AND polrelid = 'public.mission_types'::regclass) THEN
        CREATE POLICY "Campaign members can view mission types" ON "public"."mission_types" FOR SELECT USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE ("campaign_members"."user_id" = "auth"."uid"()))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign members can view organizations' AND polrelid = 'public.organizations'::regclass) THEN
        CREATE POLICY "Campaign members can view organizations" ON "public"."organizations" FOR SELECT USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE ("campaign_members"."user_id" = "auth"."uid"()))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners and co-gms can update' AND polrelid = 'public.campaigns'::regclass) THEN
        CREATE POLICY "Campaign owners and co-gms can update" ON "public"."campaigns" FOR UPDATE USING ((("gm_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."campaign_members" "cm"
          WHERE (("cm"."campaign_id" = "cm"."id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = ANY (ARRAY['owner'::"text", 'co-gm'::"text"])))))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners and co-gms can update mission types' AND polrelid = 'public.mission_types'::regclass) THEN
        CREATE POLICY "Campaign owners and co-gms can update mission types" ON "public"."mission_types" FOR UPDATE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = ANY (ARRAY['owner'::"text", 'co-gm'::"text"]))))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners and co-gms can update organizations' AND polrelid = 'public.organizations'::regclass) THEN
        CREATE POLICY "Campaign owners and co-gms can update organizations" ON "public"."organizations" FOR UPDATE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = ANY (ARRAY['owner'::"text", 'co-gm'::"text"]))))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can create invite links' AND polrelid = 'public.campaign_invite_links'::regclass) THEN
        CREATE POLICY "Campaign owners can create invite links" ON "public"."campaign_invite_links" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
           FROM "public"."campaign_members"
          WHERE (("campaign_members"."campaign_id" = "campaign_invite_links"."campaign_id") AND ("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can delete' AND polrelid = 'public.campaigns'::regclass) THEN
        CREATE POLICY "Campaign owners can delete" ON "public"."campaigns" FOR DELETE USING (("gm_id" = "auth"."uid"()));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can delete any job in their campaign' AND polrelid = 'public.jobs'::regclass) THEN
        CREATE POLICY "Campaign owners can delete any job in their campaign" ON "public"."jobs" FOR DELETE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can delete members' AND polrelid = 'public.campaign_members'::regclass) THEN
        CREATE POLICY "Campaign owners can delete members" ON "public"."campaign_members" FOR DELETE USING ((EXISTS ( SELECT 1
           FROM "public"."campaigns" "c"
          WHERE (("c"."id" = "campaign_members"."campaign_id") AND ("c"."gm_id" = "auth"."uid"())))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can delete mission types' AND polrelid = 'public.mission_types'::regclass) THEN
        CREATE POLICY "Campaign owners can delete mission types" ON "public"."mission_types" FOR DELETE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can delete organizations' AND polrelid = 'public.organizations'::regclass) THEN
        CREATE POLICY "Campaign owners can delete organizations" ON "public"."organizations" FOR DELETE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can insert members' AND polrelid = 'public.campaign_members'::regclass) THEN
        CREATE POLICY "Campaign owners can insert members" ON "public"."campaign_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
           FROM "public"."campaigns" "c"
          WHERE (("c"."id" = "campaign_members"."campaign_id") AND ("c"."gm_id" = "auth"."uid"())))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can update any job in their campaign' AND polrelid = 'public.jobs'::regclass) THEN
        CREATE POLICY "Campaign owners can update any job in their campaign" ON "public"."jobs" FOR UPDATE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
           FROM "public"."campaign_members"
          WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can update invite links' AND polrelid = 'public.campaign_invite_links'::regclass) THEN
        CREATE POLICY "Campaign owners can update invite links" ON "public"."campaign_invite_links" FOR UPDATE USING ((EXISTS ( SELECT 1
           FROM "public"."campaign_members"
          WHERE (("campaign_members"."campaign_id" = "campaign_invite_links"."campaign_id") AND ("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can update join requests' AND polrelid = 'public.campaign_join_requests'::regclass) THEN
        CREATE POLICY "Campaign owners can update join requests" ON "public"."campaign_join_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
           FROM "public"."campaign_members"
          WHERE (("campaign_members"."campaign_id" = "campaign_join_requests"."campaign_id") AND ("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can update members' AND polrelid = 'public.campaign_members'::regclass) THEN
        CREATE POLICY "Campaign owners can update members" ON "public"."campaign_members" FOR UPDATE USING ((EXISTS ( SELECT 1
           FROM "public"."campaigns" "c"
          WHERE (("c"."id" = "campaign_members"."campaign_id") AND ("c"."gm_id" = "auth"."uid"())))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Campaign owners can view join requests' AND polrelid = 'public.campaign_join_requests'::regclass) THEN
        CREATE POLICY "Campaign owners can view join requests" ON "public"."campaign_join_requests" FOR SELECT USING ((EXISTS ( SELECT 1
           FROM "public"."campaign_members"
          WHERE (("campaign_members"."campaign_id" = "campaign_join_requests"."campaign_id") AND ("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'GMs can create campaigns' AND polrelid = 'public.campaigns'::regclass) THEN
        CREATE POLICY "GMs can create campaigns" ON "public"."campaigns" FOR INSERT WITH CHECK (("auth"."uid"() = "gm_id"));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'GMs can delete their own campaigns' AND polrelid = 'public.campaigns'::regclass) THEN
        CREATE POLICY "GMs can delete their own campaigns" ON "public"."campaigns" FOR DELETE USING (("auth"."uid"() = "gm_id"));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'GMs can manage NPCs' AND polrelid = 'public.npcs'::regclass) THEN
        CREATE POLICY "GMs can manage NPCs" ON "public"."npcs" USING ((EXISTS ( SELECT 1
           FROM ("public"."jobs"
             JOIN "public"."campaigns" ON (("campaigns"."id" = "jobs"."campaign_id")))
          WHERE (("jobs"."id" = "npcs"."job_id") AND ("campaigns"."gm_id" = "auth"."uid"())))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'GMs can manage encounters' AND polrelid = 'public.encounters'::regclass) THEN
        CREATE POLICY "GMs can manage encounters" ON "public"."encounters" USING ((EXISTS ( SELECT 1
           FROM ("public"."jobs"
             JOIN "public"."campaigns" ON (("campaigns"."id" = "jobs"."campaign_id")))
          WHERE (("jobs"."id" = "encounters"."job_id") AND ("campaigns"."gm_id" = "auth"."uid"())))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'GMs can manage jobs in their campaigns' AND polrelid = 'public.jobs'::regclass) THEN
        CREATE POLICY "GMs can manage jobs in their campaigns" ON "public"."jobs" USING ((EXISTS ( SELECT 1
           FROM "public"."campaigns"
          WHERE (("campaigns"."id" = "jobs"."campaign_id") AND ("campaigns"."gm_id" = "auth"."uid"())))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'GMs can manage mission types in their campaigns' AND polrelid = 'public.mission_types'::regclass) THEN
        CREATE POLICY "GMs can manage mission types in their campaigns" ON "public"."mission_types" USING ((EXISTS ( SELECT 1
           FROM "public"."campaigns"
          WHERE (("campaigns"."id" = "mission_types"."campaign_id") AND ("campaigns"."gm_id" = "auth"."uid"())))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'GMs can manage organizations in their campaigns' AND polrelid = 'public.organizations'::regclass) THEN
        CREATE POLICY "GMs can manage organizations in their campaigns" ON "public"."organizations" USING ((EXISTS ( SELECT 1
           FROM "public"."campaigns"
          WHERE (("campaigns"."id" = "organizations"."campaign_id") AND ("campaigns"."gm_id" = "auth"."uid"())))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'GMs can update their own campaigns' AND polrelid = 'public.campaigns'::regclass) THEN
        CREATE POLICY "GMs can update their own campaigns" ON "public"."campaigns" FOR UPDATE USING (("auth"."uid"() = "gm_id"));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'GMs can view characters in their campaigns' AND polrelid = 'public.characters'::regclass) THEN
        CREATE POLICY "GMs can view characters in their campaigns" ON "public"."characters" FOR SELECT USING ((EXISTS ( SELECT 1
           FROM ("public"."campaign_members" "cm"
             JOIN "public"."campaigns" "c" ON (("c"."id" = "cm"."campaign_id")))
          WHERE (("cm"."character_id" = "characters"."id") AND ("c"."gm_id" = "auth"."uid"())))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'GMs can view their own campaigns' AND polrelid = 'public.campaigns'::regclass) THEN
        CREATE POLICY "GMs can view their own campaigns" ON "public"."campaigns" FOR SELECT USING (("auth"."uid"() = "gm_id"));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Job creator can delete their jobs' AND polrelid = 'public.jobs'::regclass) THEN
        CREATE POLICY "Job creator can delete their jobs" ON "public"."jobs" FOR DELETE USING (("created_by" = "auth"."uid"()));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Job creator can update their jobs' AND polrelid = 'public.jobs'::regclass) THEN
        CREATE POLICY "Job creator can update their jobs" ON "public"."jobs" FOR UPDATE USING (("created_by" = "auth"."uid"()));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Players can view active jobs via share code' AND polrelid = 'public.jobs'::regclass) THEN
        CREATE POLICY "Players can view active jobs via share code" ON "public"."jobs" FOR SELECT USING ((("status" = 'active'::"text") AND (EXISTS ( SELECT 1
           FROM "public"."campaigns"
          WHERE ("campaigns"."id" = "jobs"."campaign_id")))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Players can view characters in shared campaigns' AND polrelid = 'public.characters'::regclass) THEN
        CREATE POLICY "Players can view characters in shared campaigns" ON "public"."characters" FOR SELECT USING ((EXISTS ( SELECT 1
           FROM ("public"."campaign_members" "cm_target"
             JOIN "public"."campaign_members" "cm_viewer" ON (("cm_target"."campaign_id" = "cm_viewer"."campaign_id")))
          WHERE (("cm_target"."character_id" = "characters"."id") AND ("cm_viewer"."user_id" = "auth"."uid"())))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete their own characters' AND polrelid = 'public.characters'::regclass) THEN
        CREATE POLICY "Users can delete their own characters" ON "public"."characters" FOR DELETE USING (("auth"."uid"() = "user_id"));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert campaigns (auto-add as owner)' AND polrelid = 'public.campaigns'::regclass) THEN
        CREATE POLICY "Users can insert campaigns (auto-add as owner)" ON "public"."campaigns" FOR INSERT WITH CHECK (("gm_id" = "auth"."uid"()));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert their own characters' AND polrelid = 'public.characters'::regclass) THEN
        CREATE POLICY "Users can insert their own characters" ON "public"."characters" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert their own profile' AND polrelid = 'public.users'::regclass) THEN
        CREATE POLICY "Users can insert their own profile" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update their own characters' AND polrelid = 'public.characters'::regclass) THEN
        CREATE POLICY "Users can update their own characters" ON "public"."characters" FOR UPDATE USING (("auth"."uid"() = "user_id"));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update their own profile' AND polrelid = 'public.users'::regclass) THEN
        CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update their own votes' AND polrelid = 'public.votes'::regclass) THEN
        CREATE POLICY "Users can update their own votes" ON "public"."votes" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (("auth"."uid"() IS NULL) AND ("session_id" IS NOT NULL))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view all votes' AND polrelid = 'public.votes'::regclass) THEN
        CREATE POLICY "Users can view all votes" ON "public"."votes" FOR SELECT USING (true);
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view campaigns they own or are members of' AND polrelid = 'public.campaigns'::regclass) THEN
        CREATE POLICY "Users can view campaigns they own or are members of" ON "public"."campaigns" FOR SELECT USING ("public"."user_can_access_campaign"("id", "auth"."uid"()));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view members of campaigns they belong to' AND polrelid = 'public.campaign_members'::regclass) THEN
        CREATE POLICY "Users can view members of campaigns they belong to" ON "public"."campaign_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."campaigns" "c"
          WHERE (("c"."id" = "campaign_members"."campaign_id") AND ("c"."gm_id" = "auth"."uid"()))))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view own join requests' AND polrelid = 'public.campaign_join_requests'::regclass) THEN
        CREATE POLICY "Users can view own join requests" ON "public"."campaign_join_requests" FOR SELECT USING (("user_id" = "auth"."uid"()));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view profiles of campaign members' AND polrelid = 'public.users'::regclass) THEN
        CREATE POLICY "Users can view profiles of campaign members" ON "public"."users" FOR SELECT USING ((("auth"."uid"() = "id") OR (EXISTS ( SELECT 1
           FROM ("public"."campaign_members" "cm1"
             JOIN "public"."campaign_members" "cm2" ON (("cm1"."campaign_id" = "cm2"."campaign_id")))
          WHERE (("cm1"."user_id" = "auth"."uid"()) AND ("cm2"."user_id" = "users"."id"))))));
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own characters' AND polrelid = 'public.characters'::regclass) THEN
        CREATE POLICY "Users can view their own characters" ON "public"."characters" FOR SELECT USING (("auth"."uid"() = "user_id"));
    END IF;
END $$;



ALTER TABLE "public"."campaign_invite_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_join_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."characters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."encounters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'member_update_character_only' AND polrelid = 'public.campaign_members'::regclass) THEN
        CREATE POLICY "member_update_character_only" ON "public"."campaign_members" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
    END IF;
END $$;



ALTER TABLE "public"."mission_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."npcs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."votes" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."accept_campaign_invitation"("invitation_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_campaign_invitation"("invitation_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_campaign_invitation"("invitation_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_campaign_creator_as_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_campaign_creator_as_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_campaign_creator_as_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_invitations"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_invitations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_invitations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_campaign_member_role"("p_campaign_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_campaign_member_role"("p_campaign_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_campaign_member_role"("p_campaign_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_campaign_member"("p_campaign_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_campaign_member"("p_campaign_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_campaign_member"("p_campaign_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."join_via_invite_link"("link_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_via_invite_link"("link_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_via_invite_link"("link_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_member_column_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_member_column_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_member_column_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."review_join_request"("request_id" "uuid", "action" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."review_join_request"("request_id" "uuid", "action" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_join_request"("request_id" "uuid", "action" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."run_invitation_cleanup"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_invitation_cleanup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_invitation_cleanup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_access_campaign"("campaign_uuid" "uuid", "user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_access_campaign"("campaign_uuid" "uuid", "user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_access_campaign"("campaign_uuid" "uuid", "user_uuid" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."campaign_invitations" TO "anon";
GRANT ALL ON TABLE "public"."campaign_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_invite_links" TO "anon";
GRANT ALL ON TABLE "public"."campaign_invite_links" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_invite_links" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_join_requests" TO "anon";
GRANT ALL ON TABLE "public"."campaign_join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_join_requests" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_members" TO "anon";
GRANT ALL ON TABLE "public"."campaign_members" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_members" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."characters" TO "anon";
GRANT ALL ON TABLE "public"."characters" TO "authenticated";
GRANT ALL ON TABLE "public"."characters" TO "service_role";



GRANT ALL ON TABLE "public"."encounters" TO "anon";
GRANT ALL ON TABLE "public"."encounters" TO "authenticated";
GRANT ALL ON TABLE "public"."encounters" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_cleanup_log" TO "anon";
GRANT ALL ON TABLE "public"."invitation_cleanup_log" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_cleanup_log" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."mission_types" TO "anon";
GRANT ALL ON TABLE "public"."mission_types" TO "authenticated";
GRANT ALL ON TABLE "public"."mission_types" TO "service_role";



GRANT ALL ON TABLE "public"."npcs" TO "anon";
GRANT ALL ON TABLE "public"."npcs" TO "authenticated";
GRANT ALL ON TABLE "public"."npcs" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."votes" TO "anon";
GRANT ALL ON TABLE "public"."votes" TO "authenticated";
GRANT ALL ON TABLE "public"."votes" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--





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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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


ALTER TABLE ONLY "public"."campaign_invitations"
    ADD CONSTRAINT "campaign_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_invitations"
    ADD CONSTRAINT "campaign_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."campaign_invite_links"
    ADD CONSTRAINT "campaign_invite_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_invite_links"
    ADD CONSTRAINT "campaign_invite_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."campaign_join_requests"
    ADD CONSTRAINT "campaign_join_requests_campaign_id_user_id_key" UNIQUE ("campaign_id", "user_id");



ALTER TABLE ONLY "public"."campaign_join_requests"
    ADD CONSTRAINT "campaign_join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_members"
    ADD CONSTRAINT "campaign_members_campaign_id_user_id_key" UNIQUE ("campaign_id", "user_id");



ALTER TABLE ONLY "public"."campaign_members"
    ADD CONSTRAINT "campaign_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_share_code_key" UNIQUE ("share_code");



ALTER TABLE ONLY "public"."encounters"
    ADD CONSTRAINT "encounters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_cleanup_log"
    ADD CONSTRAINT "invitation_cleanup_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_types"
    ADD CONSTRAINT "mission_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."npcs"
    ADD CONSTRAINT "npcs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_campaign_invitations_campaign" ON "public"."campaign_invitations" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaign_invitations_email" ON "public"."campaign_invitations" USING "btree" ("email");



CREATE INDEX "idx_campaign_invitations_expires_at" ON "public"."campaign_invitations" USING "btree" ("expires_at");



CREATE INDEX "idx_campaign_invite_links_active" ON "public"."campaign_invite_links" USING "btree" ("is_active");



CREATE INDEX "idx_campaign_invite_links_campaign" ON "public"."campaign_invite_links" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaign_invite_links_token" ON "public"."campaign_invite_links" USING "btree" ("token");



CREATE INDEX "idx_campaign_join_requests_campaign" ON "public"."campaign_join_requests" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaign_join_requests_status" ON "public"."campaign_join_requests" USING "btree" ("status");



CREATE INDEX "idx_campaign_join_requests_user" ON "public"."campaign_join_requests" USING "btree" ("user_id");



CREATE INDEX "idx_campaign_members_campaign" ON "public"."campaign_members" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaign_members_character" ON "public"."campaign_members" USING "btree" ("character_name") WHERE ("character_name" IS NOT NULL);



CREATE INDEX "idx_campaign_members_role" ON "public"."campaign_members" USING "btree" ("campaign_id", "role");



CREATE INDEX "idx_campaign_members_user" ON "public"."campaign_members" USING "btree" ("user_id");



CREATE INDEX "idx_campaigns_gm_id" ON "public"."campaigns" USING "btree" ("gm_id");



CREATE INDEX "idx_campaigns_share_code" ON "public"."campaigns" USING "btree" ("share_code");



CREATE INDEX "idx_encounters_job_id" ON "public"."encounters" USING "btree" ("job_id");



CREATE INDEX "idx_jobs_campaign_id" ON "public"."jobs" USING "btree" ("campaign_id");



CREATE INDEX "idx_jobs_created_by" ON "public"."jobs" USING "btree" ("created_by");



CREATE INDEX "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");



CREATE INDEX "idx_mission_types_campaign_id" ON "public"."mission_types" USING "btree" ("campaign_id");



CREATE INDEX "idx_npcs_job_id" ON "public"."npcs" USING "btree" ("job_id");



CREATE INDEX "idx_organizations_campaign_id" ON "public"."organizations" USING "btree" ("campaign_id");



CREATE INDEX "idx_votes_job_id" ON "public"."votes" USING "btree" ("job_id");



CREATE UNIQUE INDEX "votes_job_session_unique" ON "public"."votes" USING "btree" ("job_id", "session_id") WHERE ("session_id" IS NOT NULL);



CREATE UNIQUE INDEX "votes_job_user_unique" ON "public"."votes" USING "btree" ("job_id", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "on_campaign_created" AFTER INSERT ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."add_campaign_creator_as_owner"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."encounters" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."mission_types" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."npcs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prevent_member_column_changes" BEFORE UPDATE ON "public"."campaign_members" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_member_column_changes"();



ALTER TABLE ONLY "public"."campaign_invitations"
    ADD CONSTRAINT "campaign_invitations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_invitations"
    ADD CONSTRAINT "campaign_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."campaign_invitations"
    ADD CONSTRAINT "campaign_invitations_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."campaign_invite_links"
    ADD CONSTRAINT "campaign_invite_links_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_invite_links"
    ADD CONSTRAINT "campaign_invite_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."campaign_invite_links"
    ADD CONSTRAINT "campaign_invite_links_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."campaign_join_requests"
    ADD CONSTRAINT "campaign_join_requests_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_join_requests"
    ADD CONSTRAINT "campaign_join_requests_invite_link_id_fkey" FOREIGN KEY ("invite_link_id") REFERENCES "public"."campaign_invite_links"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."campaign_join_requests"
    ADD CONSTRAINT "campaign_join_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."campaign_join_requests"
    ADD CONSTRAINT "campaign_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_members"
    ADD CONSTRAINT "campaign_members_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_members"
    ADD CONSTRAINT "campaign_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_gm_id_fkey" FOREIGN KEY ("gm_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."encounters"
    ADD CONSTRAINT "encounters_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_mission_type_id_fkey" FOREIGN KEY ("mission_type_id") REFERENCES "public"."mission_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mission_types"
    ADD CONSTRAINT "mission_types_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."npcs"
    ADD CONSTRAINT "npcs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Access NPCs if can access job" ON "public"."npcs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE ("jobs"."id" = "npcs"."job_id"))));



CREATE POLICY "Access encounters if can access job" ON "public"."encounters" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE ("jobs"."id" = "encounters"."job_id"))));



CREATE POLICY "Anyone can vote on active jobs" ON "public"."votes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "votes"."job_id") AND ("jobs"."status" = 'active'::"text")))));



CREATE POLICY "Authenticated users can create join requests" ON "public"."campaign_join_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Campaign members can create jobs" ON "public"."jobs" FOR INSERT WITH CHECK ((("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE ("campaign_members"."user_id" = "auth"."uid"()))) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Campaign members can create mission types" ON "public"."mission_types" FOR INSERT WITH CHECK (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE ("campaign_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Campaign members can create organizations" ON "public"."organizations" FOR INSERT WITH CHECK (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE ("campaign_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Campaign members can view invite links" ON "public"."campaign_invite_links" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."campaign_members"
  WHERE (("campaign_members"."campaign_id" = "campaign_invite_links"."campaign_id") AND ("campaign_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Campaign members can view jobs" ON "public"."jobs" FOR SELECT USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE ("campaign_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Campaign members can view mission types" ON "public"."mission_types" FOR SELECT USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE ("campaign_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Campaign members can view organizations" ON "public"."organizations" FOR SELECT USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE ("campaign_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Campaign owners and co-gms can update" ON "public"."campaigns" FOR UPDATE USING ((("gm_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."campaign_members" "cm"
  WHERE (("cm"."campaign_id" = "cm"."id") AND ("cm"."user_id" = "auth"."uid"()) AND ("cm"."role" = ANY (ARRAY['owner'::"text", 'co-gm'::"text"])))))));



CREATE POLICY "Campaign owners and co-gms can update mission types" ON "public"."mission_types" FOR UPDATE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = ANY (ARRAY['owner'::"text", 'co-gm'::"text"]))))));



CREATE POLICY "Campaign owners and co-gms can update organizations" ON "public"."organizations" FOR UPDATE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = ANY (ARRAY['owner'::"text", 'co-gm'::"text"]))))));



CREATE POLICY "Campaign owners can create invite links" ON "public"."campaign_invite_links" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."campaign_members"
  WHERE (("campaign_members"."campaign_id" = "campaign_invite_links"."campaign_id") AND ("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));



CREATE POLICY "Campaign owners can delete" ON "public"."campaigns" FOR DELETE USING (("gm_id" = "auth"."uid"()));



CREATE POLICY "Campaign owners can delete any job in their campaign" ON "public"."jobs" FOR DELETE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));



CREATE POLICY "Campaign owners can delete members" ON "public"."campaign_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns" "c"
  WHERE (("c"."id" = "campaign_members"."campaign_id") AND ("c"."gm_id" = "auth"."uid"())))));



CREATE POLICY "Campaign owners can delete mission types" ON "public"."mission_types" FOR DELETE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));



CREATE POLICY "Campaign owners can delete organizations" ON "public"."organizations" FOR DELETE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));



CREATE POLICY "Campaign owners can insert members" ON "public"."campaign_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."campaigns" "c"
  WHERE (("c"."id" = "campaign_members"."campaign_id") AND ("c"."gm_id" = "auth"."uid"())))));



CREATE POLICY "Campaign owners can update any job in their campaign" ON "public"."jobs" FOR UPDATE USING (("campaign_id" IN ( SELECT "campaign_members"."campaign_id"
   FROM "public"."campaign_members"
  WHERE (("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));



CREATE POLICY "Campaign owners can update invite links" ON "public"."campaign_invite_links" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."campaign_members"
  WHERE (("campaign_members"."campaign_id" = "campaign_invite_links"."campaign_id") AND ("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));



CREATE POLICY "Campaign owners can update join requests" ON "public"."campaign_join_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."campaign_members"
  WHERE (("campaign_members"."campaign_id" = "campaign_join_requests"."campaign_id") AND ("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));



CREATE POLICY "Campaign owners can update members" ON "public"."campaign_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns" "c"
  WHERE (("c"."id" = "campaign_members"."campaign_id") AND ("c"."gm_id" = "auth"."uid"())))));



CREATE POLICY "Campaign owners can view join requests" ON "public"."campaign_join_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."campaign_members"
  WHERE (("campaign_members"."campaign_id" = "campaign_join_requests"."campaign_id") AND ("campaign_members"."user_id" = "auth"."uid"()) AND ("campaign_members"."role" = 'owner'::"text")))));



CREATE POLICY "GMs can create campaigns" ON "public"."campaigns" FOR INSERT WITH CHECK (("auth"."uid"() = "gm_id"));



CREATE POLICY "GMs can delete their own campaigns" ON "public"."campaigns" FOR DELETE USING (("auth"."uid"() = "gm_id"));



CREATE POLICY "GMs can manage NPCs" ON "public"."npcs" USING ((EXISTS ( SELECT 1
   FROM ("public"."jobs"
     JOIN "public"."campaigns" ON (("campaigns"."id" = "jobs"."campaign_id")))
  WHERE (("jobs"."id" = "npcs"."job_id") AND ("campaigns"."gm_id" = "auth"."uid"())))));



CREATE POLICY "GMs can manage encounters" ON "public"."encounters" USING ((EXISTS ( SELECT 1
   FROM ("public"."jobs"
     JOIN "public"."campaigns" ON (("campaigns"."id" = "jobs"."campaign_id")))
  WHERE (("jobs"."id" = "encounters"."job_id") AND ("campaigns"."gm_id" = "auth"."uid"())))));



CREATE POLICY "GMs can manage jobs in their campaigns" ON "public"."jobs" USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns"
  WHERE (("campaigns"."id" = "jobs"."campaign_id") AND ("campaigns"."gm_id" = "auth"."uid"())))));



CREATE POLICY "GMs can manage mission types in their campaigns" ON "public"."mission_types" USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns"
  WHERE (("campaigns"."id" = "mission_types"."campaign_id") AND ("campaigns"."gm_id" = "auth"."uid"())))));



CREATE POLICY "GMs can manage organizations in their campaigns" ON "public"."organizations" USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns"
  WHERE (("campaigns"."id" = "organizations"."campaign_id") AND ("campaigns"."gm_id" = "auth"."uid"())))));



CREATE POLICY "GMs can update their own campaigns" ON "public"."campaigns" FOR UPDATE USING (("auth"."uid"() = "gm_id"));



CREATE POLICY "GMs can view their own campaigns" ON "public"."campaigns" FOR SELECT USING (("auth"."uid"() = "gm_id"));



CREATE POLICY "Job creator can delete their jobs" ON "public"."jobs" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Job creator can update their jobs" ON "public"."jobs" FOR UPDATE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Players can view active jobs via share code" ON "public"."jobs" FOR SELECT USING ((("status" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."campaigns"
  WHERE ("campaigns"."id" = "jobs"."campaign_id")))));



CREATE POLICY "Users can insert campaigns (auto-add as owner)" ON "public"."campaigns" FOR INSERT WITH CHECK (("gm_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own votes" ON "public"."votes" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (("auth"."uid"() IS NULL) AND ("session_id" IS NOT NULL))));



CREATE POLICY "Users can view all votes" ON "public"."votes" FOR SELECT USING (true);



CREATE POLICY "Users can view campaigns they own or are members of" ON "public"."campaigns" FOR SELECT USING ("public"."user_can_access_campaign"("id", "auth"."uid"()));



CREATE POLICY "Users can view members of campaigns they belong to" ON "public"."campaign_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."campaigns" "c"
  WHERE (("c"."id" = "campaign_members"."campaign_id") AND ("c"."gm_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own join requests" ON "public"."campaign_join_requests" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view profiles of campaign members" ON "public"."users" FOR SELECT USING ((("auth"."uid"() = "id") OR (EXISTS ( SELECT 1
   FROM ("public"."campaign_members" "cm1"
     JOIN "public"."campaign_members" "cm2" ON (("cm1"."campaign_id" = "cm2"."campaign_id")))
  WHERE (("cm1"."user_id" = "auth"."uid"()) AND ("cm2"."user_id" = "users"."id"))))));



ALTER TABLE "public"."campaign_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_invite_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_join_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."encounters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitation_cleanup_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "member_update_character_only" ON "public"."campaign_members" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



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



GRANT ALL ON FUNCTION "public"."prevent_member_column_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_member_column_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_member_column_changes"() TO "service_role";



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
































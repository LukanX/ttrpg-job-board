-- Test Security Definer functions for invitation and join flows
-- These tests ensure the functions properly handle authorization and edge cases

BEGIN;

-- Load pgTAP extension
SELECT plan(21); -- Number of tests we'll run

-- =====================================================
-- Setup: Create test users and campaign
-- =====================================================

-- Create test users
SELECT tests.create_supabase_user('owner@test.com', 'owner-uuid');
SELECT tests.create_supabase_user('invitee@test.com', 'invitee-uuid');
SELECT tests.create_supabase_user('joiner@test.com', 'joiner-uuid');
SELECT tests.create_supabase_user('requester@test.com', 'requester-uuid');

-- Create test campaign
INSERT INTO campaigns (id, gm_id, name, party_level, share_code)
VALUES ('campaign-uuid-1', tests.get_supabase_uid('owner@test.com'), 'Test Campaign', 5, 'TEST123');

-- Add owner to campaign_members
INSERT INTO campaign_members (campaign_id, user_id, role)
VALUES ('campaign-uuid-1', tests.get_supabase_uid('owner@test.com'), 'owner');

-- =====================================================
-- Test 1: accept_campaign_invitation - Happy Path
-- =====================================================

-- Create an invitation
INSERT INTO campaign_invitations (id, campaign_id, email, role, token, invited_by)
VALUES (
  'invite-uuid-1',
  'campaign-uuid-1',
  'invitee@test.com',
  'viewer',
  'invite-token-1',
  tests.get_supabase_uid('owner@test.com')
);

-- Authenticate as invitee
SELECT tests.authenticate_as('invitee@test.com');

-- Test accepting invitation
SELECT lives_ok(
  $$SELECT accept_campaign_invitation('invite-token-1')$$,
  'User can accept valid invitation'
);

-- Verify user was added to campaign_members
SELECT ok(
  EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = 'campaign-uuid-1'
      AND user_id = tests.get_supabase_uid('invitee@test.com')
      AND role = 'viewer'
  ),
  'User added to campaign_members after accepting invitation'
);

-- Verify invitation was marked as accepted
SELECT ok(
  EXISTS(
    SELECT 1 FROM campaign_invitations
    WHERE id = 'invite-uuid-1'
      AND accepted = true
      AND invited_user_id = tests.get_supabase_uid('invitee@test.com')
  ),
  'Invitation marked as accepted'
);

-- Verify user profile was created
SELECT ok(
  EXISTS(
    SELECT 1 FROM users
    WHERE id = tests.get_supabase_uid('invitee@test.com')
  ),
  'User profile created in public.users'
);

-- =====================================================
-- Test 2: accept_campaign_invitation - Error Cases
-- =====================================================

-- Test: Invalid token
SELECT throws_ok(
  $$SELECT accept_campaign_invitation('invalid-token')$$,
  'Invalid, expired, or already accepted invitation',
  'Rejects invalid invitation token'
);

-- Test: Already accepted invitation
SELECT throws_ok(
  $$SELECT accept_campaign_invitation('invite-token-1')$$,
  'Invalid, expired, or already accepted invitation',
  'Rejects already accepted invitation'
);

-- Test: Expired invitation
INSERT INTO campaign_invitations (id, campaign_id, email, role, token, invited_by, expires_at)
VALUES (
  'invite-uuid-expired',
  'campaign-uuid-1',
  'invitee@test.com',
  'viewer',
  'expired-token',
  tests.get_supabase_uid('owner@test.com'),
  NOW() - INTERVAL '1 day'
);

SELECT throws_ok(
  $$SELECT accept_campaign_invitation('expired-token')$$,
  'Invalid, expired, or already accepted invitation',
  'Rejects expired invitation'
);

-- Test: Wrong email (authenticate as different user)
INSERT INTO campaign_invitations (id, campaign_id, email, role, token, invited_by)
VALUES (
  'invite-uuid-2',
  'campaign-uuid-1',
  'other@test.com',
  'viewer',
  'invite-token-2',
  tests.get_supabase_uid('owner@test.com')
);

SELECT throws_ok(
  $$SELECT accept_campaign_invitation('invite-token-2')$$,
  'Invalid, expired, or already accepted invitation',
  'Rejects invitation for different email'
);

-- =====================================================
-- Test 3: join_via_invite_link - Happy Path (No Approval)
-- =====================================================

-- Create invite link without approval requirement
INSERT INTO campaign_invite_links (id, campaign_id, token, require_approval, is_active, use_count)
VALUES (
  'link-uuid-1',
  'campaign-uuid-1',
  'link-token-1',
  false,
  true,
  0
);

-- Authenticate as joiner
SELECT tests.authenticate_as('joiner@test.com');

-- Test joining via link
SELECT lives_ok(
  $$SELECT join_via_invite_link('link-token-1')$$,
  'User can join campaign via invite link'
);

-- Verify user was added to campaign_members
SELECT ok(
  EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = 'campaign-uuid-1'
      AND user_id = tests.get_supabase_uid('joiner@test.com')
      AND role = 'viewer'
  ),
  'User added to campaign_members via invite link'
);

-- Verify use count was incremented
SELECT is(
  (SELECT use_count FROM campaign_invite_links WHERE id = 'link-uuid-1'),
  1,
  'Invite link use count incremented'
);

-- =====================================================
-- Test 4: join_via_invite_link - Approval Required
-- =====================================================

-- Create invite link with approval requirement
INSERT INTO campaign_invite_links (id, campaign_id, token, require_approval, is_active, use_count)
VALUES (
  'link-uuid-2',
  'campaign-uuid-1',
  'link-token-2',
  true,
  true,
  0
);

-- Authenticate as requester
SELECT tests.authenticate_as('requester@test.com');

-- Test creating join request
SELECT lives_ok(
  $$SELECT join_via_invite_link('link-token-2')$$,
  'User can create join request via invite link'
);

-- Verify join request was created
SELECT ok(
  EXISTS(
    SELECT 1 FROM campaign_join_requests
    WHERE campaign_id = 'campaign-uuid-1'
      AND user_id = tests.get_supabase_uid('requester@test.com')
      AND status = 'pending'
  ),
  'Join request created when approval required'
);

-- Verify user was NOT added to campaign_members yet
SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = 'campaign-uuid-1'
      AND user_id = tests.get_supabase_uid('requester@test.com')
  ),
  'User not added to campaign_members when approval required'
);

-- =====================================================
-- Test 5: join_via_invite_link - Error Cases
-- =====================================================

-- Reset to joiner who is already a member
SELECT tests.authenticate_as('joiner@test.com');

-- Test: Already a member
SELECT throws_ok(
  $$SELECT join_via_invite_link('link-token-1')$$,
  'Already a member of this campaign',
  'Rejects user who is already a member'
);

-- Test: Invalid token
SELECT throws_ok(
  $$SELECT join_via_invite_link('invalid-link-token')$$,
  'Invalid, expired, revoked, or exhausted invite link',
  'Rejects invalid invite link token'
);

-- Test: Inactive link
INSERT INTO campaign_invite_links (id, campaign_id, token, require_approval, is_active, use_count)
VALUES (
  'link-uuid-inactive',
  'campaign-uuid-1',
  'inactive-link-token',
  false,
  false,
  0
);

-- Need a new user who isn't a member
SELECT tests.create_supabase_user('newuser@test.com', 'newuser-uuid');
SELECT tests.authenticate_as('newuser@test.com');

SELECT throws_ok(
  $$SELECT join_via_invite_link('inactive-link-token')$$,
  'Invalid, expired, revoked, or exhausted invite link',
  'Rejects inactive invite link'
);

-- Test: Max uses reached
INSERT INTO campaign_invite_links (id, campaign_id, token, require_approval, is_active, use_count, max_uses)
VALUES (
  'link-uuid-maxed',
  'campaign-uuid-1',
  'maxed-link-token',
  false,
  true,
  5,
  5
);

SELECT throws_ok(
  $$SELECT join_via_invite_link('maxed-link-token')$$,
  'Invalid, expired, revoked, or exhausted invite link',
  'Rejects invite link that reached max uses'
);

-- =====================================================
-- Test 6: review_join_request - Approve
-- =====================================================

-- Get the join request ID
DO $$
DECLARE
  v_request_id UUID;
BEGIN
  SELECT id INTO v_request_id
  FROM campaign_join_requests
  WHERE campaign_id = 'campaign-uuid-1'
    AND user_id = tests.get_supabase_uid('requester@test.com')
    AND status = 'pending'
  LIMIT 1;
  
  -- Store in a temporary table for access in tests
  CREATE TEMP TABLE IF NOT EXISTS test_vars (key TEXT PRIMARY KEY, value TEXT);
  INSERT INTO test_vars (key, value) VALUES ('request_id', v_request_id::TEXT)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END $$;

-- Authenticate as campaign owner
SELECT tests.authenticate_as('owner@test.com');

-- Test approving join request
SELECT lives_ok(
  $$SELECT review_join_request((SELECT value::UUID FROM test_vars WHERE key = 'request_id'), 'approve')$$,
  'Owner can approve join request'
);

-- Verify request was updated
SELECT is(
  (SELECT status FROM campaign_join_requests WHERE id = (SELECT value::UUID FROM test_vars WHERE key = 'request_id')),
  'approved',
  'Join request marked as approved'
);

-- Verify user was added to campaign_members
SELECT ok(
  EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = 'campaign-uuid-1'
      AND user_id = tests.get_supabase_uid('requester@test.com')
      AND role = 'viewer'
  ),
  'User added to campaign_members after approval'
);

-- =====================================================
-- Test 7: review_join_request - Error Cases
-- =====================================================

-- Create another join request for rejection test
SELECT tests.create_supabase_user('rejectee@test.com', 'rejectee-uuid');

INSERT INTO campaign_join_requests (id, campaign_id, user_id, status)
VALUES (
  'request-uuid-reject',
  'campaign-uuid-1',
  tests.get_supabase_uid('rejectee@test.com'),
  'pending'
);

-- Test: Non-owner cannot review
SELECT tests.authenticate_as('joiner@test.com');

SELECT throws_ok(
  $$SELECT review_join_request('request-uuid-reject', 'approve')$$,
  'Only campaign owners can review join requests',
  'Non-owner cannot review join request'
);

-- Test: Owner can reject
SELECT tests.authenticate_as('owner@test.com');

SELECT lives_ok(
  $$SELECT review_join_request('request-uuid-reject', 'reject')$$,
  'Owner can reject join request'
);

-- Verify request was rejected
SELECT is(
  (SELECT status FROM campaign_join_requests WHERE id = 'request-uuid-reject'),
  'rejected',
  'Join request marked as rejected'
);

-- Verify user was NOT added to campaign_members
SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = 'campaign-uuid-1'
      AND user_id = tests.get_supabase_uid('rejectee@test.com')
  ),
  'User not added to campaign_members after rejection'
);

-- =====================================================
-- Cleanup and Finish
-- =====================================================

SELECT * FROM finish();
ROLLBACK;

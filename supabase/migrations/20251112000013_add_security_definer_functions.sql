-- Migration: Add Security Definer functions to replace admin client usage
-- These functions allow privilege escalation for specific operations while maintaining RLS

-- =====================================================
-- Function 1: Accept Campaign Invitation
-- =====================================================

CREATE OR REPLACE FUNCTION accept_campaign_invitation(
  invitation_token TEXT
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION accept_campaign_invitation(TEXT) TO authenticated;

-- =====================================================
-- Function 2: Join via Invite Link
-- =====================================================

CREATE OR REPLACE FUNCTION join_via_invite_link(
  link_token TEXT
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION join_via_invite_link(TEXT) TO authenticated;

-- =====================================================
-- Function 3: Review Join Request (Approve/Reject)
-- =====================================================

CREATE OR REPLACE FUNCTION review_join_request(
  request_id UUID,
  action TEXT -- 'approve' or 'reject'
)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION review_join_request(UUID, TEXT) TO authenticated;

-- =====================================================
-- Add comments for documentation
-- =====================================================

COMMENT ON FUNCTION accept_campaign_invitation(TEXT) IS 
'Allows authenticated users to accept campaign invitations. Uses SECURITY DEFINER to bypass RLS for profile creation and member insertion.';

COMMENT ON FUNCTION join_via_invite_link(TEXT) IS 
'Allows authenticated users to join campaigns via shareable invite links. Handles both auto-join and approval-required flows. Uses SECURITY DEFINER to bypass RLS.';

COMMENT ON FUNCTION review_join_request(UUID, TEXT) IS 
'Allows campaign owners to approve or reject join requests. Uses SECURITY DEFINER to bypass RLS for member insertion.';

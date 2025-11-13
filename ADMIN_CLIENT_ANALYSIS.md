# Admin Client Usage Analysis & Recommendations

**Date:** November 12, 2025  
**Status:** Security Review  
**Finding:** Mixed - Some uses are necessary, others can be replaced with better RLS policies

---

## Executive Summary

The service role admin client is used in 5 API routes. After analysis:
- ✅ **2 uses are appropriate** and should remain
- ⚠️ **3 uses can be replaced** with better RLS policies using **Security Definer functions**

---

## Current Usage Analysis

### 1. ✅ `/api/auth/create-profile` - **KEEP ADMIN CLIENT**

**Purpose:** Create user profile during signup  
**Admin bypass needed:** YES - New users don't exist in RLS context yet

**Why it's correct:**
- User profile doesn't exist when auth.uid() is evaluated
- INSERT policy `"Users can insert their own profile"` won't work because user record doesn't exist
- This is the **initial bootstrap** operation
- Handles pending invitations for email before user existed

**Security:** ✅ Acceptable
- Called from auth flow only
- No user input vulnerability
- Creates profile for authenticated user only

**Recommendation:** **KEEP AS-IS** - This is a legitimate use case documented in Supabase best practices.

---

### 2. ⚠️ `/api/invitations/accept` - **CAN BE IMPROVED**

**Purpose:** Accept campaign invitation and add user as member  
**Admin bypass needed:** NO - Can use Security Definer function

**Current flow:**
1. Validates invitation token ✅
2. Checks auth user matches invitation email ✅
3. Creates user profile if missing (using admin) ⚠️
4. Inserts campaign_members record (using admin) ⚠️
5. Marks invitation accepted (using admin) ⚠️

**Security concerns:**
- Bypasses RLS for operations that COULD be allowed via policies
- Manual validation replaces policy-based security
- Harder to audit/test

**Better approach:** Create Security Definer function:

```sql
CREATE OR REPLACE FUNCTION accept_campaign_invitation(
  invitation_token TEXT
)
RETURNS JSON AS $$
DECLARE
  v_invitation campaign_invitations%ROWTYPE;
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get invitation
  SELECT * INTO v_invitation
  FROM campaign_invitations
  WHERE token = invitation_token
    AND email = (SELECT email FROM auth.users WHERE id = v_user_id)
    AND NOT accepted
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;

  -- Ensure user profile exists
  INSERT INTO users (id, email, display_name, role)
  SELECT 
    v_user_id,
    email,
    COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
    COALESCE(raw_user_meta_data->>'role', 'player')
  FROM auth.users
  WHERE id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  -- Add to campaign
  INSERT INTO campaign_members (campaign_id, user_id, role)
  VALUES (v_invitation.campaign_id, v_user_id, v_invitation.role)
  ON CONFLICT (campaign_id, user_id) DO NOTHING;

  -- Mark accepted
  UPDATE campaign_invitations
  SET accepted = true, 
      invited_user_id = v_user_id,
      accepted_at = NOW()
  WHERE id = v_invitation.id;

  RETURN json_build_object(
    'success', true,
    'campaign_id', v_invitation.campaign_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Benefits:**
- All authorization logic in database (single source of truth)
- Atomic operation (all-or-nothing)
- Can be tested via pgTAP
- Easier to audit
- Works with RLS enabled

---

### 3. ⚠️ `/api/invite-links/join` - **CAN BE IMPROVED**

**Purpose:** Join campaign via shareable link  
**Admin bypass needed:** NO - Can use Security Definer function

**Current issues:**
- Complex validation logic split between API and DB
- Bypasses RLS for profile creation and member insertion
- Similar to invitation flow but with different validation

**Better approach:** Security Definer function:

```sql
CREATE OR REPLACE FUNCTION join_via_invite_link(
  link_token TEXT
)
RETURNS JSON AS $$
DECLARE
  v_link campaign_invite_links%ROWTYPE;
  v_user_id UUID;
  v_existing_member BOOLEAN;
  v_result JSON;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get and validate invite link
  SELECT * INTO v_link
  FROM campaign_invite_links
  WHERE token = link_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR use_count < max_uses)
  FOR UPDATE; -- Lock for use_count increment

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or exhausted invite link';
  END IF;

  -- Check existing membership
  SELECT EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = v_link.campaign_id
      AND user_id = v_user_id
  ) INTO v_existing_member;

  IF v_existing_member THEN
    RAISE EXCEPTION 'Already a campaign member';
  END IF;

  -- Handle approval requirement
  IF v_link.require_approval THEN
    -- Create join request
    INSERT INTO campaign_join_requests (campaign_id, user_id, invite_link_id, status)
    VALUES (v_link.campaign_id, v_user_id, v_link.id, 'pending')
    ON CONFLICT (campaign_id, user_id) DO NOTHING;
    
    v_result := json_build_object(
      'requiresApproval', true,
      'status', 'pending'
    );
  ELSE
    -- Ensure user profile exists
    INSERT INTO users (id, email, display_name, role)
    SELECT 
      v_user_id,
      email,
      COALESCE(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
      COALESCE(raw_user_meta_data->>'role', 'player')
    FROM auth.users
    WHERE id = v_user_id
    ON CONFLICT (id) DO NOTHING;

    -- Add member
    INSERT INTO campaign_members (campaign_id, user_id, role)
    VALUES (v_link.campaign_id, v_user_id, 'viewer');

    v_result := json_build_object(
      'requiresApproval', false,
      'status', 'joined',
      'campaign_id', v_link.campaign_id
    );
  END IF;

  -- Increment use count
  UPDATE campaign_invite_links
  SET use_count = use_count + 1
  WHERE id = v_link.id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 4. ⚠️ `/api/campaigns/[id]/join-requests/[requestId]` - **CAN BE IMPROVED**

**Purpose:** Approve/reject join requests  
**Admin bypass needed:** NO - Can use Security Definer function

**Current issues:**
- Owner authorization checked in API code
- Member insertion bypasses RLS
- Split between validation and execution

**Better approach:**

```sql
CREATE OR REPLACE FUNCTION review_join_request(
  request_id UUID,
  action TEXT -- 'approve' or 'reject'
)
RETURNS JSON AS $$
DECLARE
  v_request campaign_join_requests%ROWTYPE;
  v_user_id UUID;
  v_is_owner BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action';
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
  SELECT EXISTS(
    SELECT 1 FROM campaigns
    WHERE id = v_request.campaign_id
      AND gm_id = v_user_id
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    -- Also check campaign_members for 'owner' role
    SELECT EXISTS(
      SELECT 1 FROM campaign_members
      WHERE campaign_id = v_request.campaign_id
        AND user_id = v_user_id
        AND role = 'owner'
    ) INTO v_is_owner;
  END IF;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Only campaign owners can review requests';
  END IF;

  -- Update request
  UPDATE campaign_join_requests
  SET status = CASE WHEN action = 'approve' THEN 'approved' ELSE 'rejected' END,
      reviewed_at = NOW(),
      reviewed_by = v_user_id
  WHERE id = request_id;

  -- If approved, add member
  IF action = 'approve' THEN
    INSERT INTO campaign_members (campaign_id, user_id, role)
    VALUES (v_request.campaign_id, v_request.user_id, 'viewer')
    ON CONFLICT (campaign_id, user_id) DO NOTHING;
  END IF;

  RETURN json_build_object(
    'success', true,
    'action', action,
    'request_id', request_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 5. ✅ `/api/admin/cleanup-invitations` - **KEEP ADMIN CLIENT**

**Purpose:** Scheduled cleanup of expired invitations  
**Admin bypass needed:** YES - Admin/maintenance operation

**Why it's correct:**
- True administrative task
- No specific user context
- Protected by API key
- Calls RPC function that needs elevated privileges

**Security:** ✅ Acceptable
- Protected by `ADMIN_API_KEY`
- No user input affects deletion logic
- Cleanup function in DB uses SECURITY DEFINER already

**Recommendation:** **KEEP AS-IS** - This is a legitimate admin operation.

---

## Implementation Priority

### High Priority (Security Improvements)

1. **Create Security Definer functions** (1-2 hours)
   - `accept_campaign_invitation()`
   - `join_via_invite_link()`
   - `review_join_request()`

2. **Update API routes** to call functions instead of admin client (30 min)

3. **Add pgTAP tests** for the functions (1 hour)

### Benefits

- ✅ **Security:** Authorization in database, not application code
- ✅ **Audit:** DB functions are easier to review and test
- ✅ **Performance:** Single round-trip, atomic operations
- ✅ **Maintainability:** Single source of truth for business logic
- ✅ **Testing:** Can test authorization without API layer

### Migration Path

1. Create migration file with all three Security Definer functions
2. Update API routes to call functions
3. Test thoroughly
4. Deploy
5. Remove admin client from those routes
6. Keep admin client ONLY for:
   - `/api/auth/create-profile` (initial bootstrap)
   - `/api/admin/cleanup-invitations` (admin task)

---

## Supabase Best Practices Alignment

According to official Supabase documentation:

✅ **Security Definer Functions are recommended** for:
- Operations requiring privilege escalation
- Complex authorization logic
- Cross-table operations
- Maintaining RLS while allowing specific actions

❌ **Service Role should be avoided** when:
- Regular RLS policies could handle it
- Authorization logic can be in database
- User-scoped operations (not true admin tasks)

---

## Conclusion

**Current Status:** 2/5 uses are appropriate  
**Recommended Status:** 2/5 uses (same files, better implementation)

The admin client is not inherently bad, but **Security Definer functions are a more secure, maintainable, and testable approach** for user-triggered operations that need privilege escalation.

Only true administrative/bootstrap operations should use the service role client.

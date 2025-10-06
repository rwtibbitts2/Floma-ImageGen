# Production Session Loading Issue - Diagnostic & Fix

## Problem
Sessions are visible in the list but fail to load with error: "failed to load the selected session"

## Root Cause
Sessions with `null` user_id in the database. These sessions:
- **Can be seen** by admins in the session list
- **Cannot be loaded** because the ownership check fails (session.userId !== userId)

## Diagnostic Queries

### 1. Find all sessions with null user_id
```sql
SELECT id, user_id, display_name, created_at, updated_at 
FROM project_sessions 
WHERE user_id IS NULL 
ORDER BY created_at DESC;
```

### 2. Count sessions by ownership status
```sql
SELECT 
  COUNT(*) as total_sessions,
  COUNT(user_id) as sessions_with_user,
  COUNT(*) - COUNT(user_id) as sessions_without_user
FROM project_sessions;
```

### 3. Find the specific problematic session
```sql
SELECT id, user_id, display_name, created_at 
FROM project_sessions 
WHERE display_name LIKE '%Digital Layered Minimalism%';
```

## Fix Options

### Option 1: Assign orphaned sessions to an admin user
```sql
-- First, get the admin user ID
SELECT id, email FROM users WHERE role = 'admin' LIMIT 1;

-- Then assign orphaned sessions to that admin
UPDATE project_sessions 
SET user_id = 'YOUR_ADMIN_USER_ID_HERE'
WHERE user_id IS NULL;
```

### Option 2: Delete orphaned sessions (DESTRUCTIVE)
```sql
-- WARNING: This will permanently delete these sessions and their data
-- Make a backup first!

-- Delete associated images first
DELETE FROM generated_images 
WHERE job_id IN (
  SELECT id FROM generation_jobs 
  WHERE session_id IN (
    SELECT id FROM project_sessions WHERE user_id IS NULL
  )
);

-- Delete associated generation jobs
DELETE FROM generation_jobs 
WHERE session_id IN (
  SELECT id FROM project_sessions WHERE user_id IS NULL
);

-- Finally delete the sessions
DELETE FROM project_sessions WHERE user_id IS NULL;
```

## Prevention
The code has been updated to ensure all new sessions are created with a valid user_id. 
The improved error logging will now show detailed ownership information in the server logs.

## Next Steps
1. Run diagnostic query #3 to find the specific session
2. Run diagnostic query #1 to see all orphaned sessions
3. Choose a fix option based on your needs
4. Run the appropriate fix query
5. Verify the fix by attempting to load the session again

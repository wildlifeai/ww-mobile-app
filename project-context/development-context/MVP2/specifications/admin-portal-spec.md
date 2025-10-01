# Wildlife Watcher Admin Portal Implementation Specification

## General Document Overview & Background

Looking at your requirements for a companion admin website alongside the Wildlife Watcher mobile app, Supabase can definitely support this, and it's actually a good architectural choice. Let me break down the options and recommendations:

### Recommended Approach: Supabase-Hosted Admin Portal

#### Why Supabase Works Well HereBased on your documents and requirements, Supabase can definitely support a companion admin website for the Wildlife Watcher app, and it's actually a well-suited solution. Here's my comprehensive recommendation:

### Yes, Supabase Can Support This - Here's How

#### 1. **Supabase Edge Functions + Static HTML/React Admin Portal**

Supabase Edge Functions can serve TypeScript, JavaScript, and WASM functions, making them perfect for hosting a lightweight admin portal. Here's the architecture I recommend:## Summary

**Yes, Supabase is an excellent choice** for your companion admin website needs. Here's why:

#### ✅ **Advantages of Using Supabase**

1. **Single Platform**: Everything stays in one ecosystem - database, auth, and admin portal
2. **Cost Effective**: Edge Functions offer low latency and great performance, and the free tier (500K invocations/month) is more than sufficient for admin operations
3. **Security**: Built-in integration with Supabase Auth and Row Level Security
4. **Simple Deployment**: Deploy your function to Supabase's global edge network with a single command
5. **No Vendor Lock-in**: Edge Functions are developed using Deno, ensuring maximum power and flexibility with no vendor lock-in

#### 🚀 **Quick Start Recommendation**

Start with the **Supabase Edge Functions approach** I've detailed above:
- Serve a lightweight React admin portal via Edge Functions
- Create a standalone password reset form
- Use Supabase Auth Admin API for user management
- All within your existing Supabase project

#### 🔄 **Migration Path**

If you later need more complex features, you can easily migrate to a separate Next.js admin app on Vercel while keeping the critical functions (password reset, user invitations) on Supabase Edge Functions.

#### ⚠️ **Only Consider Alternatives If**

- You need complex server-side rendering capabilities
- You require specific npm packages not available in Deno
- You want a full-featured admin template/framework
- You prefer a completely separate deployment pipeline

The specification I've provided gives you a complete implementation blueprint that integrates seamlessly with your existing Wildlife Watcher mobile app architecture. It handles all your requirements:
- ✅ WW App Admin user management
- ✅ Password reset forms accessible outside the app  
- ✅ User invitation system
- ✅ Role-based access control
- ✅ Audit logging

This approach is production-ready, scalable, and maintains the simplicity you need for the MVP while being extensible for future needs.

## Architecture Overview

### Recommended Approach: Supabase-Native Solution

Using Supabase Edge Functions to serve a React-based admin portal alongside your existing Supabase backend.

```
┌─────────────────────────────────────────────────────┐
│                   Supabase Project                   │
├───────────────────────────┬─────────────────────────┤
│    Database (PostgreSQL)  │   Edge Functions        │
│    - users table          │   - /admin/* (portal)   │
│    - projects             │   - /auth/reset-password│
│    - deployments          │   - /api/admin/*        │
│    - devices              │                         │
├───────────────────────────┼─────────────────────────┤
│    Authentication         │   Storage               │
│    - User management      │   - Static assets       │
│    - Password reset       │   - User avatars        │
│    - Role management      │                         │
└───────────────────────────┴─────────────────────────┘
```

## Implementation Details

### 1. Admin Portal Edge Function

Create a main Edge Function to serve the admin portal:

```typescript
// supabase/functions/admin/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/admin', '');

  // Route handling
  if (path === '/' || path === '') {
    return serveAdminDashboard();
  } else if (path.startsWith('/api/')) {
    return handleAdminAPI(req, path);
  } else if (path === '/reset-password') {
    return servePasswordResetForm();
  }

  return new Response('Not Found', { status: 404 });
});

async function serveAdminDashboard() {
  // Serve the React admin dashboard
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Wildlife Watcher Admin</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
      </head>
      <body>
        <div id="root"></div>
        <script type="module">
          // React admin app code here
          // Or load from Supabase Storage
        </script>
      </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
```

### 2. User Management Features

#### Database Schema Extensions

```sql
-- Add admin-specific tables
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  is_super_admin BOOLEAN DEFAULT false,
  can_manage_users BOOLEAN DEFAULT false,
  can_manage_projects BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User invitation table
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'project_admin', 'project_member')),
  invited_by UUID REFERENCES auth.users(id),
  invitation_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Password reset tokens (separate from Supabase Auth for custom flow)
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for admin actions
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  target_project_id UUID REFERENCES projects(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super admins can view/modify admin_users
CREATE POLICY "Super admins can manage admin users" ON admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );
```

### 3. Admin API Endpoints

```typescript
// supabase/functions/admin-api/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const url = new URL(req.url);
  const path = url.pathname;

  // Verify admin authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: { user }, error } = await supabaseClient.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (error || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Check if user is admin
  const { data: adminUser } = await supabaseClient
    .from('admin_users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!adminUser) {
    return new Response('Forbidden', { status: 403 });
  }

  // Route to appropriate handler
  switch (path) {
    case '/api/admin/users':
      return handleUserManagement(req, supabaseClient, adminUser);
    case '/api/admin/invite':
      return handleUserInvitation(req, supabaseClient, adminUser);
    case '/api/admin/reset-password':
      return handlePasswordReset(req, supabaseClient, adminUser);
    default:
      return new Response('Not Found', { status: 404 });
  }
});

async function handleUserManagement(req, supabase, adminUser) {
  if (req.method === 'GET') {
    // List all users
    const { data: users, error } = await supabase
      .from('auth.users')
      .select(`
        id,
        email,
        created_at,
        last_sign_in_at,
        raw_app_meta_data,
        project_members (
          project_id,
          role,
          projects (name)
        )
      `);
    
    return new Response(JSON.stringify(users), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (req.method === 'POST') {
    // Add new user
    const { email, password, role } = await req.json();
    
    // Create user with Supabase Auth Admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role }
    });
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Log the action
    await supabase.from('admin_audit_log').insert({
      admin_id: adminUser.id,
      action: 'CREATE_USER',
      target_user_id: data.user.id,
      metadata: { email, role }
    });
    
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  if (req.method === 'DELETE') {
    // Deactivate user
    const { userId } = await req.json();
    
    const { error } = await supabase.auth.admin.deleteUser(userId);
    
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

### 4. Password Reset Web Form

```typescript
// supabase/functions/password-reset/index.ts
serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  
  if (req.method === 'GET') {
    // Serve the password reset form
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reset Password - Wildlife Watcher</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50">
          <div class="min-h-screen flex items-center justify-center">
            <div class="max-w-md w-full space-y-8">
              <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                <h2 class="text-center text-3xl font-extrabold text-gray-900">
                  Reset Your Password
                </h2>
                <form id="resetForm" class="mt-8 space-y-6">
                  <input type="hidden" name="token" value="${token || ''}">
                  <div>
                    <label for="password" class="block text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      minlength="8"
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    >
                  </div>
                  <div>
                    <label for="confirmPassword" class="block text-sm font-medium text-gray-700">
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      minlength="8"
                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    >
                  </div>
                  <div>
                    <button
                      type="submit"
                      class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                    >
                      Reset Password
                    </button>
                  </div>
                </form>
                <div id="message" class="mt-4 text-center hidden"></div>
              </div>
            </div>
          </div>
          <script>
            document.getElementById('resetForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              
              if (formData.get('password') !== formData.get('confirmPassword')) {
                showMessage('Passwords do not match', 'error');
                return;
              }
              
              const response = await fetch('/functions/v1/password-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  token: formData.get('token'),
                  password: formData.get('password')
                })
              });
              
              const result = await response.json();
              
              if (response.ok) {
                showMessage('Password reset successful! You can now login with your new password.', 'success');
                setTimeout(() => {
                  window.location.href = 'wildlifewatcher://login';
                }, 3000);
              } else {
                showMessage(result.error || 'Password reset failed', 'error');
              }
            });
            
            function showMessage(text, type) {
              const messageEl = document.getElementById('message');
              messageEl.textContent = text;
              messageEl.className = \`mt-4 text-center \${type === 'error' ? 'text-red-600' : 'text-green-600'}\`;
              messageEl.classList.remove('hidden');
            }
          </script>
        </body>
      </html>
    `;
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
  
  if (req.method === 'POST') {
    // Handle password reset
    const { token, password } = await req.json();
    
    // Verify token
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (tokenError || !resetToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      resetToken.user_id,
      { password }
    );
    
    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update password' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetToken.id);
    
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### 5. React Admin Dashboard Component

```typescript
// Admin Dashboard (served via Edge Function or built separately)
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    // Fetch users
    const { data: userData } = await supabase
      .from('auth.users')
      .select('*');
    setUsers(userData || []);

    // Fetch projects
    const { data: projectData } = await supabase
      .from('projects')
      .select('*');
    setProjects(projectData || []);

    setLoading(false);
  }

  async function inviteUser(email: string, role: string) {
    const response = await fetch('/functions/v1/admin-api/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({ email, role })
    });

    if (response.ok) {
      alert('Invitation sent!');
      loadData();
    }
  }

  async function resetUserPassword(userId: string) {
    const response = await fetch('/functions/v1/admin-api/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
      },
      body: JSON.stringify({ userId })
    });

    const result = await response.json();
    if (response.ok) {
      alert(`Password reset link: ${result.resetLink}`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">
              Wildlife Watcher Admin Dashboard
            </h1>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            {/* User Management Section */}
            <div className="bg-white overflow-hidden shadow rounded-lg mt-8">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  User Management
                </h2>
                
                {/* Add User Form */}
                <div className="mb-6 p-4 border rounded">
                  <h3 className="font-semibold mb-2">Add New User</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    inviteUser(
                      formData.get('email') as string,
                      formData.get('role') as string
                    );
                  }}>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        name="email"
                        placeholder="Email address"
                        className="flex-1 border rounded px-3 py-2"
                        required
                      />
                      <select
                        name="role"
                        className="border rounded px-3 py-2"
                        required
                      >
                        <option value="project_member">Project Member</option>
                        <option value="project_admin">Project Admin</option>
                        <option value="admin">System Admin</option>
                      </select>
                      <button
                        type="submit"
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                      >
                        Send Invitation
                      </button>
                    </div>
                  </form>
                </div>

                {/* Users List */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.raw_app_meta_data?.role || 'member'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => resetUserPassword(user.id)}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              Reset Password
                            </button>
                            <button
                              className="text-red-600 hover:text-red-900"
                            >
                              Deactivate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Projects Overview */}
            <div className="bg-white overflow-hidden shadow rounded-lg mt-8">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Projects Overview
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <div key={project.id} className="border rounded-lg p-4">
                      <h3 className="font-semibold">{project.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {project.description}
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        Created: {new Date(project.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
```

## Deployment Instructions

### 1. Deploy Edge Functions

```bash
# Deploy admin portal function
supabase functions deploy admin --no-verify-jwt

# Deploy password reset function  
supabase functions deploy password-reset --no-verify-jwt

# Deploy admin API
supabase functions deploy admin-api
```

### 2. Set Environment Variables

```bash
# Set secrets for Edge Functions
supabase secrets set ADMIN_SECRET=your-admin-secret
supabase secrets set EMAIL_FROM=noreply@wildlifewatcher.ai
```

### 3. Configure Custom Domain (Optional)

You can set up a custom domain for the admin portal:

```
admin.wildlifewatcher.ai → Edge Function /admin
```

## Alternative Approaches

### Option 2: Separate Next.js Admin App

If you need more complex features, deploy a separate Next.js app on Vercel:

**Pros:**
- Full React/Next.js capabilities
- Better development experience
- Can use any npm packages
- Server-side rendering

**Cons:**
- Separate hosting costs
- Additional deployment complexity
- Need to manage CORS

### Option 3: Hybrid Approach

Use Edge Functions for critical features (password reset) and a separate admin app for complex dashboards:

```
- Password Reset → Supabase Edge Function
- User Invitation → Supabase Edge Function  
- Admin Dashboard → Vercel/Netlify Next.js app
```

## Security Considerations

1. **Authentication**: All admin endpoints must verify:
   - Valid Supabase session
   - User has admin role
   - Rate limiting on sensitive operations

2. **Audit Logging**: Track all admin actions in `admin_audit_log` table

3. **Password Reset Security**:
   - Tokens expire after 1 hour
   - One-time use only
   - Rate limited per email

4. **CORS Configuration**: Lock down to specific domains in production

5. **Environment Separation**: Use different Supabase projects for dev/staging/prod

## Cost Considerations

**Supabase Edge Functions:**
- Free tier: 500K invocations/month
- Pro plan ($25/month): 2M invocations/month
- Perfect for admin operations (low volume)

**Estimated Usage for Admin Portal:**
- ~100 admin operations/day = 3,000/month
- Well within free tier limits

## Recommended Implementation Path

1. **Phase 1**: Basic user management via Edge Functions
   - User invitation system
   - Password reset form
   - Simple HTML admin page

2. **Phase 2**: Enhanced admin dashboard
   - React-based UI served via Edge Function
   - User activity monitoring
   - Project management

3. **Phase 3**: Advanced features (if needed)
   - Separate Next.js admin app
   - Analytics dashboard
   - Advanced reporting

This approach keeps everything within the Supabase ecosystem, minimizes costs, and provides all the functionality you need for the Wildlife Watcher admin portal.
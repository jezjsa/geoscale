# Single Page Application (SPA) Routing Guide

## The Problem

Single Page Applications (SPAs) like React, Vue, or Angular apps have a common routing issue: when you refresh the page or directly access a URL like `/dashboard`, the browser sends a request to the server for that path. If the server doesn't know how to handle it, you get a 404 error or the links stop working.

## The Solution: Server-Side URL Rewrites + Client-Side Router

SPAs like Supabase's dashboard solve this using **server-side URL rewrites** that redirect all routes back to `index.html`, allowing the client-side router to take over and handle the navigation.

---

## How It Works: The Two Essential Components

### 1. Server-Side Configuration (URL Rewrites)

The server must be configured to serve `index.html` for all routes, not just the root path. This ensures that when someone visits `/dashboard` directly or refreshes the page, they get the main HTML file instead of a 404 error.

### 2. Client-Side Router

The JavaScript framework's router reads the browser URL and renders the appropriate component without making a server request.

---

## Complete Implementation Examples

### For Different Hosting Platforms

#### **Apache (.htaccess)**
Create a `.htaccess` file in your web root:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### **Nginx**
Add to your nginx configuration:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

#### **Netlify**
Create a `_redirects` file in your public/build directory:

```
/*    /index.html   200
```

#### **Vercel**
Create a `vercel.json` file in your project root:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Or for more specific routes:

```json
{
  "rewrites": [
    {
      "source": "/dashboard/:path*",
      "destination": "/index.html"
    },
    {
      "source": "/account/:path*",
      "destination": "/index.html"
    },
    {
      "source": "/admin/:path*",
      "destination": "/index.html"
    }
  ]
}
```

---

## Client-Side Router Setup

### **React with React Router**

**1. Install React Router:**
```bash
npm install react-router-dom
```

**2. Set up your App.jsx/tsx:**
```jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/account" element={<Account />} />
        <Route path="/admin/*" element={<AdminPanel />} />
      </Routes>
    </Router>
  )
}
```

**3. Use proper navigation (NOT `<a>` tags):**
```jsx
import { Link, useNavigate } from 'react-router-dom'

// Using Link component
<Link to="/dashboard">Dashboard</Link>

// Using navigate function
const navigate = useNavigate()
<button onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
```

### **Vue with Vue Router**

**1. Install Vue Router:**
```bash
npm install vue-router
```

**2. Set up router (router/index.js):**
```javascript
import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Account from '../views/Account.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: Login },
  { path: '/dashboard', component: Dashboard },
  { path: '/account', component: Account }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
```

**3. Use proper navigation:**
```vue
<!-- Using router-link -->
<router-link to="/dashboard">Dashboard</router-link>

<!-- Using router.push -->
<button @click="$router.push('/dashboard')">Go to Dashboard</button>
```

---

## How It All Works Together

### 1. **Initial Load (Direct URL Access)**
User visits `https://yourapp.com/dashboard`
- Server receives request for `/dashboard`
- Server configuration rewrites it to serve `/index.html`
- Browser loads `index.html` with your JavaScript app
- Client-side router sees URL is `/dashboard` and renders Dashboard component

### 2. **In-App Navigation**
User clicks "Account" link
- Router's `navigate()` or `<Link>` updates browser URL without page reload
- Client-side router detects URL change and renders Account component
- **No server request is made**

### 3. **Page Refresh**
User hits F5 while on `/account`
- Browser requests `/account` from server
- Server rewrites to `/index.html` (via server configuration)
- JavaScript app loads, reads URL `/account`, renders Account component

### 4. **Tab Switch/Return**
User switches browser tabs and comes back
- **No server request happens**
- React/Vue app is still in memory
- All state and navigation still works

---

## Common Issues and Fixes

### ❌ Issue 1: Links Stop Working After Tab Switch or Refresh

**Cause:** Missing server-side rewrites

**Fix:** Add the appropriate server configuration for your hosting platform (see examples above)

### ❌ Issue 2: Full Page Reloads on Navigation

**Cause:** Using `<a href="/path">` tags instead of router navigation

**Fix:** 
- React: Use `<Link to="/path">` or `navigate('/path')`
- Vue: Use `<router-link to="/path">` or `router.push('/path')`
- Angular: Use `<a routerLink="/path">` or `router.navigate(['/path'])`

### ❌ Issue 3: 404 Errors on Direct URL Access

**Cause:** Server not configured to serve `index.html` for all routes

**Fix:** Implement server-side rewrites (see hosting platform examples above)

### ❌ Issue 4: No Client-Side Router Installed

**Cause:** Missing routing library

**Fix:** Install and configure:
- React: `npm install react-router-dom`
- Vue: `npm install vue-router`
- Angular: Comes built-in with `@angular/router`

---

## Testing Your Setup

### Test 1: Direct URL Access
1. Open browser
2. Type `https://yourapp.com/dashboard` directly in address bar
3. ✅ Should load the dashboard page (not 404)

### Test 2: Page Refresh
1. Navigate to any page in your app
2. Press F5 or Ctrl+R to refresh
3. ✅ Should reload the same page (not 404)

### Test 3: In-App Navigation
1. Click navigation links within your app
2. ✅ URL should change without full page reload
3. ✅ Browser back/forward buttons should work

### Test 4: Tab Switch
1. Navigate to a page in your app
2. Switch to another browser tab
3. Switch back to your app
4. ✅ All links should still work

---

## Key Takeaway

For SPAs to work like traditional websites, you need **both pieces**:

1. ✅ **Server rewrites** - Ensure all URLs serve the main HTML file
2. ✅ **Client-side router** - Reads the URL and renders the correct component

Both must work together. Missing either piece will cause navigation issues.

---

## Quick Checklist

- [ ] Server configuration file added (`.htaccess`, `vercel.json`, `_redirects`, etc.)
- [ ] Client-side router installed and configured
- [ ] Using router navigation methods (NOT `<a>` tags)
- [ ] All routes defined in router configuration
- [ ] Tested direct URL access
- [ ] Tested page refresh
- [ ] Tested tab switching

---

## Additional Resources

- [React Router Documentation](https://reactrouter.com/)
- [Vue Router Documentation](https://router.vuejs.org/)
- [Angular Router Documentation](https://angular.io/guide/router)
- [Vercel Rewrites Documentation](https://vercel.com/docs/concepts/projects/project-configuration#rewrites)
- [Netlify Redirects Documentation](https://docs.netlify.com/routing/redirects/)

# Project Architecture & Structure

This document provides a visual overview of the project architecture and how all components connect.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         BROWSER                              │
│                    http://localhost:5555                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP Requests + JWT
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    REACT FRONTEND                            │
│                     (Vite + React 19)                        │
│                                                               │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐    │
│  │   Contexts    │  │  Components   │  │    Pages     │    │
│  │  (AuthContext)│  │   (Navbar)    │  │  (Login)     │    │
│  └───────┬───────┘  └───────────────┘  └──────────────┘    │
│          │                                                    │
│  ┌───────▼────────────────────────────────────────────┐    │
│  │          API Service (Axios)                        │    │
│  │  • Token Management                                 │    │
│  │  • Auto Token Refresh                               │    │
│  │  • Request/Response Interceptors                    │    │
│  └───────┬────────────────────────────────────────────┘    │
└──────────┼──────────────────────────────────────────────────┘
           │
           │ API Calls (http://localhost:8000/api)
           │ Authorization: Bearer <token>
           │
┌──────────▼──────────────────────────────────────────────────┐
│                   DJANGO BACKEND                             │
│                  (Django 4.2 + DRF)                          │
│                                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │              URL Router (urls.py)                   │    │
│  │  /api/auth/* → accounts.urls                        │    │
│  └────────────┬───────────────────────────────────────┘    │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────┐    │
│  │           API Views (views.py)                      │    │
│  │  • RegisterView                                     │    │
│  │  • login_view                                       │    │
│  │  • logout_view                                      │    │
│  │  • get_user_view                                    │    │
│  │  • UpdateProfileView                                │    │
│  └────────────┬───────────────────────────────────────┘    │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────┐    │
│  │       Serializers (serializers.py)                  │    │
│  │  • UserSerializer                                   │    │
│  │  • UserRegistrationSerializer                       │    │
│  │  • UserUpdateSerializer                             │    │
│  └────────────┬───────────────────────────────────────┘    │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────┐    │
│  │          Models (models.py)                         │    │
│  │  • User (Custom User Model)                         │    │
│  │    - UUID primary key                               │    │
│  │    - username, email, password                      │    │
│  │    - bio, avatar                                    │    │
│  └────────────┬───────────────────────────────────────┘    │
│               │                                              │
│  ┌────────────▼───────────────────────────────────────┐    │
│  │         JWT Authentication                          │    │
│  │  • simplejwt                                        │    │
│  │  • Token generation                                 │    │
│  │  • Token blacklist                                  │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Database Queries
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  POSTGRESQL DATABASE                         │
│                   (localhost:5432)                           │
│                                                               │
│  Tables:                                                     │
│  • users (Custom User model)                                │
│  • token_blacklist_outstandingtoken                         │
│  • token_blacklist_blacklistedtoken                         │
│  • django_migrations                                        │
└──────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
┌─────────┐                                     ┌──────────┐
│ Browser │                                     │  Backend │
└────┬────┘                                     └─────┬────┘
     │                                                 │
     │  1. POST /api/auth/register/                   │
     │    { username, email, password }               │
     ├────────────────────────────────────────────────>
     │                                                 │
     │                     2. Create User             │
     │                     3. Generate JWT Tokens     │
     │                                                 │
     │  4. Response: { user, tokens }                 │
     <────────────────────────────────────────────────┤
     │                                                 │
     │  5. Store tokens in localStorage               │
     │     - accessToken                              │
     │     - refreshToken                             │
     │                                                 │
     │  6. Subsequent requests with token             │
     │    Authorization: Bearer <accessToken>         │
     ├────────────────────────────────────────────────>
     │                                                 │
     │                     7. Verify JWT              │
     │                     8. Get User from token     │
     │                                                 │
     │  9. Protected resource data                    │
     <────────────────────────────────────────────────┤
     │                                                 │
     │  10. Token expires after 1 hour                │
     │                                                 │
     │  11. POST /api/auth/token/refresh/             │
     │     { refresh: refreshToken }                  │
     ├────────────────────────────────────────────────>
     │                                                 │
     │                    12. Validate refresh token  │
     │                    13. Generate new access     │
     │                                                 │
     │  14. Response: { access: newAccessToken }      │
     <────────────────────────────────────────────────┤
     │                                                 │
     │  15. Update accessToken in localStorage        │
     │                                                 │
```

## File Organization

### Backend Structure

```
backend/
├── project_name/              # Django project configuration
│   ├── settings.py           # MAIN CONFIGURATION
│   │   ├── INSTALLED_APPS
│   │   ├── MIDDLEWARE
│   │   ├── DATABASES (PostgreSQL)
│   │   ├── REST_FRAMEWORK settings
│   │   ├── SIMPLE_JWT configuration
│   │   ├── CORS settings
│   │   └── CHANNEL_LAYERS (Redis)
│   │
│   ├── urls.py               # Root URL routing
│   │   └── /api/auth/ → accounts.urls
│   │
│   ├── asgi.py               # ASGI config (WebSockets)
│   └── wsgi.py               # WSGI config (HTTP)
│
└── accounts/                  # Authentication app
    ├── models.py             # User model definition
    ├── serializers.py        # Data serialization
    ├── views.py              # API endpoints logic
    ├── urls.py               # App-specific URLs
    ├── admin.py              # Django admin config
    ├── tests.py              # Unit tests
    └── migrations/           # Database migrations
```

### Frontend Structure

```
frontend/
├── src/
│   ├── main.jsx              # React entry point
│   │   └── Renders App with BrowserRouter
│   │
│   ├── App.jsx               # Main app component
│   │   ├── Wraps with AuthProvider
│   │   ├── Defines Routes
│   │   └── Renders Navbar
│   │
│   ├── contexts/
│   │   └── AuthContext.jsx   # AUTHENTICATION STATE
│   │       ├── State: user, loading, error
│   │       ├── Actions: login, register, logout
│   │       ├── Token management
│   │       └── User data fetching
│   │
│   ├── services/
│   │   └── api.js            # AXIOS CONFIGURATION
│   │       ├── Base URL setup
│   │       ├── Request interceptor (adds token)
│   │       ├── Response interceptor (handles refresh)
│   │       └── Error handling
│   │
│   ├── components/
│   │   ├── Navbar.jsx        # Navigation with auth state
│   │   └── ProtectedRoute.jsx # Route authentication guard
│   │
│   └── pages/
│       ├── Home.jsx          # Landing page (public)
│       ├── Login.jsx         # Login form (public)
│       ├── Register.jsx      # Registration form (public)
│       ├── Dashboard.jsx     # User dashboard (protected)
│       └── Profile.jsx       # User profile (protected)
```

## Data Flow

### 1. User Registration

```
Register.jsx
    │
    │ formData: { username, email, password, ... }
    ▼
useAuth().register()
    │
    │ POST /api/auth/register/
    ▼
api.js (Axios)
    │
    │ HTTP Request
    ▼
Django Backend
    │
    ├─ urls.py routes to RegisterView
    ├─ UserRegistrationSerializer validates data
    ├─ User.objects.create_user() creates user
    ├─ RefreshToken.for_user() generates tokens
    │
    │ Response: { user, tokens }
    ▼
AuthContext
    │
    ├─ localStorage.setItem('accessToken', ...)
    ├─ localStorage.setItem('refreshToken', ...)
    ├─ setUser(user)
    │
    ▼
Navigate to /dashboard
```

### 2. Protected Route Access

```
User navigates to /dashboard
    │
    ▼
ProtectedRoute component
    │
    ├─ Check useAuth().user
    │
    ├─ If user exists ──────> Render Dashboard
    │
    └─ If no user ──────────> Navigate to /login
```

### 3. Token Refresh

```
API Request fails with 401
    │
    ▼
api.js response interceptor
    │
    ├─ Get refreshToken from localStorage
    │
    ├─ POST /api/auth/token/refresh/
    │   { refresh: refreshToken }
    │
    ├─ Receive new access token
    │
    ├─ Update localStorage
    │
    └─ Retry original request with new token
```

## Database Schema

### User Table (users)

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(150) UNIQUE NOT NULL,
    email VARCHAR(254) UNIQUE NOT NULL,
    password VARCHAR(128) NOT NULL,  -- Hashed
    first_name VARCHAR(150),
    last_name VARCHAR(150),
    bio TEXT,
    avatar VARCHAR(100),  -- File path
    is_staff BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,
    date_joined TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Token Blacklist (for logout)

```sql
CREATE TABLE token_blacklist_outstandingtoken (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    jti VARCHAR(255) UNIQUE,
    token TEXT,
    created_at TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE token_blacklist_blacklistedtoken (
    id BIGSERIAL PRIMARY KEY,
    token_id BIGINT REFERENCES token_blacklist_outstandingtoken(id),
    blacklisted_at TIMESTAMP
);
```

## Environment Variables Flow

```
.env files (not committed)
    │
    ├── backend/.env
    │   ├── DJANGO_SECRET_KEY → settings.py → Django core
    │   ├── DB_NAME → settings.py → PostgreSQL connection
    │   ├── DB_USER → settings.py → PostgreSQL connection
    │   └── DB_PASSWORD → settings.py → PostgreSQL connection
    │
    └── frontend/.env
        └── VITE_API_URL → api.js → Axios baseURL
```

## Port Configuration

```
Frontend (Vite)
    │
    ├─ Development: localhost:5555
    │   └─ vite.config.js → server.port = 5555
    │
    └─ Proxy: /api → http://localhost:8000
        └─ vite.config.js → server.proxy

Backend (Django)
    │
    └─ Development: localhost:8000
        └─ manage.py runserver 8000

Database (PostgreSQL)
    │
    └─ localhost:5432 (default)

Redis (optional)
    │
    └─ localhost:6379 (default)
```

## Security Layers

```
1. CORS Protection
   ├─ settings.py → CORS_ALLOWED_ORIGINS
   └─ Only allows requests from localhost:5555

2. CSRF Protection
   ├─ settings.py → CSRF_TRUSTED_ORIGINS
   └─ Django middleware validates CSRF tokens

3. JWT Authentication
   ├─ Access tokens expire in 1 hour
   ├─ Refresh tokens expire in 7 days
   └─ Tokens are blacklisted on logout

4. Password Security
   ├─ Django's built-in password hashers (PBKDF2)
   ├─ Password validators
   └─ Minimum length, complexity requirements

5. HTTPS (Production)
   └─ All traffic encrypted in production
```

## Development vs Production

### Development
- DEBUG=True
- CORS allows localhost
- SQLite or local PostgreSQL
- Django dev server (manage.py runserver)
- Vite dev server (npm run dev)
- Source maps enabled

### Production
- DEBUG=False
- CORS allows production domain
- Production database (AWS RDS, etc.)
- Gunicorn/uWSGI
- Static files served by CDN
- Environment variables from hosting service
- HTTPS enforced

## Adding New Features

```
1. Backend
   ├─ Create model in models.py
   ├─ Create serializer in serializers.py
   ├─ Create view in views.py
   ├─ Add URL in urls.py
   ├─ Run makemigrations & migrate
   └─ Test in Django admin

2. Frontend
   ├─ Create API function in services/
   ├─ Create component/page in components/ or pages/
   ├─ Add route in App.jsx (if needed)
   ├─ Create context (if complex state needed)
   └─ Test in browser
```

---

This structure provides a solid foundation for building scalable web applications with Django and React. The authentication system is production-ready and can be extended with additional features as needed.

# Django + React Project Template with Authentication

A production-ready template for building full-stack web applications with Django REST Framework and React, featuring a complete authentication system.

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Manual Setup](#manual-setup)
- [Environment Configuration](#environment-configuration)
- [API Endpoints](#api-endpoints)
- [Frontend Routes](#frontend-routes)
- [Common Pitfalls](#common-pitfalls)
- [Manual Changes Needed](#manual-changes-needed)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Features

### Backend (Django)
- Django 4.2 with Django REST Framework
- JWT-based authentication with token refresh
- Token blacklisting on logout
- Custom User model with UUID primary key
- PostgreSQL database
- Redis for caching and WebSocket support
- Django Channels for real-time features
- CORS configured for frontend
- Comprehensive authentication endpoints
- Admin interface
- Automated testing setup

### Frontend (React)
- React 19 with Vite
- **shadcn/ui** component library (Radix UI + Tailwind CSS)
- React Router for navigation
- Tailwind CSS for styling
- Axios with automatic token refresh
- Context API for state management
- Protected routes
- Beautiful, accessible UI components
- Dark mode ready
- Login/Register/Profile pages
- Responsive design
- Lucide React icons
- Environment-based configuration

---

## Project Structure

```
project-name/
├── backend/                    # Django backend
│   ├── project_name/          # Django project settings
│   │   ├── __init__.py
│   │   ├── settings.py        # Main settings file
│   │   ├── urls.py            # Root URL configuration
│   │   ├── asgi.py            # ASGI configuration
│   │   └── wsgi.py            # WSGI configuration
│   ├── accounts/              # Authentication app
│   │   ├── migrations/        # Database migrations
│   │   ├── __init__.py
│   │   ├── admin.py           # Admin configuration
│   │   ├── apps.py            # App configuration
│   │   ├── models.py          # User model
│   │   ├── serializers.py     # API serializers
│   │   ├── views.py           # API views
│   │   ├── urls.py            # App URLs
│   │   └── tests.py           # Unit tests
│   ├── venv/                  # Python virtual environment
│   ├── manage.py              # Django management script
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Environment variables (not in git)
│   ├── .env.example           # Example environment file
│   └── .gitignore             # Git ignore rules
│
├── frontend/                   # React frontend
│   ├── public/                # Static files
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Navbar.jsx     # Navigation bar
│   │   │   └── ProtectedRoute.jsx  # Route protection
│   │   ├── contexts/          # React contexts
│   │   │   └── AuthContext.jsx     # Authentication context
│   │   ├── pages/             # Page components
│   │   │   ├── Home.jsx       # Home page
│   │   │   ├── Login.jsx      # Login page
│   │   │   ├── Register.jsx   # Registration page
│   │   │   ├── Dashboard.jsx  # User dashboard
│   │   │   └── Profile.jsx    # User profile
│   │   ├── services/          # API services
│   │   │   └── api.js         # Axios configuration
│   │   ├── hooks/             # Custom hooks (add your own)
│   │   ├── utils/             # Utility functions (add your own)
│   │   ├── assets/            # Images, fonts, etc.
│   │   ├── App.jsx            # Main app component
│   │   ├── main.jsx           # React entry point
│   │   └── index.css          # Global styles
│   ├── node_modules/          # Node dependencies
│   ├── index.html             # HTML template
│   ├── package.json           # NPM dependencies
│   ├── vite.config.js         # Vite configuration
│   ├── tailwind.config.js     # Tailwind configuration
│   ├── postcss.config.js      # PostCSS configuration
│   ├── .env                   # Environment variables (not in git)
│   ├── .env.example           # Example environment file
│   └── .gitignore             # Git ignore rules
│
├── setup.sh                   # Automated setup script
├── setup_database.sh          # Database setup script
├── start_backend.sh           # Start Django server
├── start_frontend.sh          # Start React dev server
├── start.sh                   # Start both servers
└── README.md                  # This file
```

---

## Prerequisites

Before you begin, ensure you have the following installed on your Mac:

1. **Python 3.8+**
   ```bash
   python3 --version
   ```

2. **Node.js 18+ and npm**
   ```bash
   node --version
   npm --version
   ```

3. **PostgreSQL 12+**
   ```bash
   brew install postgresql@14
   brew services start postgresql@14
   ```

4. **Redis** (optional, for WebSocket support)
   ```bash
   brew install redis
   brew services start redis
   ```

5. **Git**
   ```bash
   git --version
   ```

---

## Quick Start

The easiest way to set up a new project is using the automated setup script:

```bash
cd template
chmod +x setup.sh
./setup.sh
```

The script will:
1. Prompt you for project configuration (name, database, etc.)
2. Create the project directory
3. Copy and configure all template files
4. Set up the PostgreSQL database
5. Create Python virtual environment
6. Install all dependencies
7. Run database migrations
8. Create a superuser (optional)
9. Create start scripts

After setup completes:

```bash
cd your-project-name
./start.sh  # Starts both backend and frontend
```

- Frontend: http://localhost:5555
- Backend API: http://localhost:8000/api
- Django Admin: http://localhost:8000/admin

---

## Manual Setup

If you prefer to set up the project manually:

### 1. Database Setup

```bash
cd template
chmod +x setup_database.sh
./setup_database.sh
```

Or manually:

```bash
# Create database
psql -U postgres
CREATE DATABASE your_db_name;
\q
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start server
python manage.py runserver 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

---

## Environment Configuration

### Backend (.env)

```env
# Django Settings
DJANGO_SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DB_NAME=your_db_name
DB_USER=postgres
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000/api
```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register/` | Register new user | No |
| POST | `/api/auth/login/` | Login user | No |
| POST | `/api/auth/logout/` | Logout user | Yes |
| POST | `/api/auth/token/refresh/` | Refresh access token | No |
| GET | `/api/auth/user/` | Get current user | Yes |
| PATCH | `/api/auth/user/update/` | Update user profile | Yes |
| POST | `/api/auth/user/change-password/` | Change password | Yes |
| DELETE | `/api/auth/user/delete/` | Delete account | Yes |

### Request/Response Examples

**Register:**
```json
POST /api/auth/register/
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "password2": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe"
}

Response:
{
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "email": "john@example.com",
    ...
  },
  "tokens": {
    "access": "access_token",
    "refresh": "refresh_token"
  }
}
```

**Login:**
```json
POST /api/auth/login/
{
  "username": "john_doe",
  "password": "SecurePass123!"
}

Response: Same as register
```

---

## Frontend Routes

| Route | Component | Protected | Description |
|-------|-----------|-----------|-------------|
| `/` | Home | No | Landing page |
| `/login` | Login | No | Login page |
| `/register` | Register | No | Registration page |
| `/dashboard` | Dashboard | Yes | User dashboard |
| `/profile` | Profile | Yes | User profile page |

---

## Common Pitfalls

### 1. Port Conflicts

**Problem:** Ports 8000 or 5555 are already in use.

**Solution:**
```bash
# Find and kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Find and kill process on port 5555
lsof -ti:5555 | xargs kill -9
```

Or change ports in:
- Backend: `python manage.py runserver <new_port>`
- Frontend: `vite.config.js` → `server.port`

### 2. PostgreSQL Not Running

**Problem:** Database connection errors.

**Solution:**
```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL
brew services start postgresql@14

# Or restart
brew services restart postgresql@14
```

### 3. Virtual Environment Issues

**Problem:** Python packages not found or version conflicts.

**Solution:**
```bash
# Delete and recreate venv
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. CORS Errors

**Problem:** Frontend can't access backend API.

**Solution:** Check `backend/settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5555",
    "http://127.0.0.1:5555",
]
```

### 5. Token Expiration

**Problem:** Users getting logged out frequently.

**Solution:** Adjust token lifetime in `backend/settings.py`:
```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),  # Increase this
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),  # Or this
}
```

### 6. Static Files Not Loading

**Problem:** CSS/JS not loading in production.

**Solution:**
```bash
python manage.py collectstatic
```

### 7. Migration Conflicts

**Problem:** Database migration errors.

**Solution:**
```bash
# Reset migrations (WARNING: This deletes data)
python manage.py migrate accounts zero
rm accounts/migrations/0*.py
python manage.py makemigrations
python manage.py migrate
```

### 8. Node Modules Issues

**Problem:** Frontend dependencies not working.

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Manual Changes Needed

After setting up the project, you may want to customize the following:

### 1. Project Branding

**Files to update:**
- `frontend/src/components/Navbar.jsx` - Update project name
- `frontend/index.html` - Update page title
- `frontend/public/` - Add your logo/favicon

### 2. Django Secret Key

For production, generate a new secret key:
```python
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
```

Update in `backend/.env`:
```env
DJANGO_SECRET_KEY=your-new-secret-key-here
```

### 3. Database Configuration

Update `backend/.env` with your production database:
```env
DB_NAME=production_db
DB_USER=production_user
DB_PASSWORD=strong_password
DB_HOST=your_db_host
```

### 4. CORS Settings for Production

Update `backend/settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    "https://yourdomain.com",
]
```

### 5. Frontend API URL

Update `frontend/.env`:
```env
VITE_API_URL=https://api.yourdomain.com/api
```

### 6. Add Your App

Create new Django apps:
```bash
cd backend
python manage.py startapp your_app_name
```

Add to `INSTALLED_APPS` in `settings.py`

### 7. Customize User Model

If you need additional fields in the User model:

**Edit:** `backend/accounts/models.py`
```python
class User(AbstractUser):
    # Add your fields here
    phone_number = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
```

**Then run:**
```bash
python manage.py makemigrations
python manage.py migrate
```

### 8. Email Configuration (Optional)

For password reset and email features, add to `backend/.env`:
```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```

### 9. Add More Frontend Pages

Create new pages in `frontend/src/pages/` and add routes in `App.jsx`

### 10. Customize Styling

Edit `frontend/tailwind.config.js` to match your brand colors:
```javascript
theme: {
  extend: {
    colors: {
      primary: '#your-color',
      secondary: '#your-color',
    },
  },
},
```

---

## Development Workflow

### Adding a New Feature

1. **Backend:**
   ```bash
   cd backend
   source venv/bin/activate

   # Create models
   # Edit models.py
   python manage.py makemigrations
   python manage.py migrate

   # Create serializers, views, URLs
   # Test in Django admin or API browser
   ```

2. **Frontend:**
   ```bash
   cd frontend

   # Create components/pages
   # Add routes
   # Create API service functions
   npm run dev
   ```

### Database Changes

```bash
# Make model changes
python manage.py makemigrations
python manage.py migrate

# To rollback
python manage.py migrate app_name 0001  # Roll back to migration 0001
```

### Running Tests

**Backend:**
```bash
cd backend
source venv/bin/activate
pytest
# Or
python manage.py test
```

**Frontend:**
```bash
cd frontend
npm test
```

---

## Testing

### Backend Testing

Create tests in `accounts/tests.py`:
```python
from django.test import TestCase
from rest_framework.test import APIClient

class MyTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_something(self):
        # Your test code
        pass
```

Run tests:
```bash
python manage.py test
# Or with pytest
pytest
```

### Frontend Testing

Add tests in `src/` directories. Example with React Testing Library:
```javascript
import { render, screen } from '@testing-library/react'
import Home from './Home'

test('renders home page', () => {
  render(<Home />)
  expect(screen.getByText(/welcome/i)).toBeInTheDocument()
})
```

---

## Deployment

### Backend Deployment (Production)

1. **Update settings.py:**
   ```python
   DEBUG = False
   ALLOWED_HOSTS = ['your-domain.com']
   ```

2. **Collect static files:**
   ```bash
   python manage.py collectstatic
   ```

3. **Use production server:**
   ```bash
   pip install gunicorn
   gunicorn project_name.wsgi:application
   ```

### Frontend Deployment

1. **Build for production:**
   ```bash
   npm run build
   ```

2. **Deploy `dist/` folder** to your hosting service (Netlify, Vercel, etc.)

### Recommended Hosting

- **Backend:** Heroku, Railway, DigitalOcean, AWS
- **Frontend:** Vercel, Netlify, AWS S3 + CloudFront
- **Database:** AWS RDS, ElephantSQL, DigitalOcean Managed Databases

---

## Troubleshooting

### Backend won't start

```bash
# Check Python version
python3 --version

# Activate venv
source venv/bin/activate

# Check for errors
python manage.py check

# View detailed errors
python manage.py runserver
```

### Frontend won't start

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version

# Try alternative port
npm run dev -- --port 3000
```

### Database connection failed

```bash
# Check PostgreSQL
pg_isready

# Check credentials in .env
cat backend/.env

# Test connection
psql -U your_user -d your_db_name
```

### Token issues

Check:
1. Tokens are being stored in localStorage
2. API interceptor is adding Authorization header
3. Token hasn't expired (check JWT settings)

### Build errors

```bash
# Backend
pip install --upgrade pip
pip install -r requirements.txt

# Frontend
npm install
npm run build
```

---

## Additional Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [Django REST Framework](https://www.django-rest-framework.org/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [**shadcn/ui Documentation**](https://ui.shadcn.com/) - See [SHADCN_UI_GUIDE.md](SHADCN_UI_GUIDE.md) for detailed usage
- [Radix UI](https://www.radix-ui.com/) - Accessible component primitives
- [Lucide Icons](https://lucide.dev/) - Beautiful icon library
- [Tailwind CSS](https://tailwindcss.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## Support

For issues related to:
- **Template bugs:** Create an issue in the template repository
- **Django/React general questions:** Check official documentation
- **Database issues:** Check PostgreSQL documentation

---

## License

This template is provided as-is for your use. Modify as needed for your projects.

---

## Contributing

This template is based on the AniFight project. Feel free to customize and improve for your needs.

---

Happy Coding! 🚀

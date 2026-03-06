# Quick Start Guide

Get your Django + React project up and running in minutes!

## Prerequisites Check

Make sure you have these installed:

```bash
python3 --version   # Should be 3.8+
node --version      # Should be 18+
psql --version      # Should be 12+
```

If any are missing:
```bash
# macOS
brew install python3 node postgresql@14

# Start PostgreSQL
brew services start postgresql@14
```

## Option 1: Automated Setup (Recommended)

```bash
cd template
chmod +x setup.sh
./setup.sh
```

Follow the prompts to configure your project. The script will:
- ✓ Create project directory
- ✓ Set up database
- ✓ Install all dependencies
- ✓ Run migrations
- ✓ Create superuser (optional)
- ✓ Generate start scripts

## Option 2: Quick Manual Setup

```bash
# 1. Set up database
cd template
chmod +x setup_database.sh
./setup_database.sh

# 2. Backend setup
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your database credentials
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000

# 3. Frontend setup (in a new terminal)
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Start Your Project

After setup:

```bash
# Start both servers
./start.sh

# Or start separately:
./start_backend.sh   # Backend on port 8000
./start_frontend.sh  # Frontend on port 5555
```

## Access Your Application

- **Frontend:** http://localhost:5555
- **Backend API:** http://localhost:8000/api
- **Django Admin:** http://localhost:8000/admin

## Test Authentication

1. Go to http://localhost:5555
2. Click "Register" and create an account
3. Login with your credentials
4. Access the Dashboard and Profile pages

## Next Steps

1. Read [README.md](README.md) for detailed documentation
2. Customize the User model in `backend/accounts/models.py`
3. Add your app-specific features
4. Update branding and styling
5. Deploy to production!

## Common Issues

**Port already in use:**
```bash
lsof -ti:8000 | xargs kill -9
lsof -ti:5555 | xargs kill -9
```

**PostgreSQL not running:**
```bash
brew services start postgresql@14
```

**Dependencies issues:**
```bash
# Backend
cd backend
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Need Help?

Check the [README.md](README.md) for:
- Complete documentation
- Troubleshooting guide
- API endpoints reference
- Deployment instructions

Happy coding! 🚀

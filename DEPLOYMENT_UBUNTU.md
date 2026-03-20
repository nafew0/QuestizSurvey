# Questiz Ubuntu Deployment Guide

This guide deploys Questiz on a single Ubuntu server for:

- Frontend domain: `https://survey.mindspear.app`
- Backend API on the same domain under: `https://survey.mindspear.app/api`
- Django admin on: `https://survey.mindspear.app/admin`

It assumes:

- You will push this repo to GitHub and clone it on the server.
- You already have another app on the same server.
- You want Nginx in front of both apps.
- You want Redis + Celery enabled so exports, emails, and background jobs work.

This guide keeps Questiz isolated from your other app by using:

- a separate app directory
- a separate Python virtualenv
- a separate PostgreSQL database/user
- a separate Gunicorn port
- separate systemd service names
- a separate Nginx server block

## 1. Recommended Production Layout

Use this layout:

```text
/srv/questizsurvey/
  app/                  # git clone lives here
    backend/
    frontend/
  logs/
```

Recommended unique values for this app:

| Item | Value |
|---|---|
| App root | `/srv/questizsurvey` |
| Repo clone | `/srv/questizsurvey/app` |
| Backend port | `8010` |
| PostgreSQL DB | `questizsurvey_db` |
| PostgreSQL user | `questizsurvey_user` |
| Nginx site file | `/etc/nginx/sites-available/questizsurvey` |
| Gunicorn service | `questiz-gunicorn` |
| Celery service | `questiz-celery` |

If your other app already uses port `8010`, choose a different private port such as `8011` or `8020`.

## 2. DNS

Before deploying, make sure this DNS record exists:

- Type: `A`
- Host: `survey`
- Value: your Ubuntu server IP

Wait for DNS to resolve before requesting SSL certificates.

## 3. Install System Packages

Run as a sudo-capable user:

```bash
sudo apt update
sudo apt install -y \
  python3 python3-venv python3-pip python3-dev build-essential \
  libpq-dev pkg-config \
  postgresql postgresql-contrib \
  redis-server \
  nginx \
  certbot python3-certbot-nginx \
  git curl
```

Install Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
python3 --version
node --version
npm --version
psql --version
redis-server --version
nginx -v
```

## 4. Prepare the App Directory

Create directories:

```bash
sudo mkdir -p /srv/questizsurvey
sudo mkdir -p /srv/questizsurvey/logs
sudo chown -R $USER:$USER /srv/questizsurvey
```

Clone the repo:

```bash
cd /srv/questizsurvey
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git app
cd /srv/questizsurvey/app
```

## 5. PostgreSQL Setup

Create a dedicated database and user for Questiz:

```bash
sudo -u postgres psql
```

Inside PostgreSQL:

```sql
CREATE DATABASE questizsurvey_db;
CREATE USER questizsurvey_user WITH PASSWORD 'CHANGE_THIS_TO_A_STRONG_PASSWORD';
ALTER ROLE questizsurvey_user SET client_encoding TO 'utf8';
ALTER ROLE questizsurvey_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE questizsurvey_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE questizsurvey_db TO questizsurvey_user;
\q
```

## 6. Backend Setup

Go to the backend:

```bash
cd /srv/questizsurvey/app/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel
pip install -r requirements.txt
pip install gunicorn
```

Create the production backend env file from the repo template:

```bash
cp .env.production.example .env
```

Edit `/srv/questizsurvey/app/backend/.env` and fill in the secrets:

```env
DJANGO_SECRET_KEY=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET
DEBUG=False

APP_ORIGIN=https://survey.mindspear.app
API_ORIGIN=https://survey.mindspear.app
PUBLIC_APP_URL=https://survey.mindspear.app
API_BASE_URL=https://survey.mindspear.app/api
ALLOWED_HOSTS=survey.mindspear.app
CORS_ALLOWED_ORIGINS=https://survey.mindspear.app
CSRF_TRUSTED_ORIGINS=https://survey.mindspear.app

DB_ENGINE=django.db.backends.postgresql
DB_NAME=questizsurvey_db
DB_USER=questizsurvey_user
DB_PASSWORD=CHANGE_THIS_TO_A_STRONG_PASSWORD
DB_HOST=127.0.0.1
DB_PORT=5432

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=YOUR_SMTP_HOST
EMAIL_PORT=587
EMAIL_HOST_USER=YOUR_SMTP_USERNAME
EMAIL_HOST_PASSWORD=YOUR_SMTP_PASSWORD
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
DEFAULT_FROM_EMAIL=no-reply@mindspear.app

CELERY_BROKER_URL=redis://127.0.0.1:6379/2
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/2
CELERY_TASK_ALWAYS_EAGER=False
CELERY_TASK_EAGER_PROPAGATES=True
USE_X_FORWARDED_HOST=True
TRUSTED_PROXY_IPS=127.0.0.1,::1
CSRF_COOKIE_SECURE=True
SESSION_COOKIE_SECURE=True
GUNICORN_BIND=127.0.0.1:8010
GUNICORN_WORKERS=3
GUNICORN_TIMEOUT=120

OPENAI_API_KEY=
OPENAI_RESPONSES_MODEL=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
```

Questiz now loads `backend/.env` automatically through Django settings, so `manage.py`, Gunicorn, and Celery all read the same env file.

AI provider secrets are environment-only. Do not enter API keys in Django admin or application settings; set `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` in `backend/.env` instead.

Lock down the env file:

```bash
chmod 640 /srv/questizsurvey/app/backend/.env
```

## 7. Frontend Setup

Go to the frontend:

```bash
cd /srv/questizsurvey/app/frontend
npm install
```

Create the production frontend env file from the repo template:

```bash
cp .env.production.example .env.production
```

`/srv/questizsurvey/app/frontend/.env.production` should contain:

```env
VITE_API_URL=/api
```

Using `/api` keeps the React build portable across staging and production because Nginx serves the frontend and reverse proxies the API on the same host.

Build the frontend:

```bash
cd /srv/questizsurvey/app/frontend
npm run build
```

## 8. Run Django Setup Commands

```bash
cd /srv/questizsurvey/app/backend
source venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
```

Optional health check:

```bash
python manage.py check
```

## 9. Start Redis

Enable and start Redis:

```bash
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

Verify:

```bash
redis-cli ping
```

Expected:

```text
PONG
```

## 10. Install the systemd Service for Gunicorn

Copy the repo template and replace `__LINUX_USER__`:

```bash
sed "s/__LINUX_USER__/$USER/g" /srv/questizsurvey/app/deploy/systemd/questiz-gunicorn.service | sudo tee /etc/systemd/system/questiz-gunicorn.service >/dev/null
```
Gunicorn reads its runtime config from [backend/gunicorn.conf.py](/Users/nafew/Documents/Web%20Projects/QuestizSurvey/backend/gunicorn.conf.py), so you do not need to hardcode worker counts or ports in the service file.

## 11. Install the systemd Service for Celery

Copy the repo template and replace `__LINUX_USER__`:

```bash
sed "s/__LINUX_USER__/$USER/g" /srv/questizsurvey/app/deploy/systemd/questiz-celery.service | sudo tee /etc/systemd/system/questiz-celery.service >/dev/null
```

On Ubuntu Linux, Celery can use the normal prefork worker pool. The macOS `-P solo` workaround is not needed here.

## 12. Enable and Start Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable questiz-gunicorn
sudo systemctl enable questiz-celery
sudo systemctl start questiz-gunicorn
sudo systemctl start questiz-celery
```

Check status:

```bash
sudo systemctl status questiz-gunicorn
sudo systemctl status questiz-celery
```

You can also test Gunicorn locally on the server:

```bash
curl http://127.0.0.1:8010/admin/login/
```

You should get an HTML response.

## 13. Nginx Configuration

This is the important part for running Questiz beside another app.

Rules:

- Use a unique `server_name`: `survey.mindspear.app`
- Use a unique upstream name: `questiz_backend`
- Use a unique internal backend port: `8010`
- Do not use `default_server`
- Do not overwrite the other app's Nginx file

Copy the repo Nginx template:

```bash
sudo cp /srv/questizsurvey/app/deploy/nginx/questizsurvey.conf /etc/nginx/sites-available/questizsurvey
```

If you changed `GUNICORN_BIND` to a port other than `8010`, update the `server 127.0.0.1:8010;` line in `/etc/nginx/sites-available/questizsurvey` to match before enabling the site.

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/questizsurvey /etc/nginx/sites-enabled/questizsurvey
```

Test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 14. SSL with Certbot

Once Nginx is serving the HTTP site correctly:

```bash
sudo certbot --nginx -d survey.mindspear.app
```

Choose the redirect-to-HTTPS option when prompted.

After that, verify:

```bash
curl -I https://survey.mindspear.app
```

## 15. File Permissions

Nginx must be able to read the built frontend, static files, and media files.

Use:

```bash
sudo chown -R YOUR_LINUX_USER:www-data /srv/questizsurvey
sudo find /srv/questizsurvey -type d -exec chmod 755 {} \;
sudo chmod 640 /srv/questizsurvey/app/backend/.env
```

If media uploads or static files fail with permission errors, also run:

```bash
sudo chmod -R 775 /srv/questizsurvey/app/backend/media
sudo chmod -R 775 /srv/questizsurvey/app/backend/staticfiles
```

## 16. First Production Checklist

Confirm all of these:

- `https://survey.mindspear.app` loads the React app
- `https://survey.mindspear.app/admin` loads Django admin
- login works
- survey creation works
- public survey links work
- email sending works
- exports work
- files appear under `/srv/questizsurvey/app/backend/media/exports/`

## 17. Verify Export/Celery Flow

If export jobs stay `pending`, check:

```bash
sudo systemctl status redis-server
sudo systemctl status questiz-celery
sudo journalctl -u questiz-celery -f
```

Questiz exports only complete when:

- Redis is up
- Celery is running
- the worker can import all Python dependencies
- the worker can write to `backend/media/exports/`

## 18. Logs and Troubleshooting

Useful commands:

```bash
sudo journalctl -u questiz-gunicorn -f
sudo journalctl -u questiz-celery -f
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

Common issues:

### 502 Bad Gateway

Usually means Gunicorn is not running or is bound to the wrong port.

Check:

```bash
sudo systemctl status questiz-gunicorn
curl http://127.0.0.1:8010/
```

### Exports remain pending

Usually means Celery is down.

Check:

```bash
sudo systemctl status questiz-celery
redis-cli ping
```

### Static files missing

Run:

```bash
cd /srv/questizsurvey/app/backend
source venv/bin/activate
python manage.py collectstatic --noinput
sudo systemctl restart questiz-gunicorn
sudo systemctl reload nginx
```

### Frontend shows old UI after deploy

Rebuild:

```bash
cd /srv/questizsurvey/app/frontend
npm install
npm run build
sudo systemctl reload nginx
```

### SMTP errors

Double-check:

- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `EMAIL_USE_TLS` / `EMAIL_USE_SSL`

## 19. Future Deployments

After you push new code to GitHub, deploy updates like this:

```bash
cd /srv/questizsurvey/app
git pull origin main
```

Backend:

```bash
cd /srv/questizsurvey/app/backend
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
python manage.py migrate
python manage.py collectstatic --noinput
```

Frontend:

```bash
cd /srv/questizsurvey/app/frontend
npm install
npm run build
```

Restart services:

```bash
sudo systemctl restart questiz-gunicorn
sudo systemctl restart questiz-celery
sudo systemctl reload nginx
```

## 20. Notes for Running Another App on the Same Server

Because you already have another app on this box:

- Do not reuse the other app's Gunicorn port.
- Do not reuse the other app's PostgreSQL database.
- Do not reuse the other app's Nginx upstream name.
- Do not overwrite the other app's Nginx server block.
- It is fine to share the same system PostgreSQL service.
- It is fine to share the same system Redis service.
- It is fine to share the same Nginx service.

Each app should have:

- its own repo directory
- its own venv
- its own `.env`
- its own static/media paths
- its own systemd units
- its own `server_name`

## 21. Optional Hardening Later

Once the basic deployment works, consider:

- moving export/media storage to S3
- adding automated Postgres backups
- adding fail2ban
- adding UFW firewall rules
- turning on Django secure cookie settings
- adding Sentry or another error tracker

## 22. Minimum Working Command Summary

If you want the shortest possible order:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip python3-dev build-essential libpq-dev postgresql postgresql-contrib redis-server nginx certbot python3-certbot-nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo mkdir -p /srv/questizsurvey
sudo chown -R $USER:$USER /srv/questizsurvey
cd /srv/questizsurvey
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git app

cd /srv/questizsurvey/app/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel
pip install -r requirements.txt
pip install gunicorn
cp .env.example .env

cd /srv/questizsurvey/app/frontend
npm install
cp .env.example .env
npm run build

cd /srv/questizsurvey/app/backend
source venv/bin/activate
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser

sudo systemctl enable redis-server
sudo systemctl start redis-server
```

Then finish the systemd and Nginx steps above.

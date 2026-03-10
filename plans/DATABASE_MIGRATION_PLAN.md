# Database Migration Plan: Local PostgreSQL to Production

This document outlines the steps to migrate your QuestizSurvey database from your local PostgreSQL to your Ubuntu 24.04 production server.

## Database Credentials

| | Local | Production |
|---|-------|------------|
| **Database** | `questizsurvey_db` | `questizsurvey_db` |
| **User** | `postgres` | `questizsurvey_user` |
| **Host** | `localhost` | `127.0.0.1` |
| **Port** | `5432` | `5432` |

## Architecture

```
Local PostgreSQL (questizsurvey_db)
        |
        | pg_dump
        v
local_dump.sql
        |
        | SCP transfer
        v
Production Server (/srv/questizsurvey/)
        |
        | pg_restore
        v
Production PostgreSQL (questizsurvey_db)
```

## Step-by-Step Commands

---

### Step 1: Backup Production Database (Safety Measure)

**Run on your production server:**

```bash
# Create a backup of the current production database
sudo -u postgres pg_dump questizsurvey_db > /srv/questizsurvey/backup_pre_migration.sql

# Verify backup was created
ls -la /srv/questizsurvey/backup_pre_migration.sql
```

---

### Step 2: Dump Local Database

**Run on your local machine:**

```bash
# Navigate to your project directory
cd /Users/nafew/Documents/Web\ Projects/QuestizSurvey

# Dump the local PostgreSQL database
pg_dump -U postgres -h localhost -d questizsurvey_db -F c -b -v -f local_dump.sql

# Note: 
#   -F c  = custom format (compressed, recommended)
#   -b    = include large objects
#   -v    = verbose output
#   -f    = output file
```

Alternative (plain SQL format):
```bash
pg_dump -U postgres -h localhost questizsurvey_db > local_dump.sql
```

---

### Step 3: Transfer Dump File to Production Server

**Run on your local machine:**

```bash
# Replace YOUR_USERNAME and YOUR_SERVER_IP with your actual values
scp local_dump.sql YOUR_USERNAME@YOUR_SERVER_IP:/srv/questizsurvey/

# Example:
# scp local_dump.sql root@192.168.1.100:/srv/questizsurvey/
```

Or if using SSH key:
```bash
scp -i ~/.ssh/your_key local_dump.sql YOUR_USERNAME@YOUR_SERVER_IP:/srv/questizsurvey/
```

Verify transfer:
```bash
ssh YOUR_USERNAME@YOUR_SERVER_IP "ls -la /srv/questizsurvey/local_dump.sql"
```

---

### Step 4: Restore Database on Production Server

**Run on your production server:**

```bash
# Option A: Drop and recreate database (cleanest approach)
sudo -u postgres psql -c "DROP DATABASE IF EXISTS questizsurvey_db;"
sudo -u postgres psql -c "CREATE DATABASE questizsurvey_db;"

# Restore from custom format dump
sudo -u postgres pg_restore -d questizsurvey_db -U postgres -v /srv/questizsurvey/local_dump.sql

# Option B: If using plain SQL format:
# sudo -u postgres psql -d questizsurvey_db -f /srv/questizsurvey/local_dump.sql
```

Grant permissions to production user:
```bash
# Grant all privileges to the production user
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE questizsurvey_db TO questizsurvey_user;"

# Grant schema privileges (if needed)
sudo -u postgres psql -d questizsurvey_db -c "GRANT ALL ON SCHEMA public TO questizsurvey_user;"
sudo -u postgres psql -d questizsurvey_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO questizsurvey_user;"
sudo -u postgres psql -d questizsurvey_db -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO questizsurvey_user;"
```

---

### Step 5: Restart Production Services

**Run on your production server:**

```bash
# Restart Gunicorn
sudo systemctl restart questiz-gunicorn
sudo systemctl status questiz-gunicorn

# Restart Celery
sudo systemctl restart questiz-celery
sudo systemctl status questiz-celery
```

---

### Step 6: Verify Migration

**Run on your production server:**

```bash
# Check database size
sudo -u postgres psql -d questizsurvey_db -c "SELECT pg_size_pretty(pg_database_size('questizsurvey_db'));"

# Count records in key tables
sudo -u postgres psql -d questizsurvey_db -c "SELECT 'surveys' as table_name, COUNT(*) as count FROM surveys_survey UNION ALL SELECT 'questions', COUNT(*) FROM surveys_question UNION ALL SELECT 'responses', COUNT(*) FROM surveys_response;"

# Check Django models
cd /srv/questizsurvey/app/backend
source venv/bin/activate
python manage.py shell -c "from surveys.models import Survey; print(f'Surveys: {Survey.objects.count()}')"
```

---

### Step 7: Test Production Application

1. Visit `https://survey.mindspear.app/admin` and login
2. Verify your surveys are visible
3. Test survey creation
4. Test a public survey link
5. Check export functionality

---

## Troubleshooting

### Permission Denied Errors

If you get permission errors after restore:

```bash
sudo -u postgres psql -d questizsurvey_db -c "GRANT ALL PRIVILEGES ON DATABASE questizsurvey_db TO questizsurvey_user;"
sudo -u postgres psql -d questizsurvey_db -c "ALTER DATABASE questizsurvey_db OWNER TO questizsurvey_user;"
```

### Connection Errors

Verify production database settings in `/srv/questizsurvey/app/backend/.env`:

```bash
cat /srv/questizsurvey/app/backend/.env | grep -E "^DB_"
```

Should show:
```
DB_ENGINE=django.db.backends.postgresql
DB_NAME=questizsurvey_db
DB_USER=questizsurvey_user
DB_PASSWORD=YOUR_PASSWORD
DB_HOST=127.0.0.1
DB_PORT=5432
```

### Service Won't Start

Check logs:
```bash
sudo journalctl -u questiz-gunicorn -n 50
sudo journalctl -u questiz-celery -n 50
```

---

## Rollback Plan

If migration fails, restore from backup:

```bash
# On production server
sudo -u postgres psql -c "DROP DATABASE IF EXISTS questizsurvey_db;"
sudo -u postgres psql -c "CREATE DATABASE questizsurvey_db;"
sudo -u postgres pg_restore -d questizsurvey_db -U postgres -v /srv/questizsurvey/backup_pre_migration.sql
sudo systemctl restart questiz-gunicorn
sudo systemctl restart questiz-celery
```

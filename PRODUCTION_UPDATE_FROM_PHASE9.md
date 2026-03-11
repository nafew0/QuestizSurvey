# Questiz Production Update Guide

This guide is for updating a Questiz production server that is currently around Phase 9 of the development plan.

It assumes you deployed the app using:

- [DEPLOYMENT_UBUNTU.md](/Users/nafew/Documents/Web Projects/QuestizSurvey/DEPLOYMENT_UBUNTU.md)
- app path: `/srv/questizsurvey/app`
- backend path: `/srv/questizsurvey/app/backend`
- frontend path: `/srv/questizsurvey/app/frontend`
- Gunicorn service: `questiz-gunicorn`
- Celery service: `questiz-celery`
- Nginx site already working

This update includes backend changes, frontend UI changes, and one database migration.

## 1. Changelog Since Your Phase 9 Production

### Branding and public pages

- Added support for a site logo and favicon.
- Added reusable brand logo support in the navbar and auth pages.
- Redesigned the homepage.
- Redesigned the login page.
- Redesigned the registration page.
- Cleaned up the homepage hero section and moved the workspace showcase below the hero.
- Reduced the overuse of identical rounded cards by varying the card shapes and layout.

### Survey response fixes

- Fixed conditional branching so `skip_to_page` now works correctly.
- Fixed conditional branching so `end_survey` now works correctly.
- Fixed `Other` answer inputs so they appear correctly in the response form.
- Fixed optional comment fields so they appear correctly in the response form.
- Changed NPS to a horizontal slider.
- Moved the constant sum running total and instruction to the top of the answer area.
- Added drag-and-drop reordering for ranking questions.
- Fixed demographic field ordering so city and zip are no longer incorrectly shown first.

### Survey lottery system

- Added a survey-level lottery page.
- Added lottery field selection from survey response data.
- Added prize slots and winner history.
- Added an animated spinning wheel.
- Added optional lottery spin audio and winner audio.
- Improved the wheel layout, text placement, center spin button, winner reveal timing, and celebratory overlay.

### New question types

- Added `open_ended` question type.
- Added `matrix_plus` question type.
- Added builder support for both types.
- Added respondent form support for both types.
- Added save/restore support for both types.
- Added validation support for both types.
- Added analytics support for both types.
- Added export/report formatting support for both types.
- Added response browser support for both types.
- Added lottery formatting support for nested answers from the new types.

### Builder UX fix

- Fixed the survey builder so adding a question or page no longer refetches the full builder and jump-scrolls the user back to the top.

## 2. Important Files You May Want to Upload

### Required branding files

Put these in:

`frontend/public/branding/`

Files:

- `logo.svg`
- `logo.ico`

### Optional auth page images

Put these in:

`frontend/public/branding/`

Files:

- `loginpage.webp`
- `registerpage.webp`

### Optional lottery sound files

Put these in:

`frontend/public/audio/`

Files:

- `lottery-tick.mp3`
- `lottery-win.mp3`

Important:

- If you add or replace any file inside `frontend/public/`, you must run `npm run build` again on the server so the new files are copied into the production build.

## 3. Before You Touch Production

Recommended:

1. Make sure your latest local code is working.
2. Make sure your logo and optional media files are already in the correct local folders.
3. Push everything to GitHub first.
4. Then update the server from GitHub.

If you skip the GitHub step, the server cannot pull your latest code.

## 4. Local Machine Steps

### Step 1: Put branding and optional media files in the repo

Place files here on your local machine:

- `frontend/public/branding/logo.svg`
- `frontend/public/branding/logo.ico`
- `frontend/public/branding/loginpage.webp` if you want a custom login image
- `frontend/public/branding/registerpage.webp` if you want a custom registration image
- `frontend/public/audio/lottery-tick.mp3` if you want wheel ticking sound
- `frontend/public/audio/lottery-win.mp3` if you want a winner sound

### Step 2: Optional local check

Frontend:

```bash
cd /Users/nafew/Documents/Web\ Projects/QuestizSurvey/frontend
npm install
npm run build
```

Backend:

```bash
cd /Users/nafew/Documents/Web\ Projects/QuestizSurvey/backend
python3 manage.py migrate
```

If you use a local development database that you do not want to change, you can skip the local `migrate` command.

### Step 3: Commit and push your changes

From the project root:

```bash
cd /Users/nafew/Documents/Web\ Projects/QuestizSurvey
git status
git add .
git commit -m "Deploy post-phase-9 Questiz updates"
git push origin main
```

If your production branch is not `main`, replace `main` with your real branch name.

If `git status` shows unrelated files you do not want to deploy yet, do not use `git add .`. Add only the files you want.

## 5. Server Update Steps

### Step 1: SSH into the server

```bash
ssh YOUR_SERVER_USER@YOUR_SERVER_IP
```

### Step 2: Go to the Questiz app folder

```bash
cd /srv/questizsurvey/app
```

### Step 3: Optional backup before update

This is strongly recommended because this update includes a database migration.

#### Backup the database

```bash
pg_dump -U questizsurvey_user -h 127.0.0.1 questizsurvey_db > ~/questizsurvey_backup_before_update.sql
```

#### Backup the backend env file

```bash
cp /srv/questizsurvey/app/backend/.env ~/questiz_backend_env_backup
```

### Step 4: Pull the latest code from GitHub

```bash
cd /srv/questizsurvey/app
git pull origin main
```

If your production branch is not `main`, replace `main` with the correct branch.

If `git pull` fails because of local changes on the server, stop there and check:

```bash
git status
```

Do not force anything if you are unsure.

### Step 5: Update the backend

```bash
cd /srv/questizsurvey/app/backend
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py check
```

What this does:

- installs any updated Python packages
- applies the new database migration
- updates static files
- runs a Django config check

Important:

- The new question types require the migration in `backend/surveys/migrations/0003_expand_question_types.py`.

### Step 6: Update the frontend

```bash
cd /srv/questizsurvey/app/frontend
npm install
npm run build
```

This step is required for:

- homepage/login/register redesign changes
- logo and favicon support
- lottery page UI
- new respondent question type UI
- builder no-reload behavior

### Step 7: Restart services

```bash
sudo systemctl restart questiz-gunicorn
sudo systemctl restart questiz-celery
sudo systemctl reload nginx
```

### Step 8: Check service status

```bash
sudo systemctl status questiz-gunicorn
sudo systemctl status questiz-celery
sudo systemctl status nginx
```

If the status page opens in a pager, press `q` to exit.

## 6. If You Want To Upload Branding Files Directly On The Server

This is only needed if you do not want to commit the files to GitHub.

### Step 1: Copy files to the correct server folders

Branding files go here:

```bash
/srv/questizsurvey/app/frontend/public/branding/
```

Lottery sound files go here:

```bash
/srv/questizsurvey/app/frontend/public/audio/
```

### Step 2: Rebuild the frontend

```bash
cd /srv/questizsurvey/app/frontend
npm run build
sudo systemctl reload nginx
```

Without the rebuild, the new files in `frontend/public/` may not appear in the live site.

## 7. Production Smoke Test

After deployment, test these in the browser:

### Main pages

- homepage loads correctly
- login page loads correctly
- registration page loads correctly
- logo appears in the navbar
- favicon appears in the browser tab

### Survey builder

- open an existing survey
- add a question
- confirm the page does not jump back to the top
- add a page
- confirm the page does not jump back to the top

### Public survey response flow

- test a survey with conditional branching
- test `skip_to_page`
- test `end_survey`
- test a question with `Other`
- test a question with an optional comment field
- test NPS slider
- test constant sum total display
- test ranking drag-and-drop

### New question types

- create an `open_ended` question
- create a `matrix_plus` question
- preview both
- submit responses to both
- open analytics and confirm data appears

### Lottery page

- open a survey lottery page
- select entrant fields
- save prize slots
- spin the wheel
- confirm the winner is only shown after the spin completes
- confirm optional sound files work if you uploaded them

## 8. Very Common Problems and Fixes

### Problem: The site still shows the old UI

Run:

```bash
cd /srv/questizsurvey/app/frontend
npm install
npm run build
sudo systemctl reload nginx
```

Then hard refresh the browser with:

- `Ctrl + Shift + R` on Windows/Linux
- `Cmd + Shift + R` on Mac

### Problem: New question types do not appear

You probably did not finish the backend migration or the frontend build.

Run:

```bash
cd /srv/questizsurvey/app/backend
source venv/bin/activate
python manage.py migrate

cd /srv/questizsurvey/app/frontend
npm run build

sudo systemctl restart questiz-gunicorn
sudo systemctl reload nginx
```

### Problem: The logo or auth page image does not show

Check:

- the file name is exactly correct
- the file is in the correct `frontend/public/branding/` folder
- you rebuilt the frontend after adding the file

### Problem: Lottery sounds do not play

Check:

- the files are named exactly `lottery-tick.mp3` and `lottery-win.mp3`
- the files are in `frontend/public/audio/`
- you rebuilt the frontend after adding the files
- your browser tab is not muted

### Problem: Gunicorn does not start after deploy

Check logs:

```bash
sudo journalctl -u questiz-gunicorn -f
```

### Problem: Celery does not start after deploy

Check logs:

```bash
sudo journalctl -u questiz-celery -f
```

## 9. Do You Need Any New Environment Variables?

For the changes in this update, normally:

- no new production env variables are required

Your existing production `.env` from the Ubuntu deployment guide should still be enough, as long as your current backend and frontend env files are already correct.

## 10. Recommended Safe Deployment Order

If you want the shortest version, use this order:

1. Put logo and optional media files in the correct repo folders locally.
2. Commit and push everything to GitHub.
3. SSH into the server.
4. Backup the database.
5. `git pull origin main`
6. Update backend dependencies and run `python manage.py migrate`
7. Run `python manage.py collectstatic --noinput`
8. Build the frontend with `npm run build`
9. Restart Gunicorn and Celery
10. Reload Nginx
11. Test the live site

## 11. Recommended First Real Deploy Command Set

If you want one simple copyable sequence, use these one by one on the server:

```bash
cd /srv/questizsurvey/app
git pull origin main

cd /srv/questizsurvey/app/backend
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py check

cd /srv/questizsurvey/app/frontend
npm install
npm run build

sudo systemctl restart questiz-gunicorn
sudo systemctl restart questiz-celery
sudo systemctl reload nginx
```

If your branch is not `main`, replace it in the `git pull` command.

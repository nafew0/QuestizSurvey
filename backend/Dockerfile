# ---------- Python 3.12 slim base ----------
FROM python:3.12-slim AS base

# Prevent Python from writing .pyc and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System dependencies for WeasyPrint (Cairo, Pango, GDK-Pixbuf) + PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    libglib2.0-0 \
    shared-mime-info \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project source
COPY . .

# Collect static files (needs SECRET_KEY set, use a dummy for build)
RUN DJANGO_SECRET_KEY=build-placeholder \
    ENVIRONMENT=development \
    python manage.py collectstatic --noinput

# Create non-root user
RUN addgroup --system django && adduser --system --ingroup django django \
    && mkdir -p /app/staticfiles /app/media \
    && chown -R django:django /app/staticfiles /app/media

USER django

EXPOSE 8000

# Default command: run migrations then start Gunicorn with Uvicorn workers
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn questizsurvey.asgi:application -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --workers ${GUNICORN_WORKERS:-2} --timeout ${GUNICORN_TIMEOUT:-120}"]

import multiprocessing
import os


bind = os.environ.get("GUNICORN_BIND", "127.0.0.1:8010")
workers = int(
    os.environ.get("GUNICORN_WORKERS", max(2, multiprocessing.cpu_count() // 2))
)
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "120"))
graceful_timeout = int(os.environ.get("GUNICORN_GRACEFUL_TIMEOUT", "30"))
keepalive = int(os.environ.get("GUNICORN_KEEPALIVE", "5"))
accesslog = os.environ.get("GUNICORN_ACCESSLOG", "-")
errorlog = os.environ.get("GUNICORN_ERRORLOG", "-")
capture_output = True
worker_tmp_dir = "/dev/shm"

# Employee Performance Management System (Minimal Production-ready)

## Overview
A simple, production-oriented starter project implementing:
- Flask REST API backend (Python)
- AngularJS (1.x) frontend (HTML5 + Bootstrap)
- Chart.js visualizations
- SQLAlchemy ORM (defaults to SQLite for local runs; easy to switch to MySQL/Postgres)
- JWT authentication with role-based access (Admin / Manager)

## Quick start (local)
1. Create & activate a virtualenv (recommended).
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Initialize DB & seed sample data:
   ```bash
   export FLASK_APP=app.py
   flask db_init
   ```
   (On Windows PowerShell use `setx` or run `python app.py --init-db`.)
4. Run:
   ```bash
   flask run --host=0.0.0.0 --port=5000
   ```
5. Open http://localhost:5000 in your browser.

## Default users (seeded)
- Admin: email `admin@example.com`, password `AdminPass123`
- Manager: email `manager@example.com`, password `ManagerPass123`

## Switching DB
Configure `DATABASE_URL` environment variable (SQLAlchemy URL) to use MySQL or Postgres:
- Postgres example: `postgresql://user:pass@localhost:5432/dbname`
- MySQL example: `mysql+pymysql://user:pass@localhost:3306/dbname`

## Project structure (key files)
- app.py               -> Flask app entry, CLI command to init DB
- models.py            -> SQLAlchemy models
- api.py               -> REST API endpoints
- static/              -> AngularJS frontend (index.html, app.js, styles.css)
- requirements.txt
- seed_data.py         -> seeding helper

## Notes
This is a starter "production-ready" scaffold emphasizing:
- clear separation of backend API and frontend static app
- token-based auth, role checks
- easy DB swapping via SQLAlchemy
- charting using Chart.js
Feel free to expand (pagination, file uploads, better styling, RBAC, unit tests, CI).

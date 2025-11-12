# HOS Simulator — full project setup

The project contains a React (Vite) frontend and a Django REST backend implementing the Hours of Service simulator used in this workspace.

Follow the full instructions in the repository root README in this workspace (or run the commands below) to set up both frontend and backend on Windows PowerShell.

## Quickstart (backend + frontend)

```powershell
# 1) Backend: create and activate venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2) Install backend deps
pip install --upgrade pip
pip install -r "django_backend\hos_backend\requirements.txt"

# 3) Run DB migrations and server
cd django_backend\hos_backend
python manage.py migrate
python manage.py runserver

# 4) Frontend (in project root)
cd ..\..
npm install
npm run dev
```

The frontend (Vite) runs at `http://localhost:5173` and the backend runs at `http://127.0.0.1:8000` by default. The frontend calls the backend endpoint `POST /api/process/` to run the HOS simulation.

If you need a full, dedicated README placed at the repository root, let me know and I will replace the template README completely.

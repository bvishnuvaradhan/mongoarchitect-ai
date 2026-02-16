# MongoArchitect AI

MongoDB schema assistant with authentication, schema history, and a modern dashboard UI.

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: FastAPI (Python)
- Database: MongoDB Atlas (via Motor)
- Auth: JWT

## Project Structure

- frontend/ - React app
- backend/ - FastAPI app

## Setup

### 1) Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m spacy download en_core_web_sm
copy .env.example .env
uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`.

### 2) Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Environment Variables

Create `backend/.env` based on `backend/.env.example`.

```
MONGODB_URI=your_mongodb_atlas_uri
DATABASE_NAME=mongoarchitect
JWT_SECRET=replace_with_secure_value
ALLOWED_ORIGINS=http://localhost:5173
```

## Logos

Place your logos in:

- `frontend/public/logo-square.png`
- `frontend/public/logo-horizontal.png`

The UI will automatically show them when present.

## Notes

- Schema generation and AI logic are currently rule-based placeholders.
- History is stored per-user in MongoDB.

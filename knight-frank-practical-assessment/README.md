## Knight Frank assessment platform

### Frontend

From this directory, install dependencies and start Next.js:

```bash
npm install
npm run dev
```

The login and signup forms call the FastAPI service at `http://localhost:8000` by default. Set `NEXT_PUBLIC_API_URL` in `.env.local` if the API is hosted at a different URL.

### Backend

Install and run the API from its directory:

```powershell
cd src/backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a `.env` file in `src/backend` with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then start the API:

```powershell
uvicorn main:app --reload --port 8000
```

The API allows the local frontend origins `http://localhost:3000` and `http://127.0.0.1:3000`. For deployment, set `FRONTEND_ORIGINS` in the backend environment to a comma-separated list of permitted frontend origins.

After a successful login, the API's `/success` redirect opens the assessment portal page. Sign-up success returns the user to the login form.

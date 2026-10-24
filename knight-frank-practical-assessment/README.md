## Knight Frank assessment platform

### Frontend

From this directory, install dependencies and start Next.js:

```bash
npm install
npm run dev
```

The login and signup forms call the FastAPI service at `http://localhost:8000` by default. Set `NEXT_PUBLIC_API_URL` in `.env.local` if the API is hosted at a different URL.

Frank sends chat messages to the FastAPI `/chat/stream` endpoint. The endpoint streams agent progress updates (intent classification, report/news retrieval, and response generation) before returning Frank's answer and sources. Property-search questions use Gemini to extract listing filters and return up to three matching properties as structured data for display in the chat. The chat reuses the returned session ID to preserve conversation context.

### Deploying the frontend to Cloudflare Workers

The Next.js frontend uses OpenNext for Cloudflare. In Cloudflare Workers Builds, set the root directory to this app directory, the build command to `npx opennextjs-cloudflare build`, and the deploy command to `npx opennextjs-cloudflare deploy`. The OpenNext configuration files must be committed to the repository.

Set `NEXT_PUBLIC_API_URL` as a production build environment variable to the public URL of the separately deployed FastAPI backend, for example `https://api.example.com`. This value is embedded in the frontend at build time and must not contain secrets. Configure the backend's `FRONTEND_ORIGINS` with the deployed frontend origin.

To test the Cloudflare runtime locally, run `npm run preview`. To deploy from the command line, run `npm run deploy`.

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

Set `GOOGLE_API_KEY` in that file, and optionally `GOOGLE_API_KEY1` through `GOOGLE_API_KEY9` as backup Gemini keys. On a quota response, the backend retries with the next configured key and cycles back to `GOOGLE_API_KEY` after the last key.

The API allows the local frontend origins `http://localhost:3000` and `http://127.0.0.1:3000`. For deployment, set `FRONTEND_ORIGINS` in the backend environment to a comma-separated list of permitted frontend origins.

After a successful login, the API's `/success` redirect opens the assessment portal page. Sign-up success returns the user to the login form.

# Deploy backend to Render (Docker)

This file describes the exact steps to deploy the FastAPI backend to Render using the Dockerfile and `render.yaml` already in the repository.

Prerequisites
- A Render account connected to the GitHub repository `mongoarchitect-ai`.
- Repository contains `Dockerfile` and `render.yaml` at repository root.

1) Push code to `main`

```bash
git add Dockerfile render.yaml
git commit -m "Add Dockerfile + render manifest for Render Docker deploy"
git push origin main
```

2) Create the Render service
- Login to Render → New → Web Service
- Select your GitHub repo `mongoarchitect-ai`
- Choose **Deploy from render.yaml** (Render will detect `render.yaml`). If not detected, select Docker, branch `main`, and Dockerfile.
- Name: `mongoarchitect-api` (or accept the detected name)
- Environment: Docker
- Branch: `main`
- Region/Plan: choose `free` for testing or a paid plan for production

3) Set environment variables (Render → Service → Environment)
Add these keys (replace <> with your values):

- `MONGODB_URI` = mongodb+srv://<user>:<url-encoded-password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
- `DATABASE_NAME` = mongoarchitect
- `JWT_SECRET` = <a-long-random-secret>
- `JWT_ALGORITHM` = HS256
- `ACCESS_TOKEN_EXPIRE_MINUTES` = 60
- `ALLOWED_ORIGINS` = http://localhost:5173
- `GROQ_API_KEY` = <your_groq_key>  # optional

Notes:
- URL-encode any special characters in the MongoDB password (e.g., `@` -> `%40`).
- Do NOT commit secrets to the repo. Use Render's Environment form.

4) Add GitHub secret for keep-alive workflow
- In GitHub → Settings → Secrets → Actions → New repository secret
  - Name: `RENDER_HEALTH_URL`
  - Value: `https://<your-render-service>.onrender.com/`

5) Trigger a deploy
- Click Manual Deploy in Render or push to `main` to trigger an automatic deploy.

6) Verify build & logs
- Open the deploy logs in Render. Look for Docker build success and `uvicorn` startup.
- If you see build errors for `blis`/`thinc`/`spacy`, the Dockerfile includes system deps to resolve them; review logs for missing libs.

7) Smoke test the API

```bash
curl -I https://<your-render-service>.onrender.com/
curl https://<your-render-service>.onrender.com/openapi.json
```

8) Deploy frontend & update CORS
- Deploy the frontend on Vercel and set `VITE_API_URL` to `https://<your-render-service>.onrender.com` in Vercel environment variables.
- After frontend is live, update Render `ALLOWED_ORIGINS` to the Vercel origin (e.g., `https://your-app.vercel.app`) and redeploy the backend.

Troubleshooting
- If builds fail due to missing system libs, ensure the Dockerfile installs `build-essential`, `gcc`, `libatlas-base-dev`, and `gfortran` (already included).
- If the service fails to start, check the `CMD` in the Dockerfile refers to `app.main:app` and that `backend` source is copied to `/app`.

If you want, I can also:
- create a health-check endpoint (e.g., `/health`) and update the GitHub secret value suggestion, or
- add a small Render health-check action that verifies the endpoint after deploy.

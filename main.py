"""Vercel entrypoint for the stateless API and the built SPA frontend."""

from backend.app.main import app

# FastAPI routes handle the stateless API; the built SPA and its source data are
# promoted to Vercel's CDN with an index.html fallback for React Router.
app.frontend("/", directory="dist", fallback="index.html")

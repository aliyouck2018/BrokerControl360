.PHONY: install frontend backend test

install:
	npm install
	python3 -m venv .venv
	.venv/bin/pip install -r backend/requirements.txt

frontend:
	npm run dev

backend:
	.venv/bin/uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8001

test:
	npm test
	.venv/bin/pytest backend/tests

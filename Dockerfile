# One container serves both the API and the built React app.
# NOTE: written for convenience, not built or run in the environment where the project was generated.
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PORT=5000 SEED_DEMO=1
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY --from=web /web/dist frontend/dist
WORKDIR /app/backend
RUN mkdir -p instance
EXPOSE 5000
CMD ["sh", "-c", "gunicorn -b 0.0.0.0:${PORT} -w 2 --timeout 120 run:app"]

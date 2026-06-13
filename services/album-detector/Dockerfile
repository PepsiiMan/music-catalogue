FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app
COPY pyproject.toml .
COPY .python-version .
COPY src/ src/
RUN uv venv && uv pip install -e .

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN adduser --disabled-password --gecos "" appuser
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src/ src/
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
USER appuser
CMD ["uvicorn", "album_detector.app:app", "--host", "0.0.0.0", "--port", "8000"]
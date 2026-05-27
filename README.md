# SmartBoard

## 1. Технологический стек

- Frontend: React 18, Vite, React Router
- Backend: FastAPI, Pydantic v2, SQLAlchemy 2, Alembic
- База данных: PostgreSQL

## 2. Структура проекта

```text
SmartBoard/
|-- backend/
|   |-- app/
|   |   |-- api/v1/endpoints/   # HTTP-эндпоинты
|   |   |-- schemas/            # Pydantic-схемы
|   |   |-- models/             # SQLAlchemy-модели
|   |   |-- repositories/       # Доступ к данным
|   |   |-- services/           # Бизнес-логика
|   |   |-- db/                 # Сессии и подключение к БД
|   |   `-- main.py             # Точка входа FastAPI
|   |-- tests/
|   `-- requirements.txt
|-- frontend/
|   |-- src/
|   |   |-- pages/
|   |   |-- components/
|   |   |-- shared/
|   |   `-- app/
|   `-- package.json
`-- README.md
```

## 3. Быстрый старт (локально)

### 3.1 Требования

- Python 3.11+
- Node.js 20+
- PostgreSQL 14+

### 3.2 Клонирование

```bash
git clone <repo-url>
cd SmartBoard
```

### 3.3 Запуск через Docker (рекомендуется)

```bash
cp .env.example .env
docker compose up --build
```

Если миграции падали раньше (например `relation "users" does not exist`), сбросьте том БД и поднимите заново:

```bash
docker compose down -v
docker compose up --build
```

Сервисы:

- Frontend: http://localhost:8080
- Backend API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

Чат работает через WebSocket: `ws://localhost:8080/api/v1/chat/conversations/{id}/messages` (проксируется nginx → backend).

### 3.4 Настройка backend (без Docker)

```bash
cd backend
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
```

Создайте `.env` в корне проекта (`SmartBoard/.env`) со значениями:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=your_password
DB_NAME=SmartBoard
```

Запуск API:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger будет доступен по адресу: `http://localhost:8000/docs`

### 3.4 Настройка frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend по умолчанию запускается на `http://localhost:5173`.

## 4. Важные замечания по окружению

- В проекте используется `API_BASE_URL = /api/v1` (`frontend/src/shared/api/client.ts`).
- Для локальной разработки обычно нужно настроить прокси в Vite или использовать абсолютный URL backend, когда появятся реальные запросы из frontend.
- Не коммитьте реальные секреты в `.env`. Для команды используйте шаблон `.env.example`.

### 5. Полезные команды

Backend:

```bash
cd backend
uvicorn app.main:app --reload
```

Линтер и форматтер (backend):

```bash
cd backend
pip install -r requirements-dev.txt
ruff check app
ruff check app --fix
black app
```

Пример логирования в коде (backend):

```python
import logging

logger = logging.getLogger("smartboard")
logger.info("User registered successfully")
logger.warning("Redis is unavailable")
```

Frontend:

```bash
cd frontend
npm run dev
npm run build
npm run preview
```

Git:

```bash
git status
git checkout -b feature/<name>
git add .
git commit -m "feat(scope): message"
git push -u origin feature/<name>
```

---

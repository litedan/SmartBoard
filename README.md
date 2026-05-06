<<<<<<< HEAD
# SmartBoard

SmartBoard - веб-приложение с разделением на `frontend` (React + Vite + TypeScript) и `backend` (FastAPI + SQLAlchemy + PostgreSQL).
=======
# SmartBoard 
## Backend
- FastAPI app: `backend/app/main.py`
- API modules: `backend/app/api/v1/endpoints`
- Layers: `schemas`, `models`, `repositories`, `services`
>>>>>>> daa98ad125a046fba65b332c7ee16d04c86329f9

Этот README предназначен для командной разработки: быстрый онбординг, единые правила работы и понятный процесс поставки изменений.

## 1. Технологический стек

- Frontend: React 18, TypeScript, Vite, React Router
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

### 3.3 Настройка backend

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

## 5. Командный workflow

### 5.1 Бранч-стратегия

- `main` - стабильная ветка
- `develop` - интеграционная ветка (если команда использует)
- feature-ветки: `feature/<short-name>`
- bugfix-ветки: `fix/<short-name>`
- hotfix-ветки: `hotfix/<short-name>`

Пример:

```bash
git checkout -b feature/auth-refresh-token
```

### 5.2 Правила коммитов

Рекомендуемый формат:

```text
type(scope): short description
```

Типы:

- `feat` - новая функциональность
- `fix` - исправление бага
- `refactor` - рефакторинг без изменения поведения
- `test` - тесты
- `docs` - документация
- `chore` - технические задачи

Примеры:

```text
feat(auth): add refresh token endpoint
fix(profile): handle missing avatar fallback
docs(readme): add team workflow section
```

### 6. Полезные команды

Backend:

```bash
cd backend
uvicorn app.main:app --reload
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
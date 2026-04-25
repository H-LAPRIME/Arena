# ⚽ eFootball Arena

Welcome to **eFootball Arena**, a complete, secure, and modern platform for managing private eFootball leagues and tournaments. Compete with your friends, claim match results, track your standings, and get AI-powered coaching advice!

![eFootball Arena Banner](https://via.placeholder.com/800x400.png?text=eFootball+Arena)

---

## ✨ Key Features

- **League Management:** Create private leagues, generate join codes, and invite friends. Now includes the ability to easily *quit* pending leagues.
- **Automated Standings:** Standings are automatically calculated based on points, goal difference, and head-to-head records.
- **Match Claim System:** Secure match result reporting. One player submits the score, and the other approves it to make it official.
- **AI Coach Intervention:** Integrated Mistral AI chatbot provides automated match advice, post-match analysis, and form reviews.
- **Live Global Chat:** Connect with other players globally in the integrated chat room.
- **Security First:** Built with robust rate-limiting (SlowAPI), safe error handling, Pydantic data validation, and secure CORS policies out of the box.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** [Next.js](https://nextjs.org/) (React)
- **Styling:** Custom Vanilla CSS for a stunning, high-performance UI
- **Icons:** Custom SVG components

### Backend
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database:** PostgreSQL with SQLAlchemy & Alembic (Migrations)
- **Authentication:** JWT (JSON Web Tokens) & bcrypt password hashing
- **Security:** SlowAPI (Rate Limiting), Pydantic (Validation)

---

## 🚀 Getting Started Locally

### 1. Database Setup
Make sure you have PostgreSQL installed.
Create a database named `efootball_arena`:
```sql
CREATE DATABASE efootball_arena;
```

### 2. Backend Setup
Navigate to the backend directory and set up your virtual environment:

```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # On Windows
pip install -r requirements.txt
```

**Environment Variables**
Create a `.env` file in the `backend/` directory:
```env
DATABASE_URL=postgresql://postgres:123@localhost:5432/efootball_arena
JWT_SECRET=your_super_secret_jwt_string_here
MISTRAL_API_KEY=your_mistral_api_key_here
CORS_ORIGINS=http://localhost:3000
UPLOAD_DIR=uploads
```

**Initialize the Database**
Run the Alembic migrations or the initialization script:
```bash
python init_db.py
```

**Start the Server**
```bash
python -m uvicorn app.main:app --reload
```
*The API will run on `http://localhost:8000`.*

### 3. Frontend Setup
Navigate to the frontend directory:

```bash
cd frontend
npm install
```

**Environment Variables**
Create a `.env.local` file in the `frontend/` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Start the Client**
```bash
npm run dev
```
*The app will run on `http://localhost:3000`.*

---

## 🔒 Security Information

This project implements modern API security best practices:
- **Rate Limiting:** Authentication endpoints are protected against brute force (5 requests/minute).
- **No Leaked Traces:** The global exception handler prevents internal backend traces from leaking to the client.
- **Environment Isolation:** Secrets are rigorously ignored from version control (`.gitignore` implemented).

---

## 🚀 Deployment Guide

To deploy this project to production:

1. **Database:** Provision a PostgreSQL instance (e.g., Supabase, Render, Railway).
2. **Backend:** Deploy the FastAPI backend on platforms like **Render**, **Railway**, or **Heroku**. 
   - Set the necessary environment variables (`DATABASE_URL`, `JWT_SECRET`, `MISTRAL_API_KEY`).
   - Ensure `CORS_ORIGINS` is set to your deployed frontend URL (e.g., `https://efootball-arena.vercel.app`).
3. **Frontend:** Deploy the Next.js frontend on **Vercel** or **Netlify**.
   - Set the `NEXT_PUBLIC_API_URL` to your newly deployed backend URL.

---

### Authors
- Developed for **H-LAPRIME** - eFootball Arena.

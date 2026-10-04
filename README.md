# 🤖 Mini AI Chatbot

A simple, modern, full-stack AI chatbot built with FastAPI, vanilla JavaScript, and Groq API, featuring complete user authentication and persistent chat management.

## 🚀 Features

- **AI Chatbot**: Fast, accurate responses powered by Groq API (`openai/gpt-oss-20b`).
- **User Authentication**: Secure signup, login, and session persistence with JWT tokens.
- **Password Security**: Strong password hashing using `bcrypt`.
- **User Data Isolation**: Robust server-side resource ownership checks ensuring users only access their own chats.
- **Chat History Management**: Database-backed persistent chat history with creation, retrieval, and deletion.
- **Modern UI**: Polished, minimal, dark-accented modal dialogs for Sign In, Sign Up, and Password Reset with inline validation, show/hide password toggles, and password strength indicators.
- **Forgot Password Foundation**: Hashed OTP code architecture in place for Phase 2 email integration.
- **Responsive Design**: Mobile-ready layout and interactive sidebar account area.

---

## 🛠️ Stack & Dependencies

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Backend**: Python 3.12, FastAPI, Uvicorn, SQLAlchemy, Pydantic V2
- **Database**: PostgreSQL (Production on Render) / SQLite (Local Development)
- **Security**: PyJWT, bcrypt, Email-Validator
- **AI Integration**: Groq SDK

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory or configure environment variables in your deployment settings:

```env
# Required for AI chat responses
GROQ_API_KEY=your_groq_api_key_here

# JWT Signing Secret Key
JWT_SECRET=your_secure_random_jwt_secret_here

# Database Connection (Optional: defaults to local sqlite:///./miniai.db if omitted)
DATABASE_URL=postgresql://user:password@hostname:5432/dbname
```

---

## 💻 Local Setup & Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/25A31A04G7/mini-ai-chatbot.git
   cd mini-ai-chatbot
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the FastAPI backend server**:
   ```bash
   uvicorn app:app --reload --port 8000
   ```

4. **Access the application**:
   Open `http://127.0.0.1:8000` in your web browser.

---

## 🧪 Testing

Run automated backend tests covering authentication, password security, data isolation, and chat endpoints:

```bash
python3 -m pytest test_app.py
```

---

## 🚀 Deployment on Render

1. Create a **Web Service** on [Render](https://render.com) pointing to this repository.
2. Select **Python** runtime and set:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
3. Attach a **Render PostgreSQL Database** and pass the `DATABASE_URL` environment variable to the Web Service.
4. Add `GROQ_API_KEY` and `JWT_SECRET` in the Environment section.

---

## 📋 Phase 1 Implementation Summary

- **Authentication Endpoints**: `POST /signup`, `POST /login`, `POST /logout`, `GET /me`.
- **Database Schema**:
  - `users`: `id`, `name`, `email` (indexed, unique), `password_hash`, `created_at`, `updated_at`.
  - `chats`: `id`, `user_id` (indexed, FK), `title`, `created_at`, `updated_at`.
  - `messages`: `id`, `chat_id` (indexed, FK), `role`, `content`, `created_at`.
  - `password_reset_codes`: `id`, `user_id` (FK), `code_hash`, `expires_at`, `used`, `created_at`.
- **UI Components**: Sign In & Sign Up Modals, Password Reset Flow, Sidebar User Profile Widget, Password Visibility Toggles, Inline Form Error State.
- **Data Isolation**: All chat CRUD operations verify `chat.user_id == current_user.id` on the server side.

---

## 🔮 Phase 2 Roadmap

- **Email OTP Delivery**: Connect `POST /forgot-password` to an active email service provider (e.g. Resend, SendGrid, or AWS SES) to dispatch reset codes to user inboxes.
- **Guest-to-User Migration**: Implement automatic migration of guest `localStorage` chat history to database upon account creation or login.

import os
import random
import string
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from groq import Groq

from database import engine, Base, get_db
import models
from auth import (
    hash_password,
    verify_password,
    hash_code,
    verify_code,
    create_access_token,
    get_current_user,
    get_optional_current_user,
)

load_dotenv()

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Mini AI Chatbot API")

# Allow our frontend to communicate with the backend
allowed_origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "https://mini-ai-chatbot-1.onrender.com",
    "https://mini-ai-chatbot-5l0w.onrender.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Groq client setup
groq_api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=groq_api_key) if groq_api_key else None


# =========================================================
# SCHEMAS (Pydantic Models)
# =========================================================

class UserSignup(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(..., min_length=6, max_length=128)

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    created_at: datetime

class AuthResponse(BaseModel):
    token: str
    user: UserResponse

class MessageSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    role: str
    content: str
    created_at: datetime

class ChatSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: Optional[List[MessageSchema]] = []

class ChatCreate(BaseModel):
    title: Optional[str] = "New conversation"

class ChatUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)

class ChatRequest(BaseModel):
    message: str
    chat_id: Optional[str] = None


# =========================================================
# AUTHENTICATION ENDPOINTS
# =========================================================

@app.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: UserSignup, db: Session = Depends(get_db)):
    normalized_email = user_data.email.lower().strip()

    existing_user = db.query(models.User).filter(models.User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is already registered"
        )

    hashed_pwd = hash_password(user_data.password)
    new_user = models.User(
        name=user_data.name.strip(),
        email=normalized_email,
        password_hash=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(new_user.id)

    return AuthResponse(
        token=token,
        user=UserResponse.model_validate(new_user)
    )

@app.post("/login", response_model=AuthResponse)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    normalized_email = user_data.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == normalized_email).first()

    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    token = create_access_token(user.id)

    return AuthResponse(
        token=token,
        user=UserResponse.model_validate(user)
    )

@app.post("/logout")
def logout():
    return {"message": "Logged out successfully"}

@app.get("/me", response_model=UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


# =========================================================
# FORGOT / RESET PASSWORD FOUNDATION
# =========================================================

@app.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    normalized_email = req.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == normalized_email).first()

    generic_msg = {"message": "If an account with that email exists, password reset instructions have been generated."}

    if not user:
        return generic_msg

    code = "".join(random.choices(string.digits, k=6))
    hashed = hash_code(code)
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)

    reset_entry = models.PasswordResetCode(
        user_id=user.id,
        code_hash=hashed,
        expires_at=expires
    )
    db.add(reset_entry)
    db.commit()

    return generic_msg

@app.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    normalized_email = req.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == normalized_email).first()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid request or expired code")

    reset_entry = db.query(models.PasswordResetCode)\
        .filter(models.PasswordResetCode.user_id == user.id, models.PasswordResetCode.used == False)\
        .order_by(models.PasswordResetCode.created_at.desc())\
        .first()

    if not reset_entry:
        raise HTTPException(status_code=400, detail="Invalid request or expired code")

    expires = reset_entry.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="Verification code has expired")

    if not verify_code(req.code.strip(), reset_entry.code_hash):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    reset_entry.used = True
    user.password_hash = hash_password(req.new_password)
    db.commit()

    return {"message": "Password reset successful"}


# =========================================================
# CHAT MANAGEMENT ENDPOINTS (PROTECTED & ISOLATED)
# =========================================================

@app.get("/chats", response_model=List[ChatSchema])
def list_chats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    chats = db.query(models.Chat)\
        .filter(models.Chat.user_id == current_user.id)\
        .order_by(models.Chat.updated_at.desc())\
        .all()
    return chats

@app.post("/chats", response_model=ChatSchema, status_code=status.HTTP_201_CREATED)
def create_chat(
    chat_data: ChatCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_chat = models.Chat(
        user_id=current_user.id,
        title=chat_data.title or "New conversation"
    )
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    return new_chat

@app.get("/chats/{chat_id}", response_model=ChatSchema)
def get_chat(
    chat_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this chat")

    return chat

@app.patch("/chats/{chat_id}", response_model=ChatSchema)
def update_chat(
    chat_id: str,
    update_data: ChatUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this chat")

    chat.title = update_data.title.strip()
    chat.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(chat)
    return chat

@app.delete("/chats/{chat_id}")
def delete_chat(
    chat_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this chat")

    db.delete(chat)
    db.commit()
    return {"message": "Chat deleted successfully"}


# =========================================================
# AI CHAT ENDPOINT (PRESERVED & EXPANDED)
# =========================================================

@app.post("/chat")
def chat(
    request: ChatRequest,
    current_user: Optional[models.User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    message_text = request.message.strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    chat_obj = None
    messages_history = []

    if current_user:
        if request.chat_id:
            chat_obj = db.query(models.Chat).filter(models.Chat.id == request.chat_id).first()
            if not chat_obj:
                raise HTTPException(status_code=404, detail="Chat not found")
            if chat_obj.user_id != current_user.id:
                raise HTTPException(status_code=403, detail="Forbidden: You do not own this chat")

        if not chat_obj:
            title = message_text[:35] + "..." if len(message_text) > 35 else message_text
            chat_obj = models.Chat(
                user_id=current_user.id,
                title=title or "New conversation"
            )
            db.add(chat_obj)
            db.commit()
            db.refresh(chat_obj)

        user_msg = models.Message(
            chat_id=chat_obj.id,
            role="user",
            content=message_text
        )
        db.add(user_msg)
        db.commit()

        db_messages = db.query(models.Message).filter(models.Message.chat_id == chat_obj.id).order_by(models.Message.created_at.asc()).all()
        for m in db_messages:
            messages_history.append({"role": m.role, "content": m.content})
    else:
        messages_history.append({"role": "user", "content": message_text})

    reply_content = "I couldn't process your request right now."
    if client:
        try:
            response = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=messages_history
            )
            reply_content = response.choices[0].message.content
        except Exception as e:
            reply_content = f"Error communicating with AI service: {str(e)}"
    else:
        reply_content = "Groq API key is not configured on the server."

    if current_user and chat_obj:
        ai_msg = models.Message(
            chat_id=chat_obj.id,
            role="assistant",
            content=reply_content
        )
        chat_obj.updated_at = datetime.now(timezone.utc)
        db.add(ai_msg)
        db.commit()

    res = {
        "reply": reply_content
    }
    if chat_obj:
        res["chat_id"] = chat_obj.id
        res["chat_title"] = chat_obj.title

    return res

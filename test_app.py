import pytest
from fastapi.testclient import TestClient
import os

# Set test environment variables BEFORE importing app
os.environ["DATABASE_URL"] = "sqlite:///./test_miniai.db"
os.environ["JWT_SECRET"] = "test-secret-key-for-unit-testing"

from app import app
from database import engine, Base, SessionLocal
import models

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_miniai.db"):
        os.remove("./test_miniai.db")

client = TestClient(app)

# =========================================================
# FRONTEND ROUTE TESTS
# =========================================================

def test_frontend_root_route():
    res = client.get("/")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "Mini AI" in res.text

def test_frontend_static_assets():
    res_css = client.get("/style.css")
    assert res_css.status_code == 200
    assert "text/css" in res_css.headers["content-type"] or "text/plain" in res_css.headers["content-type"]

    res_js = client.get("/script.js")
    assert res_js.status_code == 200

def test_protected_files_not_exposed():
    assert client.get("/app.py").status_code == 404
    assert client.get("/auth.py").status_code == 404
    assert client.get("/database.py").status_code == 404
    assert client.get("/models.py").status_code == 404
    assert client.get("/.env").status_code == 404
    assert client.get("/miniai.db").status_code == 404

# =========================================================
# AUTHENTICATION & USER TESTS
# =========================================================

def test_signup_valid():
    res = client.post("/signup", json={
        "name": "Alice Developer",
        "email": "alice@example.com",
        "password": "password123"
    })
    assert res.status_code == 201
    data = res.json()
    assert "token" in data
    assert data["user"]["email"] == "alice@example.com"
    assert data["user"]["name"] == "Alice Developer"
    assert "password_hash" not in data["user"]

def test_signup_duplicate_email():
    res = client.post("/signup", json={
        "name": "Alice Duplicate",
        "email": "alice@example.com",
        "password": "password123"
    })
    assert res.status_code == 400
    assert "already registered" in res.json()["detail"].lower()

def test_email_case_and_whitespace_normalization():
    res = client.post("/signup", json={
        "name": "Alice Normalization",
        "email": "  ALICE@EXAMPLE.COM  ",
        "password": "password123"
    })
    assert res.status_code == 400

    res_login = client.post("/login", json={
        "email": "  ALICE@EXAMPLE.COM  ",
        "password": "password123"
    })
    assert res_login.status_code == 200
    assert res_login.json()["user"]["email"] == "alice@example.com"

def test_signup_invalid_email():
    res = client.post("/signup", json={
        "name": "Invalid Email",
        "email": "not-an-email",
        "password": "password123"
    })
    assert res.status_code == 422

def test_login_success():
    res = client.post("/login", json={
        "email": "alice@example.com",
        "password": "password123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["user"]["email"] == "alice@example.com"

def test_login_invalid_password():
    res = client.post("/login", json={
        "email": "alice@example.com",
        "password": "wrongpassword"
    })
    assert res.status_code == 401

def test_get_me_logged_out():
    res = client.get("/me")
    assert res.status_code == 401

def test_get_me_logged_in():
    login_res = client.post("/login", json={
        "email": "alice@example.com",
        "password": "password123"
    })
    token = login_res.json()["token"]

    res = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "alice@example.com"

# =========================================================
# PASSWORD RESET TESTS
# =========================================================

def test_forgot_password_request_and_response_privacy():
    res = client.post("/forgot-password", json={"email": "alice@example.com"})
    assert res.status_code == 200
    data = res.json()
    assert "code" not in data
    assert "otp" not in data
    assert "message" in data

def test_forgot_password_unknown_email():
    res = client.post("/forgot-password", json={"email": "unknown@example.com"})
    assert res.status_code == 200
    assert "message" in res.json()

def test_password_reset_flow_and_reuse_prevention():
    client.post("/forgot-password", json={"email": "  ALICE@EXAMPLE.COM  "})

    db = SessionLocal()
    user = db.query(models.User).filter(models.User.email == "alice@example.com").first()
    reset_entry = db.query(models.PasswordResetCode).filter(models.PasswordResetCode.user_id == user.id, models.PasswordResetCode.used == False).order_by(models.PasswordResetCode.created_at.desc()).first()

    from auth import hash_code
    known_code = "123456"
    reset_entry.code_hash = hash_code(known_code)
    db.commit()
    db.close()

    res_bad = client.post("/reset-password", json={
        "email": "alice@example.com",
        "code": "000000",
        "new_password": "newpassword123"
    })
    assert res_bad.status_code == 400

    res_good = client.post("/reset-password", json={
        "email": "  ALICE@EXAMPLE.COM ",
        "code": "123456",
        "new_password": "newpassword123"
    })
    assert res_good.status_code == 200

    res_reuse = client.post("/reset-password", json={
        "email": "alice@example.com",
        "code": "123456",
        "new_password": "anotherpassword123"
    })
    assert res_reuse.status_code == 400

    res_old_login = client.post("/login", json={
        "email": "alice@example.com",
        "password": "password123"
    })
    assert res_old_login.status_code == 401

    res_new_login = client.post("/login", json={
        "email": "alice@example.com",
        "password": "newpassword123"
    })
    assert res_new_login.status_code == 200

def test_password_reset_expired_code():
    client.post("/forgot-password", json={"email": "alice@example.com"})

    db = SessionLocal()
    user = db.query(models.User).filter(models.User.email == "alice@example.com").first()
    reset_entry = db.query(models.PasswordResetCode).filter(models.PasswordResetCode.user_id == user.id, models.PasswordResetCode.used == False).order_by(models.PasswordResetCode.created_at.desc()).first()

    from auth import hash_code
    from datetime import datetime, timedelta, timezone
    reset_entry.code_hash = hash_code("654321")
    reset_entry.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db.commit()
    db.close()

    res_exp = client.post("/reset-password", json={
        "email": "alice@example.com",
        "code": "654321",
        "new_password": "brandnewpassword123"
    })
    assert res_exp.status_code == 400
    assert "expired" in res_exp.json()["detail"].lower()

# =========================================================
# AUTHORIZATION & ISOLATION TESTS
# =========================================================

def test_user_data_isolation():
    client.post("/signup", json={
        "name": "Bob Tester",
        "email": "bob@example.com",
        "password": "password123"
    })

    login_b = client.post("/login", json={"email": "bob@example.com", "password": "password123"})
    token_b = login_b.json()["token"]

    chat_res = client.post("/chats", json={"title": "Bob's Secret Chat"}, headers={"Authorization": f"Bearer {token_b}"})
    assert chat_res.status_code == 201
    bob_chat_id = chat_res.json()["id"]

    login_a = client.post("/login", json={"email": "alice@example.com", "password": "newpassword123"})
    token_a = login_a.json()["token"]

    alice_read_res = client.get(f"/chats/{bob_chat_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert alice_read_res.status_code == 403

    alice_delete_res = client.delete(f"/chats/{bob_chat_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert alice_delete_res.status_code == 403

def test_chat_crud_operations():
    login_res = client.post("/login", json={"email": "alice@example.com", "password": "newpassword123"})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    c_res = client.post("/chats", json={"title": "My Test Chat"}, headers=headers)
    assert c_res.status_code == 201
    chat_id = c_res.json()["id"]

    g_res = client.get(f"/chats/{chat_id}", headers=headers)
    assert g_res.status_code == 200
    assert g_res.json()["title"] == "My Test Chat"

    l_res = client.get("/chats", headers=headers)
    assert l_res.status_code == 200
    assert len(l_res.json()) >= 1

    u_res = client.patch(f"/chats/{chat_id}", json={"title": "Updated Title"}, headers=headers)
    assert u_res.status_code == 200
    assert u_res.json()["title"] == "Updated Title"

    d_res = client.delete(f"/chats/{chat_id}", headers=headers)
    assert d_res.status_code == 200

    g2_res = client.get(f"/chats/{chat_id}", headers=headers)
    assert g2_res.status_code == 404

def test_ai_chat_endpoint_guest():
    res = client.post("/chat", json={"message": "Hello AI"})
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data

def test_ai_chat_endpoint_authenticated():
    login_res = client.post("/login", json={"email": "alice@example.com", "password": "newpassword123"})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/chat", json={"message": "What is Python?"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data
    assert "chat_id" in data

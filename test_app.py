import pytest
from fastapi.testclient import TestClient
import os

# Set testing DB before importing app
os.environ["DATABASE_URL"] = "sqlite:///./test_miniai.db"

from app import app
from database import engine, Base

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_miniai.db"):
        os.remove("./test_miniai.db")

client = TestClient(app)

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

def test_signup_invalid_email():
    res = client.post("/signup", json={
        "name": "Invalid Email",
        "email": "not-an-email",
        "password": "password123"
    })
    assert res.status_code == 422  # Pydantic validation error

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

def test_user_data_isolation():
    # Create User B
    client.post("/signup", json={
        "name": "Bob Tester",
        "email": "bob@example.com",
        "password": "password123"
    })

    login_b = client.post("/login", json={"email": "bob@example.com", "password": "password123"})
    token_b = login_b.json()["token"]

    # Create chat for Bob
    chat_res = client.post("/chats", json={"title": "Bob's Secret Chat"}, headers={"Authorization": f"Bearer {token_b}"})
    assert chat_res.status_code == 201
    bob_chat_id = chat_res.json()["id"]

    # Login as Alice
    login_a = client.post("/login", json={"email": "alice@example.com", "password": "password123"})
    token_a = login_a.json()["token"]

    # Alice tries to read Bob's chat
    alice_read_res = client.get(f"/chats/{bob_chat_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert alice_read_res.status_code == 403

    # Alice tries to delete Bob's chat
    alice_delete_res = client.delete(f"/chats/{bob_chat_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert alice_delete_res.status_code == 403

def test_chat_crud_operations():
    login_res = client.post("/login", json={"email": "alice@example.com", "password": "password123"})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Chat
    c_res = client.post("/chats", json={"title": "My Test Chat"}, headers=headers)
    assert c_res.status_code == 201
    chat_id = c_res.json()["id"]

    # Get Chat
    g_res = client.get(f"/chats/{chat_id}", headers=headers)
    assert g_res.status_code == 200
    assert g_res.json()["title"] == "My Test Chat"

    # List Chats
    l_res = client.get("/chats", headers=headers)
    assert l_res.status_code == 200
    assert len(l_res.json()) >= 1

    # Update Chat
    u_res = client.patch(f"/chats/{chat_id}", json={"title": "Updated Title"}, headers=headers)
    assert u_res.status_code == 200
    assert u_res.json()["title"] == "Updated Title"

    # Delete Chat
    d_res = client.delete(f"/chats/{chat_id}", headers=headers)
    assert d_res.status_code == 200

    # Verify deleted
    g2_res = client.get(f"/chats/{chat_id}", headers=headers)
    assert g2_res.status_code == 404

def test_ai_chat_endpoint_guest():
    res = client.post("/chat", json={"message": "Hello AI"})
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data

def test_ai_chat_endpoint_authenticated():
    login_res = client.post("/login", json={"email": "alice@example.com", "password": "password123"})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post("/chat", json={"message": "What is Python?"}, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "reply" in data
    assert "chat_id" in data

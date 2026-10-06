// =========================================================
// MINI AI CHATBOT — FRONTEND LOGIC & AUTHENTICATION
// =========================================================

// Determine backend URL dynamically or use default
const API_BASE_URL =
    window.location.origin.includes("localhost") ||
    window.location.origin.includes("127.0.0.1")
        ? window.location.origin
        : "https://mini-ai-chatbot-backend.onrender.com";

const CHAT_API_URL = `${API_BASE_URL}/chat`;
const AUTH_API_URL = API_BASE_URL;
// =========================================================
// DOM ELEMENTS
// =========================================================

const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const sendButton = document.getElementById("send-button");
const newChatButton = document.getElementById("new-chat");
const chatHistory = document.getElementById("chat-history");
const menuButton = document.getElementById("menu-btn");
const sidebar = document.getElementById("sidebar");
const closeSidebar = document.getElementById("close-sidebar");

// User Account DOM Elements
const guestAccountBox = document.getElementById("guest-account-box");
const userProfileBox = document.getElementById("user-profile-box");
const userAvatarInitials = document.getElementById("user-avatar-initials");
const userDisplayName = document.getElementById("user-display-name");
const userDisplayEmail = document.getElementById("user-display-email");
const logoutBtn = document.getElementById("logout-btn");
const mobileLoginBtn = document.getElementById("mobile-login-btn");

// Modals DOM Elements
const loginModal = document.getElementById("login-modal");
const signupModal = document.getElementById("signup-modal");
const forgotModal = document.getElementById("forgot-modal");

// Triggers & Close buttons
const openLoginBtn = document.getElementById("open-login-btn");
const openSignupBtn = document.getElementById("open-signup-btn");
const closeLoginModal = document.getElementById("close-login-modal");
const closeSignupModal = document.getElementById("close-signup-modal");
const closeForgotModal = document.getElementById("close-forgot-modal");

const gotoSignupBtn = document.getElementById("goto-signup-btn");
const gotoLoginBtn = document.getElementById("goto-login-btn");
const gotoForgotBtn = document.getElementById("goto-forgot-btn");
const forgotGotoLoginBtn = document.getElementById("forgot-goto-login-btn");

// Auth Forms
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const forgotRequestForm = document.getElementById("forgot-request-form");
const forgotResetForm = document.getElementById("forgot-reset-form");


// =========================================================
// APPLICATION STATE
// =========================================================

let currentUser = null;
let authToken = localStorage.getItem("miniAIAuthToken") || null;

// Guest localStorage fallback conversations
let localConversations = JSON.parse(localStorage.getItem("miniAIChats")) || [];
let currentConversationId = null;


// =========================================================
// INITIALIZATION
// =========================================================

async function initializeApp() {
    setupEventListeners();
    setupPasswordToggles();

    if (authToken) {
        await fetchCurrentUser();
    } else {
        renderAccountState();
        renderChatHistory();
        showWelcomeScreen();
    }
}


// =========================================================
// AUTHENTICATION STATE & API
// =========================================================

function getAuthHeaders() {
    const headers = {
        "Content-Type": "application/json"
    };
    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }
    return headers;
}

async function fetchCurrentUser() {
    try {
        const response = await fetch(`${AUTH_API_URL}/me`, {
            method: "GET",
            headers: getAuthHeaders()
        });

        if (response.ok) {
            currentUser = await response.json();
            renderAccountState();
            await loadBackendChats();
        } else {
            // Token invalid or expired
            handleLogout();
        }
    } catch (error) {
        console.error("Auth check failed:", error);
        renderAccountState();
        renderChatHistory();
        showWelcomeScreen();
    }
}

function handleAuthSuccess(token, user) {
    authToken = token;
    currentUser = user;
    localStorage.setItem("miniAIAuthToken", token);

    closeAllModals();
    renderAccountState();
    loadBackendChats();
}

function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem("miniAIAuthToken");

    currentConversationId = null;
    renderAccountState();
    renderChatHistory();
    showWelcomeScreen();
}

function renderAccountState() {
    if (currentUser) {
        guestAccountBox.classList.add("hidden");
        userProfileBox.classList.remove("hidden");

        const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U";
        userAvatarInitials.textContent = initial;
        userDisplayName.textContent = currentUser.name;
        userDisplayEmail.textContent = currentUser.email;

        if (mobileLoginBtn) mobileLoginBtn.classList.add("hidden");
    } else {
        guestAccountBox.classList.remove("hidden");
        userProfileBox.classList.add("hidden");

        if (mobileLoginBtn) mobileLoginBtn.classList.remove("hidden");
    }
}


// =========================================================
// CHAT DATA & BACKEND SYNC
// =========================================================

async function loadBackendChats() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${AUTH_API_URL}/chats`, {
            method: "GET",
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const chats = await response.json();
           localConversations = chats;
renderChatHistory();
        }
    } catch (error) {
        console.error("Failed to load backend chats:", error);
    }
}

function renderChatHistory() {
    chatHistory.innerHTML = "";

    if (localConversations.length === 0) {
        const empty = document.createElement("div");
        empty.className = "history-item";
        empty.innerHTML = `
            <span>💬</span>
            <span class="history-text">No conversations yet</span>
        `;
        chatHistory.appendChild(empty);
        return;
    }

    localConversations.forEach(conversation => {
        const item = document.createElement("div");
        item.className = "history-item";

        if (conversation.id === currentConversationId) {
            item.classList.add("active");
        }

        item.innerHTML = `
            <span>💬</span>
            <span class="history-text" title="${escapeHTML(conversation.title)}">
                ${escapeHTML(conversation.title)}
            </span>
            <button class="delete-chat-btn" title="Delete chat">✕</button>
        `;

        item.addEventListener("click", (e) => {
            if (e.target.classList.contains("delete-chat-btn")) {
                e.stopPropagation();
                deleteChat(conversation.id);
            } else {
                openConversation(conversation.id);
            }
        });

        chatHistory.appendChild(item);
    });
}

async function openConversation(id) {
    currentConversationId = id;

    if (currentUser) {
        try {
            const response = await fetch(`${AUTH_API_URL}/chats/${id}`, {
                method: "GET",
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const chatData = await response.json();
                chatBox.innerHTML = "";

                if (chatData.messages && chatData.messages.length > 0) {
                    chatData.messages.forEach(msg => {
                        if (msg.role === "user") {
                            addUserMessageToScreen(msg.content);
                        } else {
                            addAIMessageToScreen(msg.content);
                        }
                    });
                } else {
                    showWelcomeScreen();
                }
            }
        } catch (error) {
            console.error("Failed to fetch chat details:", error);
        }
    } else {
        const conv = localConversations.find(c => c.id === id);
        if (!conv) return;

        chatBox.innerHTML = "";
        conv.messages.forEach(msg => {
            if (msg.role === "user") {
                addUserMessageToScreen(msg.content);
            } else {
                addAIMessageToScreen(msg.content);
            }
        });
    }

    renderChatHistory();
    scrollToBottom();
    sidebar.classList.remove("open");
}

async function deleteChat(id) {
    if (currentUser) {
        try {
            const response = await fetch(`${AUTH_API_URL}/chats/${id}`, {
                method: "DELETE",
                headers: getAuthHeaders()
            });

            if (response.ok) {
                localConversations = localConversations.filter(c => c.id !== id);
                if (currentConversationId === id) {
                    startNewChat();
                } else {
                    renderChatHistory();
                }
            }
        } catch (error) {
            console.error("Failed to delete chat:", error);
        }
    } else {
        localConversations = localConversations.filter(c => c.id !== id);
        localStorage.setItem("miniAIChats", JSON.stringify(localConversations));
        if (currentConversationId === id) {
            startNewChat();
        } else {
            renderChatHistory();
        }
    }
}

function startNewChat() {
    currentConversationId = null;
    showWelcomeScreen();
    renderChatHistory();

    input.value = "";
    input.style.height = "auto";
    sendButton.disabled = true;

    sidebar.classList.remove("open");
    input.focus();
}


// =========================================================
// CHAT RENDERING & SENDING
// =========================================================

function addUserMessageToScreen(message) {
    const row = document.createElement("div");
    row.className = "message-row user-row";

    const bubble = document.createElement("div");
    bubble.className = "message user-message";
    bubble.textContent = message;

    row.appendChild(bubble);
    chatBox.appendChild(row);
}

function addAIMessageToScreen(message) {
    const row = document.createElement("div");
    row.className = "message-row ai-row";

    const avatar = document.createElement("div");
    avatar.className = "small-avatar";
    avatar.textContent = "✦";

    const bubble = document.createElement("div");
    bubble.className = "message ai-message";
    bubble.textContent = message;

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatBox.appendChild(row);
}

function addThinkingMessage() {
    const row = document.createElement("div");
    row.className = "message-row ai-row";

    const avatar = document.createElement("div");
    avatar.className = "small-avatar";
    avatar.textContent = "✦";

    const message = document.createElement("div");
    message.className = "message ai-message";

    const thinking = document.createElement("div");
    thinking.className = "thinking";

    for (let i = 0; i < 3; i++) {
        const dot = document.createElement("span");
        thinking.appendChild(dot);
    }

    message.appendChild(thinking);
    row.appendChild(avatar);
    row.appendChild(message);

    chatBox.appendChild(row);
    scrollToBottom();

    return { row, message };
}

async function sendMessage(customMessage = null) {
    const messageText = customMessage !== null ? customMessage.trim() : input.value.trim();
    if (messageText === "") return;

    // Hide welcome screen
    const welcome = document.getElementById("welcome");
    if (welcome) welcome.remove();

    // Show user message
    addUserMessageToScreen(messageText);

    // Clear input
    input.value = "";
    input.style.height = "auto";
    sendButton.disabled = true;

    // Show thinking indicator
    const thinking = addThinkingMessage();

    try {
        const payload = {
            message: messageText,
            chat_id: currentConversationId
        };

        const response = await fetch(CHAT_API_URL, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        const reply = data.reply || "I couldn't generate a response.";

        thinking.message.textContent = reply;

        if (currentUser && data.chat_id) {
            currentConversationId = data.chat_id;
            await loadBackendChats();
        } else if (!currentUser) {
            // Local guest storage
            let conv = localConversations.find(c => c.id === currentConversationId);
            if (!conv) {
                conv = {
                    id: Date.now().toString(),
                    title: messageText.length > 35 ? messageText.substring(0, 35) + "..." : messageText,
                    messages: []
                };
                localConversations.push(conv);
                currentConversationId = conv.id;
            }
            conv.messages.push({ role: "user", content: messageText });
            conv.messages.push({ role: "assistant", content: reply });
            localStorage.setItem("miniAIChats", JSON.stringify(localConversations));
            renderChatHistory();
        }
    } catch (error) {
        console.error(error);
        thinking.message.textContent = "Sorry, I couldn't connect to the AI server. Please try again.";
    }

    sendButton.disabled = input.value.trim() === "";
    scrollToBottom();
}

function showWelcomeScreen() {
    chatBox.innerHTML = "";

    const welcome = document.createElement("div");
    welcome.className = "welcome";
    welcome.id = "welcome";

    welcome.innerHTML = `
        <div class="welcome-logo"><span>✦</span></div>
        <h1>How can I help you?</h1>
        <p>Ask questions, learn something new, or just start a conversation.</p>
        <div class="suggestions">
            <button class="suggestion" data-message="Explain artificial intelligence in simple words">
                <span>💡</span>
                <div>
                    <strong>Learn something</strong>
                    <small>Explain a concept simply</small>
                </div>
            </button>
            <button class="suggestion" data-message="Help me create a study plan">
                <span>📚</span>
                <div>
                    <strong>Study help</strong>
                    <small>Create a useful study plan</small>
                </div>
            </button>
            <button class="suggestion" data-message="Give me some creative ideas">
                <span>✨</span>
                <div>
                    <strong>Get creative</strong>
                    <small>Explore new ideas</small>
                </div>
            </button>
            <button class="suggestion" data-message="Tell me an interesting fact">
                <span>🌎</span>
                <div>
                    <strong>Something interesting</strong>
                    <small>Discover something new</small>
                </div>
            </button>
        </div>
    `;

    chatBox.appendChild(welcome);

    welcome.querySelectorAll(".suggestion").forEach(button => {
        button.addEventListener("click", () => {
            sendMessage(button.dataset.message);
        });
    });
}


// =========================================================
// MODAL CONTROLS & FORM HANDLERS
// =========================================================

function openModal(modal) {
    closeAllModals();
    modal.classList.remove("hidden");
}

function closeAllModals() {
    [loginModal, signupModal, forgotModal].forEach(m => m.classList.add("hidden"));
    clearAuthForms();
}

function clearAuthForms() {
    document.querySelectorAll(".auth-message").forEach(el => {
        el.classList.add("hidden");
        el.textContent = "";
    });
    document.querySelectorAll(".field-error").forEach(el => el.textContent = "");
    document.querySelectorAll("form").forEach(f => f.reset());

    const strengthBar = document.getElementById("strength-bar");
    const strengthMeter = document.getElementById("strength-meter");
    const strengthText = document.getElementById("strength-text");
    if (strengthBar) strengthBar.style.width = "0%";
    if (strengthMeter) strengthMeter.classList.add("hidden");
    if (strengthText) strengthText.textContent = "";

    forgotRequestForm.classList.remove("hidden");
    forgotResetForm.classList.add("hidden");
}

function setFormLoading(button, isLoading) {
    const btnText = button.querySelector(".btn-text");
    const spinner = button.querySelector(".spinner");

    if (isLoading) {
        button.disabled = true;
        if (btnText) btnText.classList.add("hidden");
        if (spinner) spinner.classList.remove("hidden");
    } else {
        button.disabled = false;
        if (btnText) btnText.classList.remove("hidden");
        if (spinner) spinner.classList.add("hidden");
    }
}

function showFormMessage(messageEl, type, text) {
    messageEl.className = `auth-message ${type}`;
    messageEl.textContent = text;
    messageEl.classList.remove("hidden");
}

function setupPasswordToggles() {
    document.querySelectorAll(".toggle-password").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.dataset.target;
            const targetInput = document.getElementById(targetId);
            if (targetInput) {
                if (targetInput.type === "password") {
                    targetInput.type = "text";
                    btn.textContent = "🙈";
                } else {
                    targetInput.type = "password";
                    btn.textContent = "👁";
                }
            }
        });
    });
}

// Password strength indicator logic
const signupPasswordInput = document.getElementById("signup-password");
if (signupPasswordInput) {
    signupPasswordInput.addEventListener("input", () => {
        const val = signupPasswordInput.value;
        const meter = document.getElementById("strength-meter");
        const bar = document.getElementById("strength-bar");
        const text = document.getElementById("strength-text");

        if (!val) {
            meter.classList.add("hidden");
            text.textContent = "";
            return;
        }

        meter.classList.remove("hidden");
        let score = 0;
        if (val.length >= 6) score++;
        if (val.length >= 10) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        if (score <= 2) {
            bar.style.width = "33%";
            bar.style.backgroundColor = "#ef4444";
            text.textContent = "Weak password";
        } else if (score <= 4) {
            bar.style.width = "66%";
            bar.style.backgroundColor = "#f59e0b";
            text.textContent = "Medium strength password";
        } else {
            bar.style.width = "100%";
            bar.style.backgroundColor = "#10b981";
            text.textContent = "Strong password";
        }
    });
}


// =========================================================
// EVENT LISTENERS
// =========================================================

function setupEventListeners() {

    // Input handlers
    input.addEventListener("input", () => {
        sendButton.disabled = input.value.trim() === "";
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 140) + "px";
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!sendButton.disabled) sendMessage();
        }
    });

    sendButton.addEventListener("click", () => {
        if (!sendButton.disabled) sendMessage();
    });

    newChatButton.addEventListener("click", startNewChat);

    // Sidebar & Mobile Controls
    menuButton.addEventListener("click", () => sidebar.classList.add("open"));
    closeSidebar.addEventListener("click", () => sidebar.classList.remove("open"));

    // Modal Trigger Buttons
    openLoginBtn.addEventListener("click", () => openModal(loginModal));
    openSignupBtn.addEventListener("click", () => openModal(signupModal));
    if (mobileLoginBtn) mobileLoginBtn.addEventListener("click", () => openModal(loginModal));

    closeLoginModal.addEventListener("click", closeAllModals);
    closeSignupModal.addEventListener("click", closeAllModals);
    closeForgotModal.addEventListener("click", closeAllModals);

    gotoSignupBtn.addEventListener("click", (e) => { e.preventDefault(); openModal(signupModal); });
    gotoLoginBtn.addEventListener("click", (e) => { e.preventDefault(); openModal(loginModal); });
    gotoForgotBtn.addEventListener("click", (e) => { e.preventDefault(); openModal(forgotModal); });
    forgotGotoLoginBtn.addEventListener("click", (e) => { e.preventDefault(); openModal(loginModal); });

    logoutBtn.addEventListener("click", handleLogout);

    // Login Form Submit
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        const msgEl = document.getElementById("login-message");
        const submitBtn = document.getElementById("login-submit-btn");

        msgEl.classList.add("hidden");
        document.getElementById("login-email-error").textContent = "";
        document.getElementById("login-password-error").textContent = "";

        if (!email) {
            document.getElementById("login-email-error").textContent = "Email is required";
            return;
        }
        if (!password) {
            document.getElementById("login-password-error").textContent = "Password is required";
            return;
        }

        setFormLoading(submitBtn, true);

        try {
            const response = await fetch(`${AUTH_API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                handleAuthSuccess(data.token, data.user);
            } else {
                showFormMessage(msgEl, "error", data.detail || "Invalid login credentials");
            }
        } catch (err) {
            showFormMessage(msgEl, "error", "Network error. Please try again.");
        } finally {
            setFormLoading(submitBtn, false);
        }
    });

    // Signup Form Submit
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("signup-name").value.trim();
        const email = document.getElementById("signup-email").value.trim();
        const password = document.getElementById("signup-password").value;
        const confirmPassword = document.getElementById("signup-confirm-password").value;
        const msgEl = document.getElementById("signup-message");
        const submitBtn = document.getElementById("signup-submit-btn");

        msgEl.classList.add("hidden");
        document.getElementById("signup-name-error").textContent = "";
        document.getElementById("signup-email-error").textContent = "";
        document.getElementById("signup-password-error").textContent = "";
        document.getElementById("signup-confirm-error").textContent = "";

        let isValid = true;
        if (!name) {
            document.getElementById("signup-name-error").textContent = "Full name is required";
            isValid = false;
        }
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            document.getElementById("signup-email-error").textContent = "Valid email is required";
            isValid = false;
        }
        if (!password || password.length < 6) {
            document.getElementById("signup-password-error").textContent = "Password must be at least 6 characters";
            isValid = false;
        }
        if (password !== confirmPassword) {
            document.getElementById("signup-confirm-error").textContent = "Passwords do not match";
            isValid = false;
        }

        if (!isValid) return;

        setFormLoading(submitBtn, true);

        try {
            const response = await fetch(`${AUTH_API_URL}/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                handleAuthSuccess(data.token, data.user);
            } else {
                showFormMessage(msgEl, "error", data.detail || "Signup failed. Please try again.");
            }
        } catch (err) {
            showFormMessage(msgEl, "error", "Network error. Please try again.");
        } finally {
            setFormLoading(submitBtn, false);
        }
    });

    // Forgot Password Request Form
    forgotRequestForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("forgot-email").value.trim();
        const msgEl = document.getElementById("forgot-message");
        const submitBtn = document.getElementById("forgot-submit-btn");

        msgEl.classList.add("hidden");
        document.getElementById("forgot-email-error").textContent = "";

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            document.getElementById("forgot-email-error").textContent = "Valid email is required";
            return;
        }

        setFormLoading(submitBtn, true);

        try {
            const response = await fetch(`${AUTH_API_URL}/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                showFormMessage(msgEl, "success", data.message || "Reset request received.");
                forgotRequestForm.classList.add("hidden");
                forgotResetForm.classList.remove("hidden");
            } else {
                showFormMessage(msgEl, "error", data.detail || "Request failed.");
            }
        } catch (err) {
            showFormMessage(msgEl, "error", "Network error. Please try again.");
        } finally {
            setFormLoading(submitBtn, false);
        }
    });

    // Forgot Password Reset Form
    forgotResetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("forgot-email").value.trim();
        const code = document.getElementById("forgot-code").value.trim();
        const newPassword = document.getElementById("forgot-new-password").value;
        const msgEl = document.getElementById("forgot-message");
        const submitBtn = document.getElementById("reset-submit-btn");

        msgEl.classList.add("hidden");
        document.getElementById("forgot-code-error").textContent = "";
        document.getElementById("forgot-new-password-error").textContent = "";

        let isValid = true;
        if (!code) {
            document.getElementById("forgot-code-error").textContent = "Verification code is required";
            isValid = false;
        }
        if (!newPassword || newPassword.length < 6) {
            document.getElementById("forgot-new-password-error").textContent = "Password must be at least 6 characters";
            isValid = false;
        }

        if (!isValid) return;

        setFormLoading(submitBtn, true);

        try {
            const response = await fetch(`${AUTH_API_URL}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code, new_password: newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                showFormMessage(msgEl, "success", "Password reset successful! You can now sign in.");
                setTimeout(() => openModal(loginModal), 1500);
            } else {
                showFormMessage(msgEl, "error", data.detail || "Password reset failed.");
            }
        } catch (err) {
            showFormMessage(msgEl, "error", "Network error. Please try again.");
        } finally {
            setFormLoading(submitBtn, false);
        }
    });

    // Close modal when clicking outside modal card
    window.addEventListener("click", (e) => {
        if (e.target.classList.contains("modal-overlay")) {
            closeAllModals();
        }
    });
}


// =========================================================
// UTILITIES
// =========================================================

function scrollToBottom() {
    setTimeout(() => {
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 50);
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}


// Start application
initializeApp();

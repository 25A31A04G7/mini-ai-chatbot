// =========================================================
// MINI AI CHATBOT
// =========================================================

// Your deployed FastAPI backend
const API_URL =
    "https://mini-ai-chatbot-5l0w.onrender.com/chat";


// =========================================================
// ELEMENTS
// =========================================================

const input =
    document.getElementById("user-input");

const chatBox =
    document.getElementById("chat-box");

const sendButton =
    document.getElementById("send-button");

const newChatButton =
    document.getElementById("new-chat");

const clearButton =
    document.getElementById("clear-button");

const chatHistory =
    document.getElementById("chat-history");

const menuButton =
    document.getElementById("menu-btn");

const sidebar =
    document.getElementById("sidebar");

const closeSidebar =
    document.getElementById("close-sidebar");


// =========================================================
// CHAT DATA
// =========================================================

// Load saved conversations
let conversations =
    JSON.parse(
        localStorage.getItem("miniAIChats")
    ) || [];


// Currently opened conversation
let currentConversationId = null;


// =========================================================
// SAVE CONVERSATIONS
// =========================================================

function saveConversations() {

    localStorage.setItem(
        "miniAIChats",
        JSON.stringify(conversations)
    );

}


// =========================================================
// CREATE UNIQUE ID
// =========================================================

function createId() {

    return Date.now().toString() +
        Math.random()
            .toString(36)
            .substring(2, 8);

}


// =========================================================
// INITIALIZE APP
// =========================================================

function initializeApp() {

    renderChatHistory();

    showWelcomeScreen();

}


// =========================================================
// CHAT HISTORY
// =========================================================

function renderChatHistory() {

    chatHistory.innerHTML = "";


    if (conversations.length === 0) {

        const empty =
            document.createElement("div");

        empty.className = "history-item";

        empty.innerHTML = `
            <span>💬</span>
            <span class="history-text">
                No conversations yet
            </span>
        `;

        chatHistory.appendChild(empty);

        return;
    }


    // Newest conversations first
    const sorted =
        [...conversations].reverse();


    sorted.forEach(conversation => {

        const item =
            document.createElement("div");

        item.className =
            "history-item";


        if (
            conversation.id ===
            currentConversationId
        ) {

            item.classList.add("active");

        }


        item.innerHTML = `
            <span>💬</span>

            <span class="history-text">
                ${escapeHTML(conversation.title)}
            </span>
        `;


        item.addEventListener(
            "click",
            () => {

                openConversation(
                    conversation.id
                );

            }
        );


        chatHistory.appendChild(item);

    });

}


// =========================================================
// CREATE NEW CONVERSATION
// =========================================================

function createConversation(firstMessage) {

    const conversation = {

        id: createId(),

        title: createTitle(
            firstMessage
        ),

        messages: [],

        createdAt: new Date().toISOString(),

        updatedAt: new Date().toISOString()

    };


    conversations.push(
        conversation
    );


    currentConversationId =
        conversation.id;


    saveConversations();

    renderChatHistory();


    return conversation;

}


// =========================================================
// CREATE CHAT TITLE
// =========================================================

function createTitle(message) {

    let title =
        message
            .replace(/\s+/g, " ")
            .trim();


    if (title.length > 35) {

        title =
            title.substring(0, 35)
            .trim() + "...";

    }


    return title || "New conversation";

}


// =========================================================
// GET CURRENT CONVERSATION
// =========================================================

function getCurrentConversation() {

    return conversations.find(
        conversation =>
            conversation.id ===
            currentConversationId
    );

}


// =========================================================
// OPEN OLD CONVERSATION
// =========================================================

function openConversation(id) {

    const conversation =
        conversations.find(
            item => item.id === id
        );


    if (!conversation) {
        return;
    }


    currentConversationId =
        conversation.id;


    chatBox.innerHTML = "";


    conversation.messages.forEach(
        message => {

            if (message.role === "user") {

                addUserMessageToScreen(
                    message.content
                );

            }

            else if (
                message.role === "assistant"
            ) {

                addAIMessageToScreen(
                    message.content
                );

            }

        }
    );


    renderChatHistory();

    scrollToBottom();


    // Close mobile sidebar
    sidebar.classList.remove("open");

}


// =========================================================
// ADD USER MESSAGE TO SCREEN
// =========================================================

function addUserMessageToScreen(
    message
) {

    const row =
        document.createElement("div");

    row.className =
        "message-row user-row";


    const bubble =
        document.createElement("div");

    bubble.className =
        "message user-message";

    bubble.textContent =
        message;


    row.appendChild(
        bubble
    );


    chatBox.appendChild(
        row
    );

}


// =========================================================
// ADD AI MESSAGE TO SCREEN
// =========================================================

function addAIMessageToScreen(
    message
) {

    const row =
        document.createElement("div");

    row.className =
        "message-row ai-row";


    const avatar =
        document.createElement("div");

    avatar.className =
        "small-avatar";

    avatar.textContent =
        "✦";


    const bubble =
        document.createElement("div");

    bubble.className =
        "message ai-message";

    bubble.textContent =
        message;


    row.appendChild(
        avatar
    );

    row.appendChild(
        bubble
    );


    chatBox.appendChild(
        row
    );

}


// =========================================================
// SEND MESSAGE
// =========================================================

async function sendMessage(
    customMessage = null
) {

    const message =
        customMessage !== null
            ? customMessage.trim()
            : input.value.trim();


    if (message === "") {
        return;
    }


    // -----------------------------------------------------
    // Create conversation if this is a new chat
    // -----------------------------------------------------

    let conversation =
        getCurrentConversation();


    if (!conversation) {

        conversation =
            createConversation(
                message
            );

    }


    // -----------------------------------------------------
    // Hide welcome screen
    // -----------------------------------------------------

    const welcome =
        document.getElementById(
            "welcome"
        );


    if (welcome) {

        welcome.remove();

    }


    // -----------------------------------------------------
    // Save user message
    // -----------------------------------------------------

    conversation.messages.push({

        role: "user",

        content: message

    });


    conversation.updatedAt =
        new Date().toISOString();


    saveConversations();


    // -----------------------------------------------------
    // Show user message
    // -----------------------------------------------------

    addUserMessageToScreen(
        message
    );


    // -----------------------------------------------------
    // Clear input
    // -----------------------------------------------------

    input.value = "";

    input.style.height = "auto";

    sendButton.disabled = true;


    // -----------------------------------------------------
    // Show AI thinking
    // -----------------------------------------------------

    const thinking =
        addThinkingMessage();


    try {

        const response =
            await fetch(
                API_URL,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            message:
                                message

                        })

                }
            );


        if (!response.ok) {

            throw new Error(
                "Server error: " +
                response.status
            );

        }


        const data =
            await response.json();


        const reply =
            data.reply ||
            "I couldn't generate a response.";


        // -------------------------------------------------
        // Replace thinking animation
        // -------------------------------------------------

        thinking.message.textContent =
            reply;


        // -------------------------------------------------
        // Save AI response
        // -------------------------------------------------

        conversation.messages.push({

            role: "assistant",

            content: reply

        });


        conversation.updatedAt =
            new Date().toISOString();


        saveConversations();

        renderChatHistory();


    }

    catch (error) {

        console.error(error);


        thinking.message.textContent =
            "Sorry, I couldn't connect to the AI server. Please try again.";

    }


    // Re-enable send button when user types
    sendButton.disabled =
        input.value.trim() === "";


    scrollToBottom();

}


// =========================================================
// THINKING ANIMATION
// =========================================================

function addThinkingMessage() {

    const row =
        document.createElement("div");

    row.className =
        "message-row ai-row";


    const avatar =
        document.createElement("div");

    avatar.className =
        "small-avatar";

    avatar.textContent =
        "✦";


    const message =
        document.createElement("div");

    message.className =
        "message ai-message";


    const thinking =
        document.createElement("div");

    thinking.className =
        "thinking";


    for (
        let i = 0;
        i < 3;
        i++
    ) {

        const dot =
            document.createElement(
                "span"
            );

        thinking.appendChild(
            dot
        );

    }


    message.appendChild(
        thinking
    );


    row.appendChild(
        avatar
    );

    row.appendChild(
        message
    );


    chatBox.appendChild(
        row
    );


    scrollToBottom();


    return {

        row: row,

        message: message

    };

}


// =========================================================
// NEW CHAT
// =========================================================

function startNewChat() {

    currentConversationId =
        null;


    showWelcomeScreen();


    renderChatHistory();


    input.value = "";

    input.style.height = "auto";

    sendButton.disabled = true;


    sidebar.classList.remove(
        "open"
    );


    input.focus();

}


// =========================================================
// SHOW WELCOME SCREEN
// =========================================================

function showWelcomeScreen() {

    chatBox.innerHTML = "";


    const welcome =
        document.createElement("div");

    welcome.className =
        "welcome";

    welcome.id =
        "welcome";


    welcome.innerHTML = `

        <div class="welcome-logo">
            <span>✦</span>
        </div>

        <h1>
            How can I help you?
        </h1>

        <p>
            Ask questions, learn something new,
            or just start a conversation.
        </p>

        <div class="suggestions">

            <button
                class="suggestion"
                data-message="Explain artificial intelligence in simple words"
            >

                <span>💡</span>

                <div>

                    <strong>
                        Learn something
                    </strong>

                    <small>
                        Explain a concept simply
                    </small>

                </div>

            </button>


            <button
                class="suggestion"
                data-message="Help me create a study plan"
            >

                <span>📚</span>

                <div>

                    <strong>
                        Study help
                    </strong>

                    <small>
                        Create a useful study plan
                    </small>

                </div>

            </button>


            <button
                class="suggestion"
                data-message="Give me some creative ideas"
            >

                <span>✨</span>

                <div>

                    <strong>
                        Get creative
                    </strong>

                    <small>
                        Explore new ideas
                    </small>

                </div>

            </button>


            <button
                class="suggestion"
                data-message="Tell me an interesting fact"
            >

                <span>🌎</span>

                <div>

                    <strong>
                        Something interesting
                    </strong>

                    <small>
                        Discover something new
                    </small>

                </div>

            </button>

        </div>
    `;


    chatBox.appendChild(
        welcome
    );


    // Activate suggestion buttons
    welcome
        .querySelectorAll(
            ".suggestion"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    sendMessage(
                        button.dataset.message
                    );

                }
            );

        });

}


// =========================================================
// CLEAR CURRENT CHAT
// =========================================================

function clearCurrentChat() {

    const conversation =
        getCurrentConversation();


    if (!conversation) {

        showWelcomeScreen();

        return;

    }


    const confirmed =
        confirm(
            "Delete this conversation?"
        );


    if (!confirmed) {
        return;
    }


    conversations =
        conversations.filter(
            item =>
                item.id !==
                currentConversationId
        );


    currentConversationId =
        null;


    saveConversations();

    renderChatHistory();

    showWelcomeScreen();

}


// =========================================================
// INPUT HANDLING
// =========================================================

input.addEventListener(
    "input",
    () => {

        sendButton.disabled =
            input.value.trim() === "";


        input.style.height =
            "auto";


        input.style.height =
            Math.min(
                input.scrollHeight,
                140
            ) + "px";

    }
);


// =========================================================
// ENTER TO SEND
// =========================================================

input.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();


            if (
                !sendButton.disabled
            ) {

                sendMessage();

            }

        }

    }
);


// =========================================================
// SEND BUTTON
// =========================================================

sendButton.addEventListener(
    "click",
    () => {

        if (
            !sendButton.disabled
        ) {

            sendMessage();

        }

    }
);


// =========================================================
// NEW CHAT BUTTON
// =========================================================

newChatButton.addEventListener(
    "click",
    startNewChat
);


// =========================================================
// CLEAR BUTTON
// =========================================================

clearButton.addEventListener(
    "click",
    clearCurrentChat
);


// =========================================================
// MOBILE SIDEBAR
// =========================================================

menuButton.addEventListener(
    "click",
    () => {

        sidebar.classList.add(
            "open"
        );

    }
);


closeSidebar.addEventListener(
    "click",
    () => {

        sidebar.classList.remove(
            "open"
        );

    }
);


// =========================================================
// SCROLL
// =========================================================

function scrollToBottom() {

    setTimeout(
        () => {

            chatBox.scrollTop =
                chatBox.scrollHeight;

        },
        50
    );

}


// =========================================================
// SECURITY — ESCAPE HTML
// =========================================================

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;

}


// =========================================================
// START APPLICATION
// =========================================================

initializeApp();
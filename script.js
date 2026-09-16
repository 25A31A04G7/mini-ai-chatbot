async function sendMessage() {
    const input = document.getElementById("user-input");
    const chatBox = document.getElementById("chat-box");

    const message = input.value.trim();

    if (message === "") {
        return;
    }

    // Show user's message
    const userMessage = document.createElement("div");
    userMessage.className = "message user-message";
    userMessage.textContent = message;
    chatBox.appendChild(userMessage);

    // Clear input
    input.value = "";

    // Show thinking message
    const aiMessage = document.createElement("div");
    aiMessage.className = "message ai-message";
    aiMessage.textContent = "AI is thinking...";
    chatBox.appendChild(aiMessage);

    try {
        const response = await fetch("http://127.0.0.1:8000/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: message
            })
        });

        if (!response.ok) {
            throw new Error("Server error: " + response.status);
        }

        const data = await response.json();

        // Show real AI response
        aiMessage.textContent = data.reply;

    } catch (error) {
        console.error(error);
        aiMessage.textContent = "Sorry, something went wrong.";
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}
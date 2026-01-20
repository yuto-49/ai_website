# Quick Start Guide - Understanding the Codebase

## 🎯 What This App Does

A ChatGPT-like interface where users can:
- Chat with Claude AI (Anthropic's Claude 3 Haiku model)
- Have multiple conversations simultaneously
- See typing indicators while AI responds
- Start new chats easily

---

## 📋 5-Minute Understanding Path

### **1. The Big Picture (2 min)**
- **Frontend**: React app (port 3000) - the UI you see
- **Backend**: Flask server (port 5001) - handles AI API calls
- **Flow**: User types → Frontend → Backend → Claude API → Backend → Frontend → Display

### **2. Key Files to Read (3 min)**

**Must Read (in order):**
1. `server.py` - Backend API endpoint (lines 26-72)
2. `src/App.jsx` - Main React component, state management
3. `src/components/ChatContainer.jsx` - Chat UI layout
4. `src/components/MessageInput.jsx` - Input handling

**Nice to Read:**
- `src/components/Sidebar.jsx` - Conversation list
- `src/components/MessageList.jsx` - Message rendering
- `vite.config.js` - Proxy configuration

---

## 🔍 Code Reading Strategy

### **Strategy 1: Follow a Message Flow**

1. Start: User types in `MessageInput.jsx`
   - Line 21-26: `handleSend` calls `onSendMessage(message)`

2. App receives: `App.jsx` → `handleSendMessage` function
   - Line 43-47: Creates user message object
   - Line 50-64: Updates state (adds message to conversation)
   - Line 69-75: Makes API call to `/api/chat`

3. Backend processes: `server.py` → `/api/chat` endpoint
   - Line 30: Gets message from request
   - Line 38-47: Calls Claude API
   - Line 51-53: Extracts response text
   - Line 55-58: Returns JSON response

4. Frontend updates: `App.jsx` → `handleSendMessage` continues
   - Line 77-78: Gets response data
   - Line 94-105: Updates state with AI message
   - React re-renders → Message appears in UI

### **Strategy 2: Understand State Structure**

Open `App.jsx` and find the state:

```javascript
// Line 7-9: Main state
const [conversations, setConversations] = useState([])
const [activeConversationId, setActiveConversationId] = useState(null)
const [isTyping, setIsTyping] = useState(false)
```

**conversations** structure:
```javascript
[
  {
    id: 1234567890,           // Unique ID (timestamp)
    title: "New Chat",         // Display name
    messages: [                // Array of messages
      {
        id: 1,
        text: "Hello",
        sender: "user"         // or "ai"
      }
    ]
  }
]
```

### **Strategy 3: Component Hierarchy**

```
App (manages all state)
│
├── Sidebar (shows conversation list)
│   └── Receives: conversations, activeConversationId
│   └── Calls: onNewChat, onSelectConversation
│
└── ChatContainer (main chat area)
    ├── WelcomeScreen (shown when no messages)
    ├── MessageList (shows messages)
    │   ├── Message (each message bubble)
    │   └── TypingIndicator (loading animation)
    └── MessageInput (text input)
        └── Calls: onSendMessage
```

---

## 🗺️ File Map

| File | Purpose | Key Lines |
|------|---------|-----------|
| `server.py` | Flask backend, API endpoint | 26-72 (chat endpoint) |
| `src/App.jsx` | Main React component, state | 7-9 (state), 39-123 (message handler) |
| `src/main.jsx` | React entry point | 6-9 (renders App) |
| `vite.config.js` | Dev server config | 13-17 (API proxy) |
| `src/components/ChatContainer.jsx` | Chat UI container | 6-33 (layout) |
| `src/components/MessageInput.jsx` | Text input | 21-26 (send handler) |
| `src/components/MessageList.jsx` | Message display | 18-20 (renders messages) |
| `src/components/Sidebar.jsx` | Conversation sidebar | 16-24 (conversation list) |

---

## 🔑 Key Functions to Understand

### **App.jsx**

1. **`handleSendMessage`** (line 39)
   - Adds user message to state
   - Calls API
   - Updates state with AI response

2. **`handleNewChat`** (line 29)
   - Creates new conversation
   - Sets it as active

3. **`getActiveConversation`** (line 24)
   - Finds current conversation from ID

### **server.py**

1. **`chat()`** (line 26)
   - Receives POST request
   - Calls Claude API
   - Returns response

---

## 🧪 Hands-On Learning

### **Exercise 1: Add Console Logs**
Add these to see the flow:

**In `App.jsx` line 40:**
```javascript
console.log('Sending message:', messageText)
```

**In `server.py` line 30:**
```python
print(f"Received message: {user_message}")
```

### **Exercise 2: Trace State Updates**
1. Open React DevTools in browser
2. Select `<App>` component
3. Watch `conversations` state change when you send a message

### **Exercise 3: Inspect Network**
1. Open browser DevTools → Network tab
2. Send a message
3. Find `/api/chat` request
4. Check Request payload and Response

---

## ❓ Common Questions

**Q: Where is the API key stored?**
A: `.env` file (not in code). Backend reads it via `os.environ.get("ANTHROPIC_API_KEY")`

**Q: How does frontend talk to backend?**
A: Vite proxy forwards `/api/*` requests to `http://localhost:5001`

**Q: Where are conversations saved?**
A: Only in React state (in-memory). Refreshing page loses them.

**Q: How does the typing indicator work?**
A: `isTyping` state is set to `true` when API call starts, `false` when it completes.

**Q: Can I change the AI model?**
A: Yes, edit `server.py` line 39. Currently uses `claude-3-haiku-20240307`.

---

## 🚀 Running the App

```bash
# Terminal 1: Start backend
python server.py

# Terminal 2: Start frontend
npm run dev

# Open browser: http://localhost:3000
```

---

## 📚 Next Steps

1. ✅ Read `ARCHITECTURE.md` for detailed explanation
2. ✅ Add console logs to trace execution
3. ✅ Use React DevTools to inspect state
4. ✅ Modify a component to see how it affects UI
5. ✅ Try adding a new feature (e.g., delete conversation)

---

**Remember**: The code is well-structured. Start with `App.jsx` and `server.py`, then explore components as needed!


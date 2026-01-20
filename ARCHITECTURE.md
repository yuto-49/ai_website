# System Architecture & Code Understanding Guide

## 🏗️ System Overview

This is a **full-stack AI chat application** with:
- **Frontend**: React + Vite (runs on port 3000)
- **Backend**: Flask + Python (runs on port 5001)
- **AI Service**: Anthropic Claude API (Claude 3 Haiku model)

The app provides a ChatGPT-like interface where users can have multiple conversations with an AI assistant.

---

## 📐 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BROWSER                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React Frontend (Port 3000)                          │  │
│  │  ┌──────────┐  ┌──────────────────────────────────┐ │  │
│  │  │ Sidebar  │  │     ChatContainer                 │ │  │
│  │  │          │  │  ┌────────────────────────────┐  │ │  │
│  │  │ - New    │  │  │ MessageList                │  │ │  │
│  │  │   Chat   │  │  │  - Message (user/ai)       │  │ │  │
│  │  │ - Chat   │  │  │  - TypingIndicator          │  │ │  │
│  │  │   History│  │  └────────────────────────────┘  │  │ │  │
│  │  │          │  │  ┌────────────────────────────┐  │ │  │
│  │  │          │  │  │ MessageInput               │  │ │  │
│  │  │          │  │  └────────────────────────────┘  │  │ │  │
│  │  └──────────┘  └──────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          │ HTTP POST /api/chat               │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ (Vite Proxy)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         Flask Backend (Port 5001)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  /api/chat endpoint                                   │  │
│  │  - Receives user message                              │  │
│  │  - Calls Anthropic Claude API                         │  │
│  │  - Returns AI response                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          │ API Call                          │
│                          ▼                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Anthropic Claude API                           │
│         (claude-3-haiku-20240307)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### 1. **User Sends a Message**
```
User types → MessageInput → App.handleSendMessage() → POST /api/chat
```

### 2. **Backend Processes Request**
```
Flask receives POST → Extracts message → Calls Claude API → Returns response
```

### 3. **Frontend Updates UI**
```
Response received → Updates conversations state → MessageList re-renders → Shows AI response
```

---

## 📁 File Structure & Responsibilities

### **Frontend (React)**

#### **Entry Point**
- `index.html` - HTML template with root div
- `src/main.jsx` - React app entry point, renders `<App />`

#### **Main App Component**
- `src/App.jsx` - **Main state manager**
  - Manages all conversations (array of conversation objects)
  - Tracks active conversation ID
  - Handles message sending and API calls
  - State structure:
    ```javascript
    conversations = [
      {
        id: 1234567890,
        title: "New Chat",
        messages: [
          { id: 1, text: "Hello", sender: "user" },
          { id: 2, text: "Hi there!", sender: "ai" }
        ]
      }
    ]
    ```

#### **UI Components**

1. **`Sidebar.jsx`**
   - Displays chat history
   - "New Chat" button
   - User profile section
   - Highlights active conversation

2. **`ChatContainer.jsx`**
   - Main chat area container
   - Shows header with model selector (UI only, not functional)
   - Conditionally renders:
     - `WelcomeScreen` (when no messages)
     - `MessageList` (when messages exist)
   - Contains `MessageInput` at bottom

3. **`MessageList.jsx`**
   - Renders all messages in current conversation
   - Auto-scrolls to bottom when new messages arrive
   - Shows `TypingIndicator` when AI is responding

4. **`Message.jsx`**
   - Individual message bubble
   - Shows avatar (U for user, AI for assistant)
   - Applies different styling based on sender

5. **`MessageInput.jsx`**
   - Text input area (textarea)
   - Auto-resizes based on content
   - Handles Enter key (send) and Shift+Enter (new line)
   - Send button

6. **`WelcomeScreen.jsx`**
   - Shown when conversation is empty
   - Displays suggestion cards
   - Clicking a card sends a pre-filled message

7. **`TypingIndicator.jsx`**
   - Animated dots shown while waiting for AI response

### **Backend (Flask)**

#### **`server.py`**
- Flask application
- **Routes:**
  - `POST /api/chat` - Main chat endpoint
    - Receives: `{ "message": "user text" }`
    - Calls Anthropic Claude API
    - Returns: `{ "response": "ai text", "model": "claude-3-haiku-20240307" }`
  - `GET /health` - Health check endpoint

- **Configuration:**
  - Uses `python-dotenv` to load `ANTHROPIC_API_KEY` from `.env` file
  - CORS enabled for local development
  - Runs on port 5001 (to avoid macOS AirPlay conflict)

### **Configuration Files**

- `vite.config.js` - Vite configuration
  - Sets up proxy: `/api` requests → `http://localhost:5001`
  - React plugin configuration
  - Frontend runs on port 3000

- `package.json` - Node.js dependencies
  - React 18
  - Vite for build tooling

- `requirements.txt` - Python dependencies
  - Flask (web framework)
  - flask-cors (CORS handling)
  - anthropic (Claude API client)
  - python-dotenv (environment variables)

---

## 🚀 Step-by-Step: Understanding the Code

### **Step 1: Start with the Entry Points**

1. **Backend Entry**: `server.py`
   - Read lines 1-25: Imports and setup
   - Read lines 26-72: `/api/chat` endpoint logic
   - Understand: How it receives requests and calls Claude API

2. **Frontend Entry**: `src/main.jsx`
   - Simple: Renders `<App />` component
   - Then read: `src/App.jsx`

### **Step 2: Understand State Management**

Read `src/App.jsx` carefully:
- **Lines 7-9**: State declarations
  - `conversations`: Array of all chat sessions
  - `activeConversationId`: Which chat is currently visible
  - `isTyping`: Loading state for AI response

- **Lines 12-22**: Effect hook ensures at least one conversation exists

- **Lines 39-123**: `handleSendMessage` function
  - Adds user message to state immediately (optimistic update)
  - Makes API call to `/api/chat`
  - Updates state with AI response or error

### **Step 3: Follow the Component Tree**

```
App.jsx
├── Sidebar (conversation list)
└── ChatContainer
    ├── WelcomeScreen (if no messages)
    ├── MessageList (if messages exist)
    │   ├── Message (for each message)
    │   └── TypingIndicator (if loading)
    └── MessageInput
```

Read components in this order:
1. `App.jsx` (already done)
2. `ChatContainer.jsx` (orchestrates chat UI)
3. `MessageInput.jsx` (user input)
4. `MessageList.jsx` (message display)
5. `Message.jsx` (individual message)
6. `Sidebar.jsx` (navigation)
7. `WelcomeScreen.jsx` (empty state)

### **Step 4: Understand API Communication**

1. **Frontend → Backend** (`App.jsx` lines 69-75):
   ```javascript
   fetch('/api/chat', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ message: messageText })
   })
   ```

2. **Vite Proxy** (`vite.config.js` lines 13-17):
   - Intercepts `/api/*` requests
   - Forwards to `http://localhost:5001`

3. **Backend Processing** (`server.py` lines 26-58):
   - Receives JSON
   - Extracts message
   - Calls Anthropic API
   - Returns response

### **Step 5: Understand State Updates**

Trace a complete message flow:

1. User types in `MessageInput` → calls `onSendMessage(messageText)`
2. `App.handleSendMessage`:
   - Creates user message object
   - Updates `conversations` state (adds user message)
   - Sets `isTyping = true`
   - Makes API call
3. API responds → Updates `conversations` state (adds AI message)
4. `isTyping = false`
5. React re-renders → `MessageList` shows new messages

### **Step 6: Understand Multi-Conversation System**

- Each conversation has unique `id` (timestamp)
- `activeConversationId` determines which conversation is shown
- `Sidebar` displays all conversations
- Clicking a conversation calls `setActiveConversationId`
- `App.jsx` filters messages: `getActiveConversation()?.messages`

---

## 🔑 Key Concepts

### **1. Component Props Flow**
- Data flows down: `App` → `ChatContainer` → `MessageList` → `Message`
- Events flow up: `MessageInput` → `ChatContainer` → `App`

### **2. State Management**
- All state lives in `App.jsx` (no external state management)
- State is passed down as props
- Callbacks passed down to update state

### **3. API Integration**
- Frontend makes requests to `/api/chat`
- Vite dev server proxies to Flask backend
- Backend handles API key security (never exposed to frontend)

### **4. Error Handling**
- Network errors caught in `App.jsx` (lines 107-122)
- API errors returned from backend (lines 60-72 in `server.py`)
- Both show error messages in chat UI

---

## 🧪 Testing the Flow

### **To see the complete flow:**

1. **Start Backend:**
   ```bash
   python server.py
   ```
   - Should see: "Server starting on http://localhost:5001"

2. **Start Frontend:**
   ```bash
   npm run dev
   ```
   - Should see: "Local: http://localhost:3000"

3. **Open Browser:**
   - Navigate to `http://localhost:3000`
   - Open browser DevTools → Network tab
   - Type a message and send

4. **Observe:**
   - Network tab shows POST to `/api/chat`
   - Request payload: `{ "message": "your text" }`
   - Response: `{ "response": "ai response", "model": "..." }`
   - UI updates with AI response

---

## 📝 Important Notes

1. **API Key Security**: 
   - API key is stored in `.env` file (not in code)
   - Backend reads it via `os.environ.get("ANTHROPIC_API_KEY")`
   - Frontend never sees the API key

2. **CORS**: 
   - Enabled in Flask for local development
   - Allows frontend (port 3000) to call backend (port 5001)

3. **Model Selector**: 
   - Currently UI-only (doesn't actually change model)
   - Backend always uses `claude-3-haiku-20240307`

4. **Conversation Persistence**: 
   - Conversations only exist in React state
   - Refreshing page loses all conversations
   - No database or localStorage currently

---

## 🎯 Next Steps for Deep Understanding

1. **Add console.logs** to trace execution:
   - In `App.jsx` `handleSendMessage`
   - In `server.py` `/api/chat` endpoint

2. **Use React DevTools**:
   - Inspect component state
   - See props flow
   - Watch state updates

3. **Use Browser DevTools**:
   - Network tab: See API requests/responses
   - Console: See any errors
   - React DevTools: Inspect component tree

4. **Modify and Test**:
   - Change a message style
   - Add a new conversation feature
   - Modify API response handling

---

## 🐛 Common Issues to Understand

1. **"Couldn't connect to server"**: Backend not running on port 5001
2. **CORS errors**: Backend CORS not configured (but it is in this code)
3. **API errors**: Check `.env` file has valid `ANTHROPIC_API_KEY`
4. **Port conflicts**: Change ports in `server.py` (line 92) or `vite.config.js` (line 12)

---

This architecture provides a clean separation between frontend (React) and backend (Flask), with the AI API securely handled on the server side.


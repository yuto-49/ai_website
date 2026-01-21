import React, { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'

import Sidebar from './components/Sidebar'
import ChatContainer from './components/ChatContainer'
import NodeMap from './components/NodeMap'
import './App.css'

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [isTyping, setIsTyping] = useState(false)

  // Topic edges: { conversationId, fromConversationId, fromMessageId, selectionRange }
  const [topicEdges, setTopicEdges] = useState([])
  // Topic summaries: { [conversationId]: summary }
  const [topicSummaries, setTopicSummaries] = useState({})

  // 1) Ensure at least one conversation exists
  useEffect(() => {
    if (conversations.length === 0) {
      const id = Date.now()
      const newConversation = { id, title: 'New Chat', messages: [] }
      setConversations([newConversation])
      setActiveConversationId(id)
    }
  }, [conversations.length])

  // Helpers
  const getActiveConversation = () =>
    conversations.find((c) => c.id === activeConversationId) || null

  const activeMessages = getActiveConversation()?.messages || []

  const handleNewChat = () => {
    const id = Date.now()
    const newConversation = { id, title: 'New Chat', messages: [] }

    setConversations((prev) => [newConversation, ...prev])
    setActiveConversationId(id)

    // Always bring the user to chat view after creating a new chat
    if (location.pathname !== '/') navigate('/')
  }

  // 2) Create a new topic thread from highlighted selection
  const handleCreateTopicFromSelection = (
    fromConversationId,
    fromMessageId,
    highlightText,
    selectionRange
  ) => {
    const id = Date.now()

    const newTopicConversation = {
      id,
      title: highlightText.slice(0, 30) + (highlightText.length > 30 ? '…' : ''),
      messages: [],
      fromConversationId,
      topicMeta: { fromMessageId, selectionRange },
    }

    const newEdge = {
      conversationId: id,
      fromConversationId,
      fromMessageId,
      selectionRange,
    }

    setConversations((prev) => [newTopicConversation, ...prev])
    setTopicEdges((prev) => [...prev, newEdge])
    setActiveConversationId(id)

    // after creating a topic thread, show chat view of that topic
    navigate('/')
  }

  // 3) Topic edges for a given message (used to render badges)
  const getTopicsForMessage = (conversationId, messageId) =>
    topicEdges.filter(
      (edge) => edge.fromConversationId === conversationId && edge.fromMessageId === messageId
    )

  // 4) ContextPack builder (topic thread = parent excerpt + parent messages + recent turns)
  const buildContextPack = (conversationId) => {
    const conversation = conversations.find((c) => c.id === conversationId)
    if (!conversation) return null

    const edge = topicEdges.find((e) => e.conversationId === conversationId)
    if (!edge) return null

    const parentConversation = conversations.find((c) => c.id === edge.fromConversationId)
    if (!parentConversation) return null

    const fromMessage = parentConversation.messages.find((m) => m.id === edge.fromMessageId)
    if (!fromMessage) return null

    let selectedText = ''
    if (edge.selectionRange && fromMessage.text) {
      const start = Math.max(0, Math.min(edge.selectionRange.start, fromMessage.text.length))
      const end = Math.max(start, Math.min(edge.selectionRange.end, fromMessage.text.length))
      selectedText = fromMessage.text.substring(start, end)
    }

    if (!selectedText) return null

    // last 2–4 turns of the topic thread
    const topicMessages = conversation.messages
    const recentTurns = []
    let turnCount = 0
    const maxTurns = 4

    for (let i = topicMessages.length - 1; i >= 0 && turnCount < maxTurns; i--) {
      const msg = topicMessages[i]
      if (msg.sender === 'ai' && i > 0 && topicMessages[i - 1].sender === 'user') {
        recentTurns.unshift({
          user: topicMessages[i - 1].text,
          assistant: msg.text,
        })
        turnCount++
        i--
      }
    }

    return {
      isTopicThread: true,
      fromConversationId: edge.fromConversationId,
      fromMessageId: edge.fromMessageId,
      selectedText,
      selectionRange: edge.selectionRange,
      parentMessages: parentConversation.messages,
      topicSummary: topicSummaries[conversationId] || null,
      recentTurns,
    }
  }

  // 5) Send message (chat endpoint)
  const handleSendMessage = async (messageText) => {
    if (!messageText.trim()) return

    const userMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'user',
    }

    // append user message
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id !== activeConversationId) return conv
        const updatedMessages = [...conv.messages, userMessage]
        return {
          ...conv,
          messages: updatedMessages,
          title:
            conv.messages.length === 0
              ? messageText.slice(0, 30) + (messageText.length > 30 ? '…' : '')
              : conv.title,
        }
      })
    )

    setIsTyping(true)

    const contextPack = buildContextPack(activeConversationId)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, contextPack }),
      })

      const data = await response.json()
      setIsTyping(false)

      const aiMessage = data?.error
        ? { id: Date.now() + 1, text: `Error: ${data.error}`, sender: 'ai' }
        : { id: Date.now() + 1, text: data.response, sender: 'ai' }

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversationId
            ? { ...conv, messages: [...conv.messages, aiMessage] }
            : conv
        )
      )

      if (data?.topicSummary && contextPack?.isTopicThread) {
        setTopicSummaries((prev) => ({
          ...prev,
          [activeConversationId]: data.topicSummary,
        }))
      }
    } catch (error) {
      setIsTyping(false)
      const errMsg = {
        id: Date.now() + 1,
        text:
          "Sorry, I couldn't connect to the server. Make sure the backend is running on http://localhost:5001",
        sender: 'ai',
      }
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversationId ? { ...conv, messages: [...conv.messages, errMsg] } : conv
        )
      )
      console.error('Error:', error)
    }
  }

  // 6) Selecting a conversation should also route appropriately
  const handleSelectConversation = (id) => {
    setActiveConversationId(id)
    // Always show chat when selecting a conversation from the sidebar
    if (location.pathname !== '/') navigate('/')
  }

  // Sidebar active route helper (optional if your Sidebar uses it)
  const activeRoute = useMemo(() => location.pathname, [location.pathname])

  return (
    <div className="app-container">
      <Sidebar
        onNewChat={handleNewChat}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        // Optional props if you added a Map tab/button in Sidebar:
        onGoToMap={() => navigate('/map')}
        activeRoute={activeRoute}
      />

      <Routes>
        {/* Chat page */}
        <Route
          path="/"
          element={
            <ChatContainer
              messages={activeMessages}
              activeConversationId={activeConversationId}
              isTyping={isTyping}
              onSendMessage={handleSendMessage}
              onCreateTopicFromSelection={handleCreateTopicFromSelection}
              getTopicsForMessage={getTopicsForMessage}
              onSelectConversation={handleSelectConversation}
            />
          }
        />

        {/* NodeMap page */}
        <Route
          path="/map"
          element={
            <div className="chat-container">
              <div className="chat-header">
                <h1>Map</h1>
                <div className="model-selector">
                  <button className="new-chat-btn" onClick={handleNewChat} style={{ width: 'auto' }}>
                    + New
                  </button>
                </div>
              </div>

              <div className="messages-container" style={{ paddingBottom: 16 }}>
                <NodeMap
                  conversations={conversations}
                  topicEdges={topicEdges}
                  activeConversationId={activeConversationId}
                  onSelectConversation={(id) => {
                    setActiveConversationId(id)
                    // Click node -> go to chat for that node
                    navigate('/')
                  }}
                />
              </div>
            </div>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App

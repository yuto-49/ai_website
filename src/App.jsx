import React, { useState, useRef, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatContainer from './components/ChatContainer'
import './App.css'

function App() {
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  // Topic edges: array of { conversationId, fromConversationId, fromMessageId, selectionRange }
  const [topicEdges, setTopicEdges] = useState([])
  // Topic summaries: map of conversationId -> stable summary
  const [topicSummaries, setTopicSummaries] = useState({})

  // Ensure there is always at least one conversation
  useEffect(() => {
    if (conversations.length === 0) {
      const newConversation = {
        id: Date.now(),
        title: 'New Chat',
        messages: []
      }
      setConversations([newConversation])
      setActiveConversationId(newConversation.id)
    }
  }, [conversations.length])

  // Create a new topic conversation from a highlighted text selection
  const handleCreateTopicFromSelection = (fromConversationId, fromMessageId, highlightText, selectionRange) => {
    const newTopicConversation = {
      id: Date.now(),
      title: highlightText.slice(0, 30) + (highlightText.length > 30 ? '…' : ''),
      messages: [],
      fromConversationId: fromConversationId,
      topicMeta: {
        fromMessageId: fromMessageId,
        selectionRange: selectionRange
      }
    }

    // Add the topic edge (only IDs)
    const newEdge = {
      conversationId: newTopicConversation.id,
      fromConversationId: fromConversationId,
      fromMessageId: fromMessageId,
      selectionRange: selectionRange
    }

    setConversations((prev) => [newTopicConversation, ...prev])
    setTopicEdges((prev) => [...prev, newEdge])
    setActiveConversationId(newTopicConversation.id)
  }

  // Get all topic conversations linked to a specific message
  const getTopicsForMessage = (conversationId, messageId) => {
    return topicEdges.filter(
      (edge) => edge.fromConversationId === conversationId && edge.fromMessageId === messageId
    )
  }

  // Build contextPack for a conversation (for topic threads)
  const buildContextPack = (conversationId) => {
    const conversation = conversations.find(c => c.id === conversationId)
    if (!conversation) return null

    // Check if this is a topic thread
    const edge = topicEdges.find(e => e.conversationId === conversationId)
    if (!edge) return null // Not a topic thread

    // Get the parent conversation and message
    const parentConversation = conversations.find(c => c.id === edge.fromConversationId)
    if (!parentConversation) return null

    const fromMessage = parentConversation.messages.find(m => m.id === edge.fromMessageId)
    if (!fromMessage) return null

    // Extract the selected text from the parent message using selectionRange
    let selectedText = ''
    if (edge.selectionRange && fromMessage.text) {
      try {
        const start = Math.max(0, Math.min(edge.selectionRange.start, fromMessage.text.length))
        const end = Math.max(start, Math.min(edge.selectionRange.end, fromMessage.text.length))
        selectedText = fromMessage.text.substring(start, end)
      } catch (e) {
        console.warn('Error extracting selected text from parent message:', e)
        selectedText = ''
      }
    }
    
    if (!selectedText) return null // Can't build context without selected text

    // Get parent conversation messages (for context)
    const parentMessages = parentConversation.messages

    // Get last 2-4 turns of the topic thread (working memory)
    // Each "turn" is a user message + AI response pair
    const topicMessages = conversation.messages
    const recentTurns = []
    let turnCount = 0
    const maxTurns = 4
    
    // Go backwards through messages to collect turns
    for (let i = topicMessages.length - 1; i >= 0 && turnCount < maxTurns; i--) {
      const msg = topicMessages[i]
      if (msg.sender === 'ai') {
        // Find the preceding user message
        if (i > 0 && topicMessages[i - 1].sender === 'user') {
          recentTurns.unshift({
            user: topicMessages[i - 1].text,
            assistant: msg.text
          })
          turnCount++
          i-- // Skip the user message we just processed
        }
      }
    }

    return {
      isTopicThread: true,
      fromConversationId: edge.fromConversationId,
      fromMessageId: edge.fromMessageId,
      selectedText: selectedText,
      selectionRange: edge.selectionRange,
      parentMessages: parentMessages,
      topicSummary: topicSummaries[conversationId] || null,
      recentTurns: recentTurns // Last 2-4 turns as working memory
    }
  }

  const getActiveConversation = () =>
    conversations.find((c) => c.id === activeConversationId) || null

  const activeMessages = getActiveConversation()?.messages || []

  const handleNewChat = () => {
    const newConversation = {
      id: Date.now(),
      title: 'New Chat',
      messages: []
    }
    setConversations((prev) => [newConversation, ...prev])
    setActiveConversationId(newConversation.id)
  }

  const handleSendMessage = async (messageText) => {
    if (!messageText.trim()) return

    // Add user message
    const userMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'user'
    }

    // Add user message to active conversation
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id !== activeConversationId) return conv
        const updatedMessages = [...conv.messages, userMessage]
        return {
          ...conv,
          messages: updatedMessages,
          // Use first user message as the conversation title
          title:
            conv.messages.length === 0
              ? messageText.slice(0, 30) + (messageText.length > 30 ? '…' : '')
              : conv.title
        }
      })
    )

    setIsTyping(true)

    // Build contextPack if this is a topic thread
    const contextPack = buildContextPack(activeConversationId)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: messageText,
          contextPack: contextPack
        })
      })

      const data = await response.json()
      setIsTyping(false)

      if (data.error) {
        const errorMessage = {
          id: Date.now() + 1,
          text: `Error: ${data.error}`,
          sender: 'ai'
        }
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === activeConversationId
              ? { ...conv, messages: [...conv.messages, errorMessage] }
              : conv
          )
        )
      } else {
        const aiMessage = {
          id: Date.now() + 1,
          text: data.response,
          sender: 'ai'
        }
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === activeConversationId
              ? { ...conv, messages: [...conv.messages, aiMessage] }
              : conv
          )
        )

        // Update topic summary if provided by backend
        if (data.topicSummary && contextPack?.isTopicThread) {
          setTopicSummaries((prev) => ({
            ...prev,
            [activeConversationId]: data.topicSummary
          }))
        }
      }
    } catch (error) {
      setIsTyping(false)
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Sorry, I couldn\'t connect to the server. Make sure the backend is running on http://localhost:5001',
        sender: 'ai'
      }
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversationId
            ? { ...conv, messages: [...conv.messages, errorMessage] }
            : conv
        )
      )
      console.error('Error:', error)
    }
  }

  return (
    <div className="app-container">
      <Sidebar
        onNewChat={handleNewChat}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
      />
      <ChatContainer 
        messages={activeMessages}
        activeConversationId={activeConversationId}
        isTyping={isTyping}
        onSendMessage={handleSendMessage}
        onCreateTopicFromSelection={handleCreateTopicFromSelection}
        getTopicsForMessage={getTopicsForMessage}
        onSelectConversation={setActiveConversationId}
      />
    </div>
  )
}

export default App


import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'

import Sidebar from './components/Sidebar'
import ChatContainer from './components/ChatContainer'
import NodeMap from './components/NodeMap'
import { useLayoutCache } from './hooks/useLayoutCache'
import './App.css'

// localStorage keys
const STORAGE_KEY_POSITIONS = 'nodeMap.manualPositions.v1'

/**
 * Main App with Split View (Chat + Map Panel)
 *
 * Implements spec requirements:
 * - 5.1: Split View + "Expand Chat" - Map Panel mode in chat route
 * - G4: Maintain current data model (conversations + topicEdges)
 * - Draggable nodes with localStorage persistence
 */
function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [isTyping, setIsTyping] = useState(false)

  // Model selection: { provider: 'claude' | 'gemini', model: string }
  const [selectedModel, setSelectedModel] = useState({ provider: 'claude', model: 'Claude 3 Haiku' })

  // Map panel state: 'collapsed' | 'mini' | 'expanded'
  const [mapPanelState, setMapPanelState] = useState('mini')

  // Topic edges: { conversationId, fromConversationId, fromMessageId, selectionRange }
  const [topicEdges, setTopicEdges] = useState([])
  // Topic summaries: { [conversationId]: summary }
  const [topicSummaries, setTopicSummaries] = useState({})

  // Manual node positions: { [rootId]: { [nodeId]: { nx, ny } } }
  // Normalized coordinates (0-1) for resize stability
  const [manualPositions, setManualPositions] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POSITIONS)
      return saved ? JSON.parse(saved) : {}
    } catch (e) {
      console.error('Failed to load manual positions from localStorage:', e)
      return {}
    }
  })

  // Debounce ref for saving positions
  const saveTimeoutRef = useRef(null)

  // Save manual positions to localStorage (debounced)
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(manualPositions))
      } catch (e) {
        console.error('Failed to save manual positions to localStorage:', e)
      }
    }, 300) // Debounce 300ms

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [manualPositions])

  // Persistent layout cache for stable node positioning
  const layoutCache = useLayoutCache()

  // 1) Ensure at least one conversation exists
  useEffect(() => {
    if (conversations.length === 0) {
      const id = Date.now()
      const newConversation = { id, title: 'New Chat', messages: [] }
      setConversations([newConversation])
      setActiveConversationId(id)
    }
  }, [conversations.length])

  // Clean up stale positions when conversations change
  useEffect(() => {
    const conversationIds = new Set(conversations.map(c => String(c.id)))

    setManualPositions(prev => {
      let changed = false
      const next = { ...prev }

      for (const rootId of Object.keys(next)) {
        const rootPositions = next[rootId]
        const cleanedPositions = {}

        for (const nodeId of Object.keys(rootPositions)) {
          // Keep position if node still exists or is a cluster
          if (conversationIds.has(nodeId) || nodeId.startsWith('cluster-')) {
            cleanedPositions[nodeId] = rootPositions[nodeId]
          } else {
            changed = true
          }
        }

        if (Object.keys(cleanedPositions).length === 0) {
          delete next[rootId]
          changed = true
        } else {
          next[rootId] = cleanedPositions
        }
      }

      return changed ? next : prev
    })
  }, [conversations])

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
      title: highlightText.slice(0, 30) + (highlightText.length > 30 ? '...' : ''),
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

    // last 2-4 turns of the topic thread
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
              ? messageText.slice(0, 30) + (messageText.length > 30 ? '...' : '')
              : conv.title,
        }
      })
    )

    setIsTyping(true)

    const contextPack = buildContextPack(activeConversationId)

    // Get current conversation messages for agents
    const currentConversation = conversations.find((c) => c.id === activeConversationId)
    const conversationMessages = currentConversation
      ? [...currentConversation.messages, userMessage]
      : [userMessage]

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          contextPack,
          conversationMessages, // Send conversation context for agents
          enabledAgents: ['brainstorming'], // Can be made configurable
          modelProvider: selectedModel.provider, // 'claude' or 'gemini'
        }),
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

      // ============================================================================
      // HANDLE AGENT RESULTS - EXTENSIBLE SYSTEM
      // ============================================================================
      if (data?.agentResults) {
        handleAgentResults(data.agentResults, activeConversationId)
      }
    } catch (error) {
      setIsTyping(false)
      const errMsg = {
        id: Date.now() + 1,
        text:
          "Sorry, I couldn't connect to the server. Make sure the backend is running on http://127.0.0.1:5001",
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

  // ============================================================================
  // AGENT RESULT HANDLERS - ADD NEW HANDLERS HERE FOR NEW AGENTS
  // ============================================================================

  const handleAgentResults = (agentResults, sourceConversationId) => {
    // Handle brainstorming agent results
    if (agentResults.brainstorming?.success && agentResults.brainstorming?.ideas) {
      createAutoGeneratedNodes(sourceConversationId, agentResults.brainstorming.ideas, 'brainstorming')
    }

    // Add more agent result handlers here as new agents are added:
    // if (agentResults.summarizer?.success) { ... }
    // if (agentResults.factChecker?.success) { ... }
  }

  const createAutoGeneratedNodes = (sourceConversationId, ideas, agentType) => {
    if (!ideas || ideas.length === 0) return

    const newConversations = []
    const newEdges = []

    ideas.forEach((idea, index) => {
      const id = Date.now() + index + 1000 // Ensure unique IDs

      const newConversation = {
        id,
        title: idea,
        messages: [],
        fromConversationId: sourceConversationId,
        isAiGenerated: true, // Mark as AI-generated for visual distinction
        generatedBy: agentType, // Track which agent created it
        topicMeta: {
          aiGenerated: true,
          sourceAgent: agentType,
        },
      }

      const newEdge = {
        conversationId: id,
        fromConversationId: sourceConversationId,
        fromMessageId: null, // No specific message, generated by agent
        isAiGenerated: true,
      }

      newConversations.push(newConversation)
      newEdges.push(newEdge)
    })

    // Add to state
    setConversations((prev) => [...newConversations, ...prev])
    setTopicEdges((prev) => [...prev, ...newEdges])
  }

  // 6) Selecting a conversation should also route appropriately
  const handleSelectConversation = (id) => {
    setActiveConversationId(id)
    // Always show chat when selecting a conversation from the sidebar
    if (location.pathname !== '/') navigate('/')
  }

  // Handle map node click - select conversation (map stays visible in split view)
  const handleMapNodeClick = (id) => {
    setActiveConversationId(id)
  }

  // Handle cluster expansion - navigate to cluster view page
  const handleExpandCluster = (parentId, childIds) => {
    navigate(`/ideas/${parentId}`)
  }

  // Handle node move (drag) - update manual positions
  const handleMoveNode = useCallback((rootId, nodeId, nx, ny) => {
    // Clamp values to [0, 1]
    const clampedNx = Math.max(0, Math.min(1, nx))
    const clampedNy = Math.max(0, Math.min(1, ny))

    setManualPositions(prev => ({
      ...prev,
      [rootId]: {
        ...(prev[rootId] || {}),
        [String(nodeId)]: { nx: clampedNx, ny: clampedNy }
      }
    }))
  }, [])

  // Reset positions for a root
  const handleResetPositions = useCallback((rootId) => {
    setManualPositions(prev => {
      const next = { ...prev }
      delete next[rootId]
      return next
    })
  }, [])

  // Toggle map panel state
  const cycleMapPanel = () => {
    setMapPanelState((prev) => {
      if (prev === 'collapsed') return 'mini'
      if (prev === 'mini') return 'expanded'
      return 'collapsed'
    })
  }

  // Sidebar active route helper (optional if your Sidebar uses it)
  const activeRoute = useMemo(() => location.pathname, [location.pathname])

  // Common NodeMap props
  const nodeMapProps = {
    conversations,
    topicEdges,
    activeConversationId,
    layoutCache,
    manualPositions,
    onMoveNode: handleMoveNode,
    onResetPositions: handleResetPositions,
    onExpandCluster: handleExpandCluster,
    onNewChat: handleNewChat,
  }



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
        {/* Chat page with split view */}
        <Route
          path="/"
          element={
            <div className={`split-view split-view--map-${mapPanelState}`}>
              {/* Chat Panel */}
              <div className="split-view__chat">
                <ChatContainer
                  messages={activeMessages}
                  activeConversationId={activeConversationId}
                  isTyping={isTyping}
                  onSendMessage={handleSendMessage}
                  onCreateTopicFromSelection={handleCreateTopicFromSelection}
                  getTopicsForMessage={getTopicsForMessage}
                  onSelectConversation={handleSelectConversation}
                  selectedModel={selectedModel}
                  onModelChange={setSelectedModel}
                />
              </div>

              {/* Map Panel Toggle Button */}
              <button
                className="split-view__toggle"
                onClick={cycleMapPanel}
                title={
                  mapPanelState === 'collapsed'
                    ? 'Show map panel'
                    : mapPanelState === 'mini'
                      ? 'Expand map panel'
                      : 'Collapse map panel'
                }
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {mapPanelState === 'collapsed' ? (
                    <polyline points="15 18 9 12 15 6" />
                  ) : mapPanelState === 'expanded' ? (
                    <polyline points="9 18 15 12 9 6" />
                  ) : (
                    <>
                      <circle cx="12" cy="12" r="3" />
                      <line x1="12" y1="3" x2="12" y2="6" />
                      <line x1="12" y1="18" x2="12" y2="21" />
                      <line x1="3" y1="12" x2="6" y2="12" />
                      <line x1="18" y1="12" x2="21" y2="12" />
                    </>
                  )}
                </svg>
              </button>

              {/* Map Panel */}
              {mapPanelState !== 'collapsed' && (
                <div className="split-view__map">
                  <div className="split-view__map-header">
                    <span className="split-view__map-title">Map</span>
                    <button
                      className="split-view__map-fullscreen"
                      onClick={() => navigate('/map')}
                      title="Open full map"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                    </button>
                  </div>
                  <div className="split-view__map-content">
                    <NodeMap
                      {...nodeMapProps}
                      onSelectConversation={handleMapNodeClick}
                      compact={mapPanelState === 'mini'}
                    />
                  </div>
                </div>
              )}
            </div>
          }
        />

        {/* NodeMap full page */}
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
                  {...nodeMapProps}
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

        {/* Cluster expansion page */}
        <Route
          path="/ideas/:parentId"
          element={
            <ClusterExpansionPage
              conversations={conversations}
              nodeMapProps={nodeMapProps}
              onSelectConversation={(id) => {
                setActiveConversationId(id)
                navigate('/')
              }}
              onNewChat={handleNewChat}
            />
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

// Cluster expansion page component defined outside App to avoid remounting
const ClusterExpansionPage = ({ conversations, nodeMapProps, onSelectConversation, onNewChat }) => {
  const navigate = useNavigate()
  const { parentId } = useParams()
  const numericParentId = Number(parentId)

  const parentConv = conversations.find(c => c.id === numericParentId)
  const parentTitle = parentConv?.title || 'Ideas'

  return (
    <div className="chat-container cluster-page">
      <div className="chat-header">
        <div className="cluster-page__header">
          <button
            className="cluster-page__back"
            onClick={() => navigate(-1)}
            title="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="cluster-page__title">
            <h1>AI Ideas</h1>
            <span className="cluster-page__subtitle">from: {parentTitle}</span>
          </div>
        </div>
        <div className="model-selector">
          <button className="new-chat-btn" onClick={onNewChat} style={{ width: 'auto' }}>
            + New
          </button>
        </div>
      </div>

      <div className="messages-container" style={{ paddingBottom: 16 }}>
        <NodeMap
          {...nodeMapProps}
          onSelectConversation={onSelectConversation}
          focusedParentId={numericParentId}
        />
      </div>
    </div>
  )
}

export default App

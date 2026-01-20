import React from 'react'

function Sidebar({ onNewChat, conversations = [], activeConversationId, onSelectConversation }) {
  // Organize conversations into a tree structure
  const organizeConversations = () => {
    const rootConversations = []
    const topicMap = new Map()

    // First pass: separate root and topic conversations
    conversations.forEach((conv) => {
      if (conv.fromConversationId) {
        if (!topicMap.has(conv.fromConversationId)) {
          topicMap.set(conv.fromConversationId, [])
        }
        topicMap.get(conv.fromConversationId).push(conv)
      } else {
        rootConversations.push(conv)
      }
    })

    // Sort by id (newest first)
    rootConversations.sort((a, b) => b.id - a.id)
    topicMap.forEach((topics) => {
      topics.sort((a, b) => b.id - a.id)
    })

    return { rootConversations, topicMap }
  }

  const { rootConversations, topicMap } = organizeConversations()

  const renderConversation = (conv, isTopic = false) => {
    const topics = topicMap.get(conv.id) || []
    return (
      <React.Fragment key={conv.id}>
        <div
          className={`chat-history-item ${isTopic ? 'topic-item' : ''} ${conv.id === activeConversationId ? 'active' : ''}`}
          onClick={() => onSelectConversation && onSelectConversation(conv.id)}
        >
          {isTopic && <span className="topic-indicator">└─</span>}
          <span>{conv.title || 'New Chat'}</span>
        </div>
        {topics.map((topicConv) => renderConversation(topicConv, true))}
      </React.Fragment>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={onNewChat}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Chat
        </button>
      </div>
      <div className="chat-history">
        {rootConversations.map((conv) => renderConversation(conv, false))}
      </div>
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">U</div>
          <span>User</span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar


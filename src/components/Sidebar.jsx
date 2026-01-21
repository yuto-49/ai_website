import React from "react";

function Sidebar({
  onNewChat,
  conversations = [],
  activeConversationId,
  onSelectConversation,

  // NEW (for routing)
  onGoToMap,
  activeRoute, // "/" or "/map"
}) {
  // Organize conversations into a tree structure
  const organizeConversations = () => {
    const rootConversations = [];
    const topicMap = new Map();

    conversations.forEach((conv) => {
      if (conv.fromConversationId) {
        if (!topicMap.has(conv.fromConversationId)) topicMap.set(conv.fromConversationId, []);
        topicMap.get(conv.fromConversationId).push(conv);
      } else {
        rootConversations.push(conv);
      }
    });

    rootConversations.sort((a, b) => b.id - a.id);
    topicMap.forEach((topics) => topics.sort((a, b) => b.id - a.id));

    return { rootConversations, topicMap };
  };

  const { rootConversations, topicMap } = organizeConversations();

  const renderConversation = (conv, isTopic = false) => {
    const topics = topicMap.get(conv.id) || [];
    const isActive = conv.id === activeConversationId && activeRoute === "/";

    return (
      <React.Fragment key={conv.id}>
        <div
          className={`chat-history-item ${isTopic ? "topic-item" : ""} ${isActive ? "active" : ""}`}
          onClick={() => onSelectConversation?.(conv.id)}
          role="button"
          tabIndex={0}
        >
          {isTopic && <span className="topic-indicator">↳</span>}
          <span>{conv.title || "New Chat"}</span>
        </div>

        {topics.map((topicConv) => renderConversation(topicConv, true))}
      </React.Fragment>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        {/* small brand area (NotebookLM-ish) */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 850, color: "var(--text-primary)" }}>
            Notebook Chat
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            Chats • Topics • Map
          </div>
        </div>

        <button className="new-chat-btn" onClick={onNewChat}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Chat
        </button>
      </div>

      {/* NEW: Chats | Map navigation */}
      <div className="sidebar-nav">
        <button
          className={`nav-btn ${activeRoute === "/" ? "active" : ""}`}
          onClick={() => onSelectConversation?.(activeConversationId)}
        >
          Chats
        </button>

        <button
          className={`nav-btn ${activeRoute === "/map" ? "active" : ""}`}
          onClick={onGoToMap}
        >
          Map
        </button>
      </div>

      <div className="chat-history">
        {rootConversations.map((conv) => renderConversation(conv, false))}
      </div>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">U</div>
          <span style={{ color: "var(--text-secondary)" }}>User</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;

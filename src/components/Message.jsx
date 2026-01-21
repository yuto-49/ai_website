import React, { useEffect, useMemo, useRef, useState } from "react";

function Message({
  messageId,
  text,
  sender,
  activeConversationId,
  onCreateTopicFromSelection,
  getTopicsForMessage,
  onSelectConversation,

  // OPTIONAL: if you want "Open in Map" behavior
  onGoToMap,
}) {
  const [showTopicMenu, setShowTopicMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState(null);

  const contentRef = useRef(null);
  const menuRef = useRef(null);

  const linkedTopics = useMemo(() => {
    return getTopicsForMessage ? getTopicsForMessage(activeConversationId, messageId) : [];
  }, [getTopicsForMessage, activeConversationId, messageId]);

  // Compute selection offsets reliably (range -> character offsets in this element)
  const computeOffsets = (range) => {
    const el = contentRef.current;
    if (!el) return null;

    const fullText = el.textContent ?? text ?? "";

    // Range-to-offset trick: measure preRange length
    try {
      const pre = document.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(range.startContainer, range.startOffset);
      const start = pre.toString().length;
      const selected = range.toString();
      const end = start + selected.length;

      // sanity clamp
      const s = Math.max(0, Math.min(start, fullText.length));
      const e = Math.max(s, Math.min(end, fullText.length));
      return { start: s, end: e };
    } catch {
      // fallback: search
      const sel = range.toString();
      const idx = fullText.indexOf(sel);
      if (idx !== -1) return { start: idx, end: idx + sel.length };
      return { start: 0, end: Math.min(fullText.length, (sel || "").length) };
    }
  };

  // Only evaluate selection when user interacts inside this message
  const handleMaybeShowMenu = () => {
    const el = contentRef.current;
    if (!el) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setShowTopicMenu(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const selText = selection.toString().trim();

    // Must be within this message content
    if (!selText || !el.contains(range.commonAncestorContainer)) {
      setShowTopicMenu(false);
      return;
    }

    // Compute offsets in the message text
    const offsets = computeOffsets(range);
    if (!offsets) {
      setShowTopicMenu(false);
      return;
    }

    // Menu position relative to message content box
    const rect = range.getBoundingClientRect();
    const containerRect = el.getBoundingClientRect();

    setSelectedText(selText);
    setSelectionRange(offsets);
    setMenuPosition({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
    });
    setShowTopicMenu(true);
  };

  // Click outside to close (but don’t aggressively clear text selection)
  useEffect(() => {
    const onDown = (e) => {
      const menu = menuRef.current;
      const content = contentRef.current;
      if (!menu || !content) return;
      if (!menu.contains(e.target) && !content.contains(e.target)) {
        setShowTopicMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const handleStartTopic = () => {
    if (!selectedText || !selectionRange || !onCreateTopicFromSelection) return;
    onCreateTopicFromSelection(activeConversationId, messageId, selectedText, selectionRange);
    setShowTopicMenu(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleTopicBadgeClick = (topicConversationId) => {
    onSelectConversation?.(topicConversationId);
  };

  // Optional: open topic in map view (if you pass onGoToMap)
  const handleOpenMap = (topicConversationId) => {
    onSelectConversation?.(topicConversationId);
    onGoToMap?.();
  };

  return (
    <div className={`message ${sender}`}>
      {/* In new UI you hide this with CSS, but leaving it won’t hurt.
          If you want true NotebookLM style, you can remove it entirely. */}
      <div className="message-avatar">{sender === "user" ? "U" : "AI"}</div>

      <div className="message-content-wrapper">
        <div
          ref={contentRef}
          className="message-content"
          onMouseUp={handleMaybeShowMenu}
          onKeyUp={handleMaybeShowMenu}
          style={{
            // CSS variables for menu placement (no hardcoded absolute pixel styles)
            "--menu-x": `${menuPosition.x}px`,
            "--menu-y": `${menuPosition.y}px`,
          }}
        >
          {text}

          {showTopicMenu && (
            <div ref={menuRef} className="topic-menu">
              <button className="start-topic-btn" onClick={handleStartTopic}>
                Start Topic
              </button>
            </div>
          )}
        </div>

        {linkedTopics.length > 0 && (
          <div className="topic-badges">
            {linkedTopics.map((edge) => {
              let highlightText = "Topic";
              if (edge.selectionRange) {
                const start = Math.max(0, Math.min(edge.selectionRange.start, text.length));
                const end = Math.max(start, Math.min(edge.selectionRange.end, text.length));
                highlightText = text.substring(start, end) || "Topic";
              }

              const label = highlightText.slice(0, 28) + (highlightText.length > 28 ? "…" : "");

              return (
                <div key={edge.conversationId} style={{ display: "flex", gap: 8 }}>
                  <button
                    className="topic-badge"
                    onClick={() => handleTopicBadgeClick(edge.conversationId)}
                    title={`Jump to: ${highlightText}`}
                  >
                    {label}
                  </button>

                  {/* Optional map button if you want */}
                  {onGoToMap && (
                    <button
                      className="topic-badge"
                      onClick={() => handleOpenMap(edge.conversationId)}
                      title="Open in Map"
                    >
                      Map
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Message;

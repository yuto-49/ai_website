import React from "react";
import NodeMap from "../components/NodeMap";

export default function NodeMapPage({
    conversations,
    topicEdges,
    activeConversationId,
    setActiveConversationId,
    onNewChat,
}) {
    return (
        <div className="node-map-page">
            <div className="node-map-page__header chat-header">
                <h1>Map</h1>

                <div className="node-map-page__actions">
                    <button className="new-chat-btn" onClick={onNewChat}>
                        + New
                    </button>
                </div>
            </div>

            <div className="node-map-page__body">
                <NodeMap
                    conversations={conversations}
                    topicEdges={topicEdges}
                    activeConversationId={activeConversationId}
                    onSelectConversation={setActiveConversationId}
                />
            </div>
        </div>
    );
}

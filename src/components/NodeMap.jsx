import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * NodeMap renders a radial mind map for the active root conversation.
 * Theme + layout are CSS-driven (no hardcoded light-mode inline styles).
 *
 * Props:
 *  - conversations: [{id, title, fromConversationId?, ...}]
 *  - topicEdges: [{conversationId, fromConversationId, fromMessageId, selectionRange}]
 *  - activeConversationId
 *  - onSelectConversation(id)
 *  - onNewChat()
 */
export default function NodeMap({
    conversations,
    topicEdges,
    activeConversationId,
    onSelectConversation,
    onNewChat,
}) {
    const containerRef = useRef(null);
    const [size, setSize] = useState({ w: 520, h: 520 });

    // ResizeObserver: fit to container
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver((entries) => {
            const cr = entries?.[0]?.contentRect;
            if (!cr) return;
            setSize({ w: cr.width, h: cr.height });
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    const byId = useMemo(() => {
        const m = new Map();
        conversations.forEach((c) => m.set(c.id, c));
        return m;
    }, [conversations]);

    const parentOf = useMemo(() => {
        const m = new Map();
        topicEdges.forEach((e) => m.set(e.conversationId, e.fromConversationId));
        return m;
    }, [topicEdges]);

    const childrenOf = useMemo(() => {
        const m = new Map();
        topicEdges.forEach((e) => {
            if (!m.has(e.fromConversationId)) m.set(e.fromConversationId, []);
            m.get(e.fromConversationId).push(e.conversationId);
        });
        for (const [k, arr] of m.entries()) arr.sort((a, b) => b - a);
        return m;
    }, [topicEdges]);

    const getRoot = (id) => {
        let cur = id;
        const seen = new Set();
        while (parentOf.has(cur) && !seen.has(cur)) {
            seen.add(cur);
            cur = parentOf.get(cur);
        }
        return cur;
    };

    const rootId = useMemo(() => {
        if (!activeConversationId) return null;
        return getRoot(activeConversationId);
    }, [activeConversationId, parentOf]);

    // Build subtree from rootId (BFS)
    const { nodes, links } = useMemo(() => {
        if (!rootId || !byId.has(rootId)) return { nodes: [], links: [] };

        const q = [rootId];
        const depth = new Map([[rootId, 0]]);
        const order = [];
        const linksLocal = [];

        while (q.length) {
            const u = q.shift();
            order.push(u);
            const kids = childrenOf.get(u) || [];
            for (const v of kids) {
                if (!depth.has(v)) {
                    depth.set(v, depth.get(u) + 1);
                    q.push(v);
                    linksLocal.push({ from: u, to: v });
                }
            }
        }

        const nodesLocal = order
            .map((id) => ({
                id,
                depth: depth.get(id) ?? 0,
                title: byId.get(id)?.title || "New Chat",
            }))
            .sort((a, b) => a.depth - b.depth);

        return { nodes: nodesLocal, links: linksLocal };
    }, [rootId, byId, childrenOf]);

    // Radial layout positions (responsive, prevents clipping)
    const positioned = useMemo(() => {
        if (nodes.length === 0) return { positions: new Map(), maxDepth: 0 };

        const byDepth = new Map();
        let maxDepth = 0;

        for (const n of nodes) {
            maxDepth = Math.max(maxDepth, n.depth);
            if (!byDepth.has(n.depth)) byDepth.set(n.depth, []);
            byDepth.get(n.depth).push(n);
        }

        const cx = size.w / 2;
        const cy = size.h / 2;

        // safe padding so nodes don’t clip
        const pad = 120;

        // compute ringGap based on available radius
        const maxR = Math.max(120, Math.min(size.w, size.h) / 2 - pad);
        const ringGap = maxDepth > 0 ? maxR / maxDepth : 0;

        const positions = new Map();

        // depth 0 center
        const centerNode = nodes.find((n) => n.depth === 0);
        if (centerNode) positions.set(centerNode.id, { x: cx, y: cy });

        for (let d = 1; d <= maxDepth; d++) {
            const ring = byDepth.get(d) || [];
            const count = ring.length || 1;

            // keep first ring a bit separated visually
            const r = Math.max(90, d * ringGap);

            const phase = d * 0.35;
            ring.forEach((n, i) => {
                const theta = (2 * Math.PI * i) / count + phase;
                const x = cx + r * Math.cos(theta);
                const y = cy + r * Math.sin(theta);
                positions.set(n.id, { x, y });
            });
        }

        return { positions, maxDepth };
    }, [nodes, size]);

    const getPos = (id) => positioned.positions.get(id);

    return (
        <div ref={containerRef} className="node-map">
            {/* Top controls */}
            <div className="node-map__toolbar">
                <button className="node-map__btn" onClick={onNewChat}>
                    + New Chat
                </button>

                {rootId && (
                    <div className="node-map__meta" title={byId.get(rootId)?.title || "Chat"}>
                        Map root: <b>{byId.get(rootId)?.title || "Chat"}</b>
                    </div>
                )}
            </div>

            {/* Links */}
            <svg className="node-map__svg" width={size.w} height={size.h}>
                <defs>
                    {/* Gradient stroke for connections */}
                    <linearGradient id="linkGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="rgba(110,168,255,0.55)" />
                        <stop offset="100%" stopColor="rgba(103,232,249,0.30)" />
                    </linearGradient>

                    {/* Soft glow */}
                    <filter id="linkGlow">
                        <feGaussianBlur stdDeviation="2.2" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {links.map((e) => {
                    const p1 = getPos(e.from);
                    const p2 = getPos(e.to);
                    if (!p1 || !p2) return null;

                    return (
                        <line
                            key={`${e.from}-${e.to}`}
                            x1={p1.x}
                            y1={p1.y}
                            x2={p2.x}
                            y2={p2.y}
                            className="node-map__link"
                        />
                    );
                })}
            </svg>

            {/* Nodes */}
            <div className="node-map__nodes">
                {nodes.map((n) => {
                    const p = getPos(n.id);
                    if (!p) return null;

                    const isActive = n.id === activeConversationId;
                    const isCenter = n.depth === 0;

                    return (
                        <button
                            key={n.id}
                            onClick={() => onSelectConversation?.(n.id)}
                            title={n.title}
                            className={[
                                "node-map__node",
                                isCenter ? "is-center" : "",
                                isActive ? "is-active" : "",
                            ].join(" ")}
                            style={{
                                left: p.x,
                                top: p.y,
                            }}
                        >
                            <span className="node-map__title">
                                {isCenter ? (n.title || "Chat") : n.title}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

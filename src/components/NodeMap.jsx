import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

/**
 * Clip line endpoints so they stop at node borders instead of centers.
 * This makes links look clean and intentional.
 * @param {Object} a - Start point {x, y}
 * @param {Object} b - End point {x, y}
 * @param {number} rA - Radius to clip from start point
 * @param {number} rB - Radius to clip from end point
 * @returns {Object} Clipped line coordinates {x1, y1, x2, y2}
 */
function clipLineToNodeBorders(a, b, rA, rB) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);

    // If nodes are too close or overlapping, don't draw
    if (dist < rA + rB) {
        return null;
    }

    const ux = dx / dist;
    const uy = dy / dist;

    return {
        x1: a.x + ux * rA,
        y1: a.y + uy * rA,
        x2: b.x - ux * rB,
        y2: b.y - uy * rB,
    };
}

/**
 * NodeMap renders a radial mind map for the active root conversation.
 *
 * Features:
 * - Draggable nodes with position persistence
 * - Manual positions override auto radial layout
 * - Lock/unlock mode for browsing vs editing
 * - Reset positions to auto layout
 *
 * Props:
 *  - conversations: [{id, title, fromConversationId?, isAiGenerated?, generatedBy?, ...}]
 *  - topicEdges: [{conversationId, fromConversationId, fromMessageId, selectionRange, isAiGenerated?}]
 *  - activeConversationId
 *  - onSelectConversation(id)
 *  - onExpandCluster(parentId, childIds) - callback to expand cluster into new view
 *  - onNewChat() - callback to create new chat
 *  - manualPositions: { [rootId]: { [nodeId]: { nx, ny } } } - normalized positions (0-1)
 *  - onMoveNode(rootId, nodeId, nx, ny) - callback when node is dragged
 *  - onResetPositions(rootId) - callback to reset positions for a root
 *  - layoutCache: persistent layout cache from parent
 *  - compact: boolean for mini-map mode
 *  - focusedParentId: if set, only show children of this parent (for cluster expansion view)
 */
export default function NodeMap({
    conversations,
    topicEdges,
    activeConversationId,
    onSelectConversation,
    onExpandCluster,
    onNewChat,
    manualPositions = {},
    onMoveNode,
    onResetPositions,
    layoutCache,
    compact = false,
    focusedParentId = null,
}) {
    const containerRef = useRef(null);
    const [size, setSize] = useState({ w: 520, h: 520 });
    const [hoveredNodeId, setHoveredNodeId] = useState(null);
    const [isLocked, setIsLocked] = useState(false);

    // Drag state
    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const [dragStartPos, setDragStartPos] = useState(null);
    const [hasDragged, setHasDragged] = useState(false);
    const DRAG_THRESHOLD = 5; // pixels before considering it a drag

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

    const getRoot = useCallback((id) => {
        let cur = id;
        const seen = new Set();
        while (parentOf.has(cur) && !seen.has(cur)) {
            seen.add(cur);
            cur = parentOf.get(cur);
        }
        return cur;
    }, [parentOf]);

    const rootId = useMemo(() => {
        if (focusedParentId) return focusedParentId;
        if (!activeConversationId) return null;
        return getRoot(activeConversationId);
    }, [activeConversationId, getRoot, focusedParentId]);

    // Get manual positions for current root
    const currentManualPositions = useMemo(() => {
        if (!rootId) return {};
        return manualPositions[rootId] || {};
    }, [rootId, manualPositions]);

    // Build subtree from rootId (BFS) with cluster support
    const { nodes, links, clusters } = useMemo(() => {
        if (!rootId || !byId.has(rootId)) return { nodes: [], links: [], clusters: [] };

        const q = [rootId];
        const depth = new Map([[rootId, 0]]);
        const order = [];
        const linksLocal = [];
        const clustersLocal = [];
        const processedAiNodes = new Set();

        // Track sibling index for angle distribution
        const siblingIndex = new Map();
        const siblingCount = new Map();

        while (q.length) {
            const u = q.shift();
            order.push(u);

            const kids = childrenOf.get(u) || [];
            const aiKids = kids.filter((k) => byId.get(k)?.isAiGenerated);
            const regularKids = kids.filter((k) => !byId.get(k)?.isAiGenerated);

            // Count total children for angle distribution
            const allKids = [...regularKids];

            // For focused view (cluster expansion), show all AI kids
            // Otherwise, cluster them if more than 1
            if (focusedParentId || aiKids.length <= 1) {
                allKids.push(...aiKids);
            }

            // Assign sibling indices for angle distribution
            allKids.forEach((kid, idx) => {
                siblingIndex.set(kid, idx);
                siblingCount.set(kid, allKids.length);
            });

            // Process regular children
            for (const v of regularKids) {
                if (!depth.has(v)) {
                    depth.set(v, depth.get(u) + 1);
                    q.push(v);
                    linksLocal.push({ from: u, to: v });
                }
            }

            // Handle AI-generated children
            if (aiKids.length > 0) {
                if (focusedParentId || aiKids.length === 1) {
                    // Show individual AI nodes (focused view or single node)
                    for (const v of aiKids) {
                        if (!depth.has(v) && !processedAiNodes.has(v)) {
                            depth.set(v, depth.get(u) + 1);
                            q.push(v);
                            linksLocal.push({ from: u, to: v });
                            processedAiNodes.add(v);
                        }
                    }
                } else {
                    // Create a cluster node (not in focused view)
                    const clusterId = `cluster-${u}`;
                    clustersLocal.push({
                        id: clusterId,
                        parentId: u,
                        count: aiKids.length,
                        childIds: aiKids,
                        depth: depth.get(u) + 1,
                    });
                    depth.set(clusterId, depth.get(u) + 1);
                    siblingIndex.set(clusterId, regularKids.length);
                    siblingCount.set(clusterId, regularKids.length + 1);
                    linksLocal.push({ from: u, to: clusterId, isCluster: true });
                    aiKids.forEach((k) => processedAiNodes.add(k));
                }
            }
        }

        const nodesLocal = order
            .map((id) => {
                const conv = byId.get(id);
                return {
                    id,
                    depth: depth.get(id) ?? 0,
                    title: conv?.title || "New Chat",
                    isAiGenerated: conv?.isAiGenerated || false,
                    generatedBy: conv?.generatedBy || null,
                    siblingIndex: siblingIndex.get(id) ?? 0,
                    siblingCount: siblingCount.get(id) ?? 1,
                };
            })
            .sort((a, b) => a.depth - b.depth);

        // Add cluster nodes to the nodes list
        for (const cluster of clustersLocal) {
            nodesLocal.push({
                id: cluster.id,
                depth: cluster.depth,
                title: `${cluster.count} ideas`,
                isCluster: true,
                count: cluster.count,
                parentId: cluster.parentId,
                childIds: cluster.childIds,
                siblingIndex: siblingIndex.get(cluster.id) ?? 0,
                siblingCount: siblingCount.get(cluster.id) ?? 1,
            });
        }

        return { nodes: nodesLocal, links: linksLocal, clusters: clustersLocal };
    }, [rootId, byId, childrenOf, focusedParentId]);

    // Destructure stable functions from layoutCache to avoid infinite loops
    // updateLayout is wrapped in useCallback with [] deps, so it's stable
    const { updateLayout, getPositions } = layoutCache || {};

    // Sync with layout cache
    useEffect(() => {
        if (updateLayout && rootId && nodes.length > 0) {
            updateLayout(rootId, nodes, links);
        }
    }, [updateLayout, rootId, nodes, links]);

    // Calculate positions using cache (stable angles) or fallback to local logic
    const autoPositioned = useMemo(() => {
        // Calculate max depth for ring sizing
        let maxDepth = 0;
        nodes.forEach(n => maxDepth = Math.max(maxDepth, n.depth));

        // Try to get positions from cache first
        if (getPositions && rootId) {
            const cachedPositions = getPositions(rootId, nodes, size, { compact });

            // If cache has positions for all nodes, use it
            if (cachedPositions.size > 0) {
                return { positions: cachedPositions, maxDepth };
            }
        }

        // Fallback: calculate positions locally (for initial render before cache is ready)
        const positions = new Map();
        if (nodes.length === 0) return { positions, maxDepth: 0 };

        const cx = size.w / 2;
        const cy = size.h / 2;
        const pad = compact ? 60 : 120;
        const maxR = Math.max(120, Math.min(size.w, size.h) / 2 - pad);
        const ringGap = maxDepth > 0 ? maxR / maxDepth : 0;

        // Group nodes by depth for angle calculation
        const byDepth = new Map();
        nodes.forEach(n => {
            if (!byDepth.has(n.depth)) byDepth.set(n.depth, []);
            byDepth.get(n.depth).push(n);
        });

        // Calculate positions for each node
        nodes.forEach(n => {
            if (n.depth === 0) {
                positions.set(n.id, { x: cx, y: cy });
            } else {
                const nodesAtDepth = byDepth.get(n.depth) || [];
                const idx = nodesAtDepth.indexOf(n);
                const count = nodesAtDepth.length;
                const angleStep = (2 * Math.PI) / Math.max(count, 1);
                const angle = angleStep * idx + (n.depth * 0.35); // phase offset per depth
                const r = Math.max(90, n.depth * ringGap);
                positions.set(n.id, {
                    x: cx + r * Math.cos(angle),
                    y: cy + r * Math.sin(angle)
                });
            }
        });

        return { positions, maxDepth };
    }, [getPositions, rootId, nodes, size, compact]);

    // SINGLE SOURCE OF TRUTH: Build finalPositions map once per render
    // This map is used for BOTH nodes AND links to ensure coordinate consistency
    const finalPositions = useMemo(() => {
        const out = new Map();
        const autoMap = autoPositioned.positions;

        nodes.forEach(n => {
            const id = n.id;
            const idStr = String(id);

            // 1) Check for manual override (normalized coords)
            const mp = currentManualPositions[idStr];
            if (mp && size.w > 0 && size.h > 0) {
                out.set(id, { x: mp.nx * size.w, y: mp.ny * size.h });
                return;
            }

            // 2) Fallback to auto position
            const ap = autoMap.get(id);
            if (ap) {
                out.set(id, ap);
            }
        });

        return out;
    }, [nodes, currentManualPositions, size.w, size.h, autoPositioned.positions]);

    // Helper to get position from the single source of truth
    const getPos = useCallback((id) => {
        return finalPositions.get(id);
    }, [finalPositions]);

    // Check if a node has manual position
    const hasManualPosition = useCallback((id) => {
        return !!currentManualPositions[String(id)];
    }, [currentManualPositions]);

    // Get connected node IDs for highlighting
    const getConnectedNodes = useCallback((nodeId) => {
        const connected = new Set([nodeId]);
        for (const link of links) {
            if (link.from === nodeId) connected.add(link.to);
            if (link.to === nodeId) connected.add(link.from);
        }
        return connected;
    }, [links]);

    const connectedToHovered = useMemo(() => {
        if (!hoveredNodeId) return new Set();
        return getConnectedNodes(hoveredNodeId);
    }, [hoveredNodeId, getConnectedNodes]);

    // Cluster expansion handler
    const handleClusterClick = useCallback((cluster) => {
        if (onExpandCluster) {
            onExpandCluster(cluster.parentId, cluster.childIds);
        }
    }, [onExpandCluster]);

    // Drag handlers
    const handlePointerDown = useCallback((e, nodeId) => {
        if (isLocked) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        setDraggingNodeId(nodeId);
        setDragStartPos({ x: e.clientX, y: e.clientY });
        setHasDragged(false);

        // Capture pointer for smooth dragging
        e.target.setPointerCapture(e.pointerId);
    }, [isLocked]);

    const handlePointerMove = useCallback((e) => {
        if (!draggingNodeId || !dragStartPos) return;

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Check if we've moved past threshold
        const dx = e.clientX - dragStartPos.x;
        const dy = e.clientY - dragStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > DRAG_THRESHOLD) {
            setHasDragged(true);
        }

        if (hasDragged || distance > DRAG_THRESHOLD) {
            // Calculate normalized position (0-1)
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Clamp to container bounds
            const nx = Math.max(0, Math.min(1, x / rect.width));
            const ny = Math.max(0, Math.min(1, y / rect.height));

            if (onMoveNode && rootId) {
                onMoveNode(rootId, draggingNodeId, nx, ny);
            }
        }
    }, [draggingNodeId, dragStartPos, hasDragged, onMoveNode, rootId]);

    const handlePointerUp = useCallback((e) => {
        if (e.target.hasPointerCapture?.(e.pointerId)) {
            e.target.releasePointerCapture(e.pointerId);
        }

        setDraggingNodeId(null);
        setDragStartPos(null);
        // Don't reset hasDragged here - let click handler check it
        setTimeout(() => setHasDragged(false), 0);
    }, []);

    const handleNodeClick = useCallback((e, nodeId, isCluster, clusterData) => {
        // Prevent navigation if we just dragged
        if (hasDragged) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (isCluster && clusterData) {
            handleClusterClick(clusterData);
        } else {
            onSelectConversation?.(nodeId);
        }
    }, [hasDragged, onSelectConversation, handleClusterClick]);

    // Reset positions for current root
    const handleResetPositions = useCallback(() => {
        if (rootId && onResetPositions) {
            onResetPositions(rootId);
        }
    }, [rootId, onResetPositions]);

    // Count manual positions for current root
    const manualPositionCount = Object.keys(currentManualPositions).length;

    return (
        <div
            ref={containerRef}
            className={`node-map ${compact ? 'node-map--compact' : ''} ${draggingNodeId ? 'is-dragging' : ''}`}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        >
            {/* Top controls */}
            {!compact && (
                <div className="node-map__toolbar">
                    {onNewChat && (
                        <button className="node-map__btn" onClick={onNewChat}>
                            + New Chat
                        </button>
                    )}

                    <button
                        className={`node-map__btn node-map__btn--toggle ${isLocked ? 'is-locked' : ''}`}
                        onClick={() => setIsLocked(!isLocked)}
                        title={isLocked ? 'Unlock to drag nodes' : 'Lock positions'}
                    >
                        {isLocked ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                            </svg>
                        )}
                        <span>{isLocked ? 'Locked' : 'Unlocked'}</span>
                    </button>

                    {manualPositionCount > 0 && (
                        <button
                            className="node-map__btn node-map__btn--reset"
                            onClick={handleResetPositions}
                            title="Reset all positions to auto layout"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                            </svg>
                            <span>Reset ({manualPositionCount})</span>
                        </button>
                    )}
                </div>
            )}

            {/* Links - SVG overlay using same coordinate system as nodes */}
            <svg
                className="node-map__svg"
                width={size.w}
                height={size.h}
                viewBox={`0 0 ${size.w} ${size.h}`}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
                <defs>
                    <linearGradient id="linkGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="rgba(110,168,255,0.55)" />
                        <stop offset="100%" stopColor="rgba(103,232,249,0.30)" />
                    </linearGradient>
                    <linearGradient id="linkGradientHighlight" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="rgba(110,168,255,0.85)" />
                        <stop offset="100%" stopColor="rgba(103,232,249,0.60)" />
                    </linearGradient>
                    <linearGradient id="clusterLinkGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="rgba(147,51,234,0.55)" />
                        <stop offset="100%" stopColor="rgba(236,72,153,0.30)" />
                    </linearGradient>

                    <filter id="linkGlow">
                        <feGaussianBlur stdDeviation="2.2" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="linkGlowHighlight">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {links.map((e) => {
                    const p1 = finalPositions.get(e.from);
                    const p2 = finalPositions.get(e.to);
                    if (!p1 || !p2) return null;

                    // Determine node radii for clipping (half of node width)
                    // Center nodes are larger (90px wide), clusters are smaller (55px), regular are 78px
                    const fromNode = nodes.find(n => n.id === e.from);
                    const toNode = nodes.find(n => n.id === e.to);

                    const getNodeRadius = (node) => {
                        if (!node) return 40;
                        if (node.depth === 0) return compact ? 70 : 90; // Center node
                        if (node.isCluster) return compact ? 40 : 55;   // Cluster node
                        return compact ? 60 : 78;                       // Regular node
                    };

                    const r1 = getNodeRadius(fromNode);
                    const r2 = getNodeRadius(toNode);

                    // Clip line to stop at node borders
                    const clipped = clipLineToNodeBorders(p1, p2, r1, r2);
                    if (!clipped) return null;

                    const isHighlighted = hoveredNodeId && (
                        e.from === hoveredNodeId || e.to === hoveredNodeId
                    );
                    const isClusterLink = e.isCluster;

                    return (
                        <line
                            key={`${e.from}-${e.to}`}
                            x1={clipped.x1}
                            y1={clipped.y1}
                            x2={clipped.x2}
                            y2={clipped.y2}
                            className={`node-map__link ${isHighlighted ? 'is-highlighted' : ''} ${isClusterLink ? 'is-cluster' : ''}`}
                            stroke={
                                isHighlighted
                                    ? "url(#linkGradientHighlight)"
                                    : isClusterLink
                                        ? "url(#clusterLinkGradient)"
                                        : "url(#linkGradient)"
                            }
                            filter={isHighlighted ? "url(#linkGlowHighlight)" : "url(#linkGlow)"}
                        />
                    );
                })}
            </svg>

            {/* Nodes - using same finalPositions as links for coordinate consistency */}
            <div className="node-map__nodes">
                {nodes.map((n) => {
                    const p = finalPositions.get(n.id);
                    if (!p) return null;

                    const isActive = n.id === activeConversationId;
                    const isCenter = n.depth === 0;
                    const isAiGenerated = n.isAiGenerated;
                    const isCluster = n.isCluster;
                    const isHovered = n.id === hoveredNodeId;
                    const isConnected = connectedToHovered.has(n.id) && !isHovered;
                    const isDimmed = hoveredNodeId && !connectedToHovered.has(n.id);
                    const isDragging = n.id === draggingNodeId;
                    const hasManual = hasManualPosition(n.id);

                    return (
                        <button
                            key={n.id}
                            onPointerDown={(e) => handlePointerDown(e, n.id)}
                            onClick={(e) => handleNodeClick(e, n.id, isCluster, isCluster ? n : null)}
                            onMouseEnter={() => !draggingNodeId && setHoveredNodeId(n.id)}
                            onMouseLeave={() => !draggingNodeId && setHoveredNodeId(null)}
                            title={
                                isCluster
                                    ? `Click to expand ${n.count} AI-generated ideas`
                                    : isAiGenerated
                                        ? `${n.title} (AI-generated by ${n.generatedBy})`
                                        : n.title
                            }
                            className={[
                                "node-map__node",
                                isCluster ? "is-cluster" : "",
                                isCenter ? "is-center" : "",
                                isActive ? "is-active" : "",
                                isAiGenerated ? "is-ai-generated" : "",
                                isHovered ? "is-hovered" : "",
                                isConnected ? "is-connected" : "",
                                isDimmed ? "is-dimmed" : "",
                                isDragging ? "is-dragging" : "",
                                hasManual ? "has-manual-position" : "",
                                compact ? "is-compact" : "",
                                !isLocked ? "is-draggable" : "",
                            ].filter(Boolean).join(" ")}
                            style={{
                                left: p.x,
                                top: p.y,
                            }}
                        >
                            {isCluster ? (
                                <>
                                    <span className="node-map__cluster-badge">{n.count}</span>
                                    <span className="node-map__title">Ideas</span>
                                </>
                            ) : (
                                <>
                                    {isAiGenerated && (
                                        <span className="node-map__ai-badge" title="AI-generated">
                                            *
                                        </span>
                                    )}
                                    <span className="node-map__title">
                                        {isCenter ? (n.title || "Chat") : n.title}
                                    </span>
                                </>
                            )}
                            {hasManual && !compact && (
                                <span className="node-map__manual-indicator" title="Manually positioned" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

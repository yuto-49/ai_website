import { useState, useCallback, useMemo, useRef } from 'react';

/**
 * Persistent Layout Cache for stable node positioning
 *
 * Stores polar coordinates (angle) and depth for each node,
 * ensuring stability across:
 * - Container resizes (expand/collapse chat panel)
 * - Incremental node additions (new ideas)
 */
export function useLayoutCache() {
  // Cache structure: { [rootId]: { version, nodes: { [nodeId]: { depth, angle, parentId, kind, createdAt } } } }
  const [cache, setCache] = useState({});
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  /**
   * Get or create layout data for a node
   */
  const getNodeLayout = useCallback((rootId, nodeId) => {
    const rootCache = cacheRef.current[rootId];
    if (!rootCache) return null;
    return rootCache.nodes[nodeId] || null;
  }, []);

  /**
   * Check if a node exists in the cache
   */
  const hasNode = useCallback((rootId, nodeId) => {
    return !!cacheRef.current[rootId]?.nodes[nodeId];
  }, []);

  /**
   * Initialize or update layout cache for a tree
   *
   * Strategy for stable angles:
   * - Existing nodes keep their angles
   * - New nodes are inserted into "gaps" in the ring
   * - If no gaps, nodes are added at the end of the ring
   */
  const updateLayout = useCallback((rootId, nodes, links) => {
    if (!rootId || nodes.length === 0) return;

    setCache((prevCache) => {
      const existingRoot = prevCache[rootId] || { version: 0, nodes: {} };
      const newNodes = { ...existingRoot.nodes };

      // Group nodes by depth
      const byDepth = new Map();
      for (const node of nodes) {
        if (!byDepth.has(node.depth)) byDepth.set(node.depth, []);
        byDepth.get(node.depth).push(node);
      }

      // Process each depth level
      for (const [depth, nodesAtDepth] of byDepth) {
        // Get existing nodes at this depth that still exist
        const existingAtDepth = nodesAtDepth.filter((n) => existingRoot.nodes[n.id]);
        const newAtDepth = nodesAtDepth.filter((n) => !existingRoot.nodes[n.id]);

        if (depth === 0) {
          // Root node always at center (angle doesn't matter, but we set 0)
          for (const node of nodesAtDepth) {
            if (!newNodes[node.id]) {
              newNodes[node.id] = {
                depth: 0,
                angle: 0,
                parentId: null,
                kind: 'root',
                createdAt: Date.now(),
              };
            }
          }
          continue;
        }

        // For non-root nodes, calculate stable angles
        const totalCount = nodesAtDepth.length;

        // Keep existing angles, assign new nodes to gaps
        const usedAngles = new Set();
        for (const node of existingAtDepth) {
          usedAngles.add(existingRoot.nodes[node.id].angle);
        }

        // Calculate ideal angle spacing
        const angleStep = (2 * Math.PI) / Math.max(totalCount, 1);

        // Assign angles to new nodes
        let nextAngleIndex = 0;
        for (const node of newAtDepth) {
          // Find next available angle slot
          let angle;
          let attempts = 0;
          do {
            angle = angleStep * nextAngleIndex + (depth * 0.35); // phase offset per depth
            nextAngleIndex++;
            attempts++;
          } while (usedAngles.has(angle) && attempts < totalCount * 2);

          // Determine node kind
          const kind = node.isAiGenerated ? 'ai' : 'topic';

          // Find parent from links
          const parentLink = links.find((l) => l.to === node.id);
          const parentId = parentLink ? parentLink.from : null;

          newNodes[node.id] = {
            depth,
            angle,
            parentId,
            kind,
            createdAt: Date.now(),
          };
        }
      }

      return {
        ...prevCache,
        [rootId]: {
          version: existingRoot.version + 1,
          nodes: newNodes,
        },
      };
    });
  }, []);

  /**
   * Get positions from cache (Cartesian coordinates)
   * This is called on every render and uses cached angles
   */
  const getPositions = useCallback((rootId, nodes, containerSize, options = {}) => {
    const { pad = 120 } = options;
    const positions = new Map();
    const rootCache = cacheRef.current[rootId];

    if (!rootCache || nodes.length === 0) return positions;

    const cx = containerSize.w / 2;
    const cy = containerSize.h / 2;

    // Calculate max depth from cached data
    let maxDepth = 0;
    for (const node of nodes) {
      const cached = rootCache.nodes[node.id];
      if (cached) maxDepth = Math.max(maxDepth, cached.depth);
    }

    // Calculate ring gap based on container size
    const maxR = Math.max(120, Math.min(containerSize.w, containerSize.h) / 2 - pad);
    const ringGap = maxDepth > 0 ? maxR / maxDepth : 0;

    for (const node of nodes) {
      const cached = rootCache.nodes[node.id];
      if (!cached) continue;

      if (cached.depth === 0) {
        // Root at center
        positions.set(node.id, { x: cx, y: cy });
      } else {
        // Use cached angle, calculate radius from current container size
        const r = Math.max(90, cached.depth * ringGap);
        const x = cx + r * Math.cos(cached.angle);
        const y = cy + r * Math.sin(cached.angle);
        positions.set(node.id, { x, y });
      }
    }

    return positions;
  }, []);

  /**
   * Clear cache for a specific root
   */
  const clearCache = useCallback((rootId) => {
    setCache((prev) => {
      const next = { ...prev };
      delete next[rootId];
      return next;
    });
  }, []);

  return useMemo(() => ({
    cache,
    getNodeLayout,
    hasNode,
    updateLayout,
    getPositions,
    clearCache,
  }), [cache, getNodeLayout, hasNode, updateLayout, getPositions, clearCache]);
}

export default useLayoutCache;

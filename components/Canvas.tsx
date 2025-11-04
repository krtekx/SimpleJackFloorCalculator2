import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Point, Wall, Tool, TileDimensions, Area, SnapType, SnapIndicatorInfo, MoveSelection, Tile, CutTilePiece, VisibilityMode } from '../types';
import { distance, getAngle, getLineIntersection, pointInPolygon, polygonIntersectsRectangle, rectanglesIntersect } from '../lib/geometry';

interface CanvasProps {
  areas: Area[];
  activeAreaIndex: number | null;
  activeTool: Tool;
  gridColor: string;
  gridThickness: number;
  gridDashScale: number;
  borderThickness: number;
  tileNumberFontSize: number;
  dimensionFontSize: number;
  hatchScale: number;
  snapModes: { grid: boolean; osnap: boolean; otrack: boolean };
  tileDimensions: TileDimensions;
  onAddPoint: (point: { x: number; y: number }) => void;
  onOpenWallEditDialog: (wallId: number, areaId: number) => void;
  onSelectArea: (areaId: number | null) => void;
  onAttemptClosePolygon: () => void;
  selectedAreaId: number | null;
  activeAngleSnap: number | null;
  activeLengthSnap: number | null;
  fitViewTrigger: number;
  zoomInTrigger: number;
  zoomOutTrigger: number;
  mousePos: { x: number; y: number; };
  onMouseMoveApp: (pos: { x: number, y: number }, snapPos: { x: number, y: number } | null) => void;
  snapIndicator: SnapIndicatorInfo | null;
  onSnapIndicatorChange: (indicator: SnapIndicatorInfo | null) => void;
  moveSelection: MoveSelection | null;
  onSelectForMove: (selection: MoveSelection, mousePos: { x: number; y: number }) => void;
  onMoveSelection: (currentMousePos: { x: number; y: number }, snappedMousePos: { x: number, y: number } | null) => void;
  onMoveSelectionEnd: () => void;
  wallBeingEditedId: number | null;
  wallEditPreview: { movingPointId: number; newPosition: { x: number; y: number } } | null;
  edgePanMargin: number;
  edgePanDelay: number;
  edgePanSpeed: number;
  tiles: Tile[];
  fieldPlacement: { width: number; height: number; rows: number; cols: number; } | null;
  onPlaceField: (pos: { x: number; y: number; }) => void;
  onAddTilesBatch: (tilesToAdd: Omit<Tile, 'id' | 'number'>[]) => void;
  startPoint: Point | null;
  isMoveColliding: boolean;
  onOpenTileEditDialog: (tile: Tile) => void;
  activeColor: string;
  isShiftPressed: boolean;
  onEraseBatch: (batch: Array<{ type: 'point' | 'wall' | 'area' | 'tile' | 'cutPiece'; id: number | string; areaId?: number }>) => void;
  onFillArea: (areaId: number) => void;
  isCutViewActive: boolean;
  cutPieces: CutTilePiece[] | null;
  visibilityMode: VisibilityMode;
}

const SNAP_DISTANCE = 20; // pixels for snapping to points
const HOVER_DISTANCE = 6; // pixels for hovering/selecting, reduced for precision
const TRACKING_TOLERANCE = 15; // pixels for tracking activation

interface TrackingLine {
  type: 'horizontal' | 'vertical' | 'extension';
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  sourceId: number; // ID of the point or wall that generated this line
}

interface SnapResult {
    pos: { x: number, y: number };
    type: SnapType;
}

export const Canvas: React.FC<CanvasProps> = ({
  areas, activeAreaIndex, activeTool, gridColor, gridThickness, gridDashScale, borderThickness, tileNumberFontSize, dimensionFontSize, hatchScale,
  snapModes, tileDimensions, onAddPoint,
  onOpenWallEditDialog, onSelectArea, onAttemptClosePolygon,
  activeAngleSnap, activeLengthSnap,
  fitViewTrigger, zoomInTrigger, zoomOutTrigger,
  mousePos, onMouseMoveApp,
  snapIndicator, onSnapIndicatorChange,
  moveSelection, onSelectForMove, onMoveSelection, onMoveSelectionEnd,
  wallBeingEditedId, wallEditPreview,
  selectedAreaId,
  edgePanMargin, edgePanDelay, edgePanSpeed,
  tiles, fieldPlacement, onPlaceField, onAddTilesBatch,
  startPoint,
  isMoveColliding,
  onOpenTileEditDialog,
  activeColor,
  isShiftPressed,
  onEraseBatch,
  onFillArea,
  isCutViewActive, cutPieces,
  visibilityMode
}) => {
  const [view, setView] = useState({ x: 0, y: 0, zoom: 0.5 });
  const targetViewRef = useRef({ x: 0, y: 0, zoom: 0.5 });
  const viewRef = useRef({ x: 0, y: 0, zoom: 0.5 });
  const autoPanVelocityRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const panDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredElement, setHoveredElement] = useState<{ type: 'point' | 'wall' | 'area' | 'tile' | 'cutPiece'; id: number | string; areaId?: number } | null>(null);
  const [hoveredMoveElement, setHoveredMoveElement] = useState<MoveSelection | null>(null);
  const [hoveredEditElement, setHoveredEditElement] = useState<{ type: 'wall' | 'tile'; id: number; areaId?: number } | null>(null);
  const [trackingGuides, setTrackingGuides] = useState<{ lines: TrackingLine[]; intersection: {x:number, y:number} | null }>({ lines: [], intersection: null });
  const [isPaintingTiles, setIsPaintingTiles] = useState(false);
  const [paintingBatch, setPaintingBatch] = useState<Omit<Tile, 'id' | 'number'>[]>([]);
  const [isErasing, setIsErasing] = useState(false);
  const [isShiftErasing, setIsShiftErasing] = useState(false);
  const [erasedPreviewKeys, setErasedPreviewKeys] = useState<Set<string>>(new Set());
  
  const svgRef = useRef<SVGSVGElement>(null);
  const areasRef = useRef(areas);
  const tilesRef = useRef(tiles);
  const cutPiecesRef = useRef(cutPieces);

  const visibleAreas = useMemo(() => areas.filter(a => a.isVisible), [areas]);
  const activeArea = useMemo(() => (activeAreaIndex !== null ? areas[activeAreaIndex] : null), [areas, activeAreaIndex]);
  const isDrawing = useMemo(() => activeArea !== null && !activeArea.isClosed, [activeArea]);
  const isFirstPoint = useMemo(() => areas.every(area => area.points.length === 0), [areas]);

  useEffect(() => {
    areasRef.current = areas;
    tilesRef.current = tiles;
    cutPiecesRef.current = cutPieces;
  }, [areas, tiles, cutPieces]);
  
  // Main animation loop for smooth view transitions
  useEffect(() => {
    const animate = () => {
        const LERP_FACTOR = 0.1;
        const STOP_THRESHOLD = 0.01;
        const ZOOM_STOP_THRESHOLD = 0.001;

        if (autoPanVelocityRef.current.x !== 0 || autoPanVelocityRef.current.y !== 0) {
            targetViewRef.current.x += autoPanVelocityRef.current.x;
            targetViewRef.current.y += autoPanVelocityRef.current.y;
        }

        const current = viewRef.current;
        const target = targetViewRef.current;

        current.x += (target.x - current.x) * LERP_FACTOR;
        current.y += (target.y - current.y) * LERP_FACTOR;
        current.zoom += (target.zoom - current.zoom) * LERP_FACTOR;

        if (Math.abs(target.x - current.x) < STOP_THRESHOLD) current.x = target.x;
        if (Math.abs(target.y - current.y) < STOP_THRESHOLD) current.y = target.y;
        if (Math.abs(target.zoom - current.zoom) < ZOOM_STOP_THRESHOLD) current.zoom = target.zoom;

        if (distance(current, view) > 0.01 || Math.abs(current.zoom - view.zoom) > 0.0001) {
            setView({ ...current });
        }
        
        animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };
  }, [view]);
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (panDelayTimerRef.current) {
        clearTimeout(panDelayTimerRef.current);
      }
    };
  }, []);

  const setViewTarget = useCallback((newTarget: Partial<{x:number, y:number, zoom: number}>) => {
    targetViewRef.current = { ...targetViewRef.current, ...newTarget };
  }, []);

  useEffect(() => {
    if (svgRef.current) {
      const canvasHeight = svgRef.current.clientHeight;
      const desiredVisibleHeight = 10 * tileDimensions.height;
      const calculatedZoom = canvasHeight / desiredVisibleHeight;
      const newZoom = Math.min(0.5, calculatedZoom);
      const initialView = {
        x: svgRef.current.clientWidth / 2,
        y: svgRef.current.clientHeight / 2,
        zoom: newZoom
      };
      setView(initialView);
      viewRef.current = initialView;
      targetViewRef.current = initialView;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const totalPoints = areas.reduce((sum, area) => sum + area.points.length, 0);
    if (totalPoints === 1 && svgRef.current) {
        const firstPoint = areas.find(a => a.points.length > 0)!.points[0];
        const { clientWidth, clientHeight } = svgRef.current;
        const newX = -firstPoint.x * viewRef.current.zoom + clientWidth / 2;
        const newY = -firstPoint.y * viewRef.current.zoom + clientHeight / 2;
        setViewTarget({ x: newX, y: newY });
    }
  }, [areas, setViewTarget]);
  
  useEffect(() => { if (zoomInTrigger > 0) setViewTarget({ zoom: Math.min(10, targetViewRef.current.zoom * 1.2) }); }, [zoomInTrigger, setViewTarget]);
  useEffect(() => { if (zoomOutTrigger > 0) setViewTarget({ zoom: Math.max(0.1, targetViewRef.current.zoom / 1.2) }); }, [zoomOutTrigger, setViewTarget]);

  const fitView = useCallback(() => {
    const currentAreas = areasRef.current;
    const currentTiles = tilesRef.current;
    const currentCutPieces = cutPiecesRef.current;

    let allPoints: Point[] = [];

    if (isCutViewActive && currentCutPieces) {
        allPoints = currentCutPieces.flatMap(piece => 
            piece.polygons.flatMap(poly => 
                poly.map(p => ({ id: -1, x: p.x + piece.x, y: p.y + piece.y }))
            )
        );
    } else {
        const areaPoints = currentAreas.flatMap(a => a.points);
        const tilePoints = currentTiles.flatMap(t => [
          { id: -1, x: t.x, y: t.y }, { id: -1, x: t.x + t.width, y: t.y + t.height }
        ]);
        allPoints = [...areaPoints, ...tilePoints];
    }

    if (allPoints.length === 0) { 
        setViewTarget({ 
            x: svgRef.current ? svgRef.current.clientWidth / 2 : 0, 
            y: svgRef.current ? svgRef.current.clientHeight / 2 : 0, 
            zoom: 0.5 
        }); 
        return; 
    }
    const svgBounds = svgRef.current?.getBoundingClientRect();
    if (!svgBounds || svgBounds.width === 0 || svgBounds.height === 0) return;

    const minX = Math.min(...allPoints.map(p => p.x)); const maxX = Math.max(...allPoints.map(p => p.x));
    const minY = Math.min(...allPoints.map(p => p.y)); const maxY = Math.max(...allPoints.map(p => p.y));

    const contentWidth = maxX - minX; const contentHeight = maxY - minY;
    const contentCenterX = minX + contentWidth / 2; const contentCenterY = minY + contentHeight / 2;
    if (contentWidth === 0 && contentHeight === 0) {
        const newX = -contentCenterX * 0.5 + svgBounds.width / 2; 
        const newY = -contentCenterY * 0.5 + svgBounds.height / 2;
        setViewTarget({ x: newX, y: newY, zoom: 0.5 }); return;
    }
    
    const PADDING = 100;
    const zoomX = (svgBounds.width - PADDING) / contentWidth; const zoomY = (svgBounds.height - PADDING) / contentHeight;
    const newZoom = Math.min(zoomX, zoomY, 5);
    const newX = -newZoom * contentCenterX + svgBounds.width / 2; const newY = -newZoom * contentCenterY + svgBounds.height / 2;
    setViewTarget({ x: newX, y: newY, zoom: newZoom });
  }, [setViewTarget, isCutViewActive]);

  useEffect(() => {
    if (fitViewTrigger > 0) {
      fitView();
    }
  }, [fitViewTrigger, fitView]);

  const getSVGPoint = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const transformed = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    return { x: transformed.x, y: transformed.y };
  }, []);
  
  const getFirstPointSnap = useCallback((pos: { x: number; y: number }): SnapResult => {
    const snapRadius = SNAP_DISTANCE / view.zoom;
    let bestSnap: { pos: { x: number; y: number }; dist: number; type: SnapType } = { pos: pos, dist: Infinity, type: 'none' };
    
    if (snapModes.osnap) {
        const allPoints = visibleAreas.flatMap(a => a.points);
        for (const p of allPoints) {
            const d = distance(pos, p);
            if (d < snapRadius && d < bestSnap.dist) bestSnap = { pos: p, dist: d, type: 'vertex' };
        }
        const allWalls = visibleAreas.flatMap(a => a.walls.map(w => ({ wall: w, points: a.points })));
        for (const { wall, points } of allWalls) {
            const p1 = points.find(p => p.id === wall.p1Id); const p2 = points.find(p => p.id === wall.p2Id);
            if (p1 && p2) {
                const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                const d = distance(pos, mid);
                if (d < snapRadius && d < bestSnap.dist) bestSnap = { pos: mid, type: 'midpoint', dist: d };
            }
        }
    }
    if (bestSnap.type === 'vertex' || bestSnap.type === 'midpoint') return { pos: bestSnap.pos, type: bestSnap.type };
    if (snapModes.grid) {
        const gridPos = { x: Math.round(pos.x / tileDimensions.width) * tileDimensions.width, y: Math.round(pos.y / tileDimensions.height) * tileDimensions.height };
        return { pos: gridPos, type: 'grid' };
    }
    return { pos, type: 'none' };
  }, [visibleAreas, tileDimensions.width, tileDimensions.height, view.zoom, snapModes]);

  const getSnappedPos = useCallback((pos: { x: number; y: number }): SnapResult => {
    const points = activeArea?.points || []; const lastPoint = points.length > 0 ? points[points.length - 1] : null;
    if (activeTool === 'WALL' && lastPoint && (activeAngleSnap !== null || activeLengthSnap !== null)) {
      const dx = pos.x - lastPoint.x; const dy = pos.y - lastPoint.y;
      let finalAngleRad = Math.atan2(dy, dx); let finalDist = Math.sqrt(dx * dx + dy * dy);
      if (activeAngleSnap !== null) {
          const snapAngleRad = activeAngleSnap * (Math.PI / 180); let baseAngleRad = 0;
          if (points.length >= 2) {
              const secondLastPoint = points[points.length - 2];
              baseAngleRad = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
          }
          let rawRelativeAngleRad = finalAngleRad - baseAngleRad;
          while (rawRelativeAngleRad <= -Math.PI) rawRelativeAngleRad += 2 * Math.PI;
          while (rawRelativeAngleRad > Math.PI) rawRelativeAngleRad -= 2 * Math.PI;
          const snappedRelativeAngleRad = Math.round(rawRelativeAngleRad / snapAngleRad) * snapAngleRad;
          finalAngleRad = baseAngleRad + snappedRelativeAngleRad;
      }
      if (activeLengthSnap !== null && activeLengthSnap > 0) finalDist = Math.round(finalDist / activeLengthSnap) * activeLengthSnap;
      if (finalDist === 0) return { pos: lastPoint, type: 'vertex' };
      return { pos: { x: lastPoint.x + finalDist * Math.cos(finalAngleRad), y: lastPoint.y + finalDist * Math.sin(finalAngleRad) }, type: 'extension' };
    }
    
    const snapRadius = SNAP_DISTANCE / view.zoom; let bestSnap: { pos: { x: number; y: number }; dist: number; type: SnapType } = { pos: pos, dist: Infinity, type: 'none' };
    if (snapModes.otrack && trackingGuides.intersection && distance(pos, trackingGuides.intersection) < snapRadius) bestSnap = { pos: trackingGuides.intersection, dist: distance(pos, trackingGuides.intersection), type: 'intersection' };
    if (snapModes.osnap) {
        const allPoints = visibleAreas.flatMap(a => a.points);
        for (const p of allPoints) {
            const d = distance(pos, p); if (d < snapRadius && d < bestSnap.dist) bestSnap = { pos: p, dist: d, type: 'vertex' };
        }
        const allWalls = visibleAreas.flatMap(a => a.walls.map(w => ({ wall: w, points: a.points })));
        for (const { wall, points } of allWalls) {
            const p1 = points.find(p => p.id === wall.p1Id); const p2 = points.find(p => p.id === wall.p2Id);
            if (p1 && p2) {
                const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }; const d = distance(pos, mid);
                if (d < snapRadius && d < bestSnap.dist) bestSnap = { pos: mid, type: 'midpoint', dist: d };
            }
        }
    }
    if (['intersection', 'vertex', 'midpoint'].includes(bestSnap.type)) return { pos: bestSnap.pos, type: bestSnap.type };
    if (snapModes.otrack && trackingGuides.lines.length > 0) {
        let bestLineSnapPos = null; let minSnapDist = snapRadius;
        for (const line of trackingGuides.lines) {
            const { p1, p2 } = line; const dx = p2.x - p1.x; const dy = p2.y - p1.y; if (dx === 0 && dy === 0) continue;
            const t = ((pos.x - p1.x) * dx + (pos.y - p1.y) * dy) / (dx * dx + dy * dy);
            const snapped = { x: p1.x + t * dx, y: p1.y + t * dy }; const dist = distance(pos, snapped);
            if (dist < minSnapDist) { minSnapDist = dist; bestLineSnapPos = snapped; }
        }
        if (bestLineSnapPos) return { pos: bestLineSnapPos, type: 'extension' };
    }
    if (snapModes.grid) {
        const gridPos = { x: Math.round(pos.x / tileDimensions.width) * tileDimensions.width, y: Math.round(pos.y / tileDimensions.height) * tileDimensions.height };
        return { pos: gridPos, type: 'grid' };
    }
    return { pos, type: 'none' };
  }, [activeArea, activeTool, activeAngleSnap, activeLengthSnap, visibleAreas, tileDimensions, view.zoom, trackingGuides, snapModes]);
  
  const addTileToPaintBatch = useCallback((pos: {x: number, y: number}) => {
    let finalPos: { x: number, y: number };
    const { width, height } = tileDimensions;

    if (snapModes.grid) {
        finalPos = {
            x: Math.floor(pos.x / width) * width,
            y: Math.floor(pos.y / height) * height,
        };
    } else {
        finalPos = {
            x: pos.x,
            y: pos.y - height,
        };
    }
    
    const newTileRect = { x: finalPos.x, y: finalPos.y, width, height };

    // Check against tiles in the current batch to prevent duplicates during a single drag action
    for (const batchTile of paintingBatch) {
        if (rectanglesIntersect(newTileRect, batchTile)) {
            return; // Collision
        }
    }

    setPaintingBatch(prev => [...prev, { ...newTileRect, color: activeColor }]);

  }, [snapModes.grid, tileDimensions, paintingBatch, activeColor]);
  
  const findHoveredTile = useCallback((pos: {x: number, y: number}) => {
      if (visibilityMode === 'floorPlanOnly') return null;
      for (const tile of tiles) {
          const { x, y, width, height } = tile;
          if (pos.x >= x && pos.x <= x + width && pos.y >= y && pos.y <= y + height) {
              return { type: 'tile' as const, id: tile.id };
          }
      }
      return null;
  }, [tiles, visibilityMode]);

  const findHoveredCutPiece = useCallback((pos: {x: number, y: number}) => {
      if (!cutPieces || visibilityMode === 'floorPlanOnly') return null;
      // Iterate in reverse to prioritize pieces on top
      for (let i = cutPieces.length - 1; i >= 0; i--) {
          const piece = cutPieces[i];
          const transformedOuterPolygon = piece.polygons[0].map(p => ({
              ...p,
              x: p.x + piece.x,
              y: p.y + piece.y
          }));
          
          if (pointInPolygon(pos, transformedOuterPolygon)) {
            // Basic check for holes - this isn't perfect for complex overlaps but works for selection
            let inHole = false;
            for (let j = 1; j < piece.polygons.length; j++) {
              const transformedHolePolygon = piece.polygons[j].map(p => ({
                ...p,
                x: p.x + piece.x,
                y: p.y + piece.y
              }));
              if (pointInPolygon(pos, transformedHolePolygon)) {
                inHole = true;
                break;
              }
            }
            if (!inHole) {
              return { type: 'cutPiece' as const, id: piece.id };
            }
          }
      }
      return null;
  }, [cutPieces, visibilityMode]);

  const findHoveredAreaComponent = useCallback((pos: {x: number, y: number}) => {
      if (visibilityMode === 'tilesOnly') return null;
      const hoverRadius = HOVER_DISTANCE / view.zoom;
      
      // Points first (higher priority)
      for (const area of visibleAreas) {
          for (const p of area.points) {
              if (distance(p, pos) < hoverRadius) {
                  return { type: 'point' as const, id: p.id, areaId: area.id };
              }
          }
      }

      // Then walls
      for (const area of visibleAreas) {
          for (const wall of area.walls) {
              const p1 = area.points.find(p => p.id === wall.p1Id);
              const p2 = area.points.find(p => p.id === wall.p2Id);
              if (!p1 || !p2) continue;
              
              const distToLine = (p: Point, v: Point, w: Point) => {
                  const l2 = Math.pow(distance(v, w), 2);
                  if (l2 === 0) return distance(p, v);
                  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
                  t = Math.max(0, Math.min(1, t));
                  const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
                  return distance(p, projection);
              };

              if (distToLine(pos as Point, p1, p2) < hoverRadius) {
                  return { type: 'wall' as const, id: wall.id, areaId: area.id };
              }
          }
      }

      // Then areas
      for (const area of visibleAreas) {
          if (area.isClosed && pointInPolygon(pos, area.points)) {
              return { type: 'area' as const, id: area.id, areaId: area.id };
          }
      }

      return null;
  }, [visibleAreas, view.zoom, visibilityMode]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const currentPos = getSVGPoint(e);

    if (isPaintingTiles) {
        addTileToPaintBatch(currentPos);
    }
    
    let currentHoveredElement: { type: 'point' | 'wall' | 'area' | 'tile' | 'cutPiece', id: number | string, areaId?: number } | null = null;
    if (isCutViewActive) {
      currentHoveredElement = findHoveredCutPiece(currentPos);
    } else {
      currentHoveredElement = isShiftPressed ? (findHoveredTile(currentPos) || findHoveredAreaComponent(currentPos)) : (findHoveredAreaComponent(currentPos) || findHoveredTile(currentPos));
    }

    if (isErasing && currentHoveredElement) {
        const key = `${currentHoveredElement.type}-${currentHoveredElement.id}${currentHoveredElement.areaId ? `-${currentHoveredElement.areaId}` : ''}`;
        if (!erasedPreviewKeys.has(key)) {
            setErasedPreviewKeys(prev => new Set(prev).add(key));
        }
    }

    if (isShiftErasing && !isCutViewActive) {
        const hoveredTile = findHoveredTile(currentPos);
        if (hoveredTile) {
            const key = `tile-${hoveredTile.id}`;
            if (!erasedPreviewKeys.has(key)) {
                setErasedPreviewKeys(prev => new Set(prev).add(key));
            }
        }
    }

    if (activeTool === 'WALL' && isDrawing && svgRef.current) {
        const { clientWidth, clientHeight } = svgRef.current;
        let vx = 0; let vy = 0;
        
        if (e.clientX < edgePanMargin) vx = edgePanSpeed / view.zoom;
        if (e.clientX > clientWidth - edgePanMargin) vx = -edgePanSpeed / view.zoom;
        if (e.clientY < edgePanMargin) vy = edgePanSpeed / view.zoom;
        if (e.clientY > clientHeight - edgePanMargin) vy = -edgePanSpeed / view.zoom;

        if (vx !== 0 || vy !== 0) {
            if (!panDelayTimerRef.current) {
                panDelayTimerRef.current = setTimeout(() => {
                    // Re-check conditions inside timeout in case mouse moved out
                    if (e.clientX < edgePanMargin || e.clientX > clientWidth - edgePanMargin || e.clientY < edgePanMargin || e.clientY > clientHeight - edgePanMargin) {
                         autoPanVelocityRef.current = { x: vx, y: vy };
                    }
                }, edgePanDelay);
            }
        } else {
            if (panDelayTimerRef.current) {
                clearTimeout(panDelayTimerRef.current);
                panDelayTimerRef.current = null;
            }
            autoPanVelocityRef.current = { x: 0, y: 0 };
        }
    } else {
         if (panDelayTimerRef.current) {
            clearTimeout(panDelayTimerRef.current);
            panDelayTimerRef.current = null;
        }
        autoPanVelocityRef.current = { x: 0, y: 0 };
    }

    let snapResult: SnapResult | null = null;
    if (activeTool === 'WALL' || activeTool === 'TILE' || (activeTool === 'MOVE' && moveSelection) || activeTool === 'PLACE_FIELD') {
      let snapPos: {x:number, y:number};
      if (activeTool === 'PLACE_FIELD' || !activeArea || activeArea.isClosed) {
          snapPos = getFirstPointSnap(currentPos).pos;
      }
      else {
        snapPos = getSnappedPos(currentPos).pos;
      }
      
      onMouseMoveApp(currentPos, snapPos);
      
      const snapType = getFirstPointSnap(currentPos).type;
      onSnapIndicatorChange({pos: snapPos, type: snapType});

    } else { 
      onSnapIndicatorChange(null); 
      onMouseMoveApp(currentPos, null);
    }
    const newGuides: { lines: TrackingLine[]; intersection: {x:number, y:number} | null } = { lines: [], intersection: null };
    if (snapModes.otrack && (activeTool === 'WALL' || (activeTool === 'MOVE' && moveSelection?.type === 'point')) && activeArea && activeArea.points.length > 0) {
        const tolerance = TRACKING_TOLERANCE / view.zoom; const allPoints = visibleAreas.flatMap(a => a.points); const allWalls = visibleAreas.flatMap(a => a.walls.map(w => ({...w, points: a.points})));
        let bestHLine: TrackingLine | null = null, bestVLine: TrackingLine | null = null, bestExtLine: TrackingLine | null = null;
        let minHDist = tolerance, minVDist = tolerance, minExtDist = tolerance;
        for (const p of allPoints) {
            const hDist = Math.abs(currentPos.y - p.y); if (hDist < minHDist) { minHDist = hDist; bestHLine = { type: 'horizontal', p1: { x: 0, y: p.y }, p2: { x: 1, y: p.y }, sourceId: p.id }; }
            const vDist = Math.abs(currentPos.x - p.x); if (vDist < minVDist) { minVDist = vDist; bestVLine = { type: 'vertical', p1: { x: p.x, y: 0 }, p2: { x: p.x, y: 1 }, sourceId: p.id }; }
        }
        for (const wall of allWalls) {
            const p1 = wall.points.find(p => p.id === wall.p1Id), p2 = wall.points.find(p => p.id === wall.p2Id); if (!p1 || !p2 || (p1.x === p2.x && p1.y === p2.y)) continue;
            const distToInfiniteLine = Math.abs((p2.x - p1.x) * (p1.y - currentPos.y) - (p1.x - currentPos.x) * (p2.y - p1.y)) / distance(p1, p2);
            if (distToInfiniteLine < minExtDist) { minExtDist = distToInfiniteLine; bestExtLine = { type: 'extension', p1, p2, sourceId: wall.id }; }
        }
        const candidates: (TrackingLine | null)[] = [bestHLine, bestVLine, bestExtLine];
        const activeLines = candidates.filter((line): line is TrackingLine => line !== null);
        if (activeLines.length > 0) {
            newGuides.lines = activeLines.slice(0, 2);
            if (newGuides.lines.length === 2) newGuides.intersection = getLineIntersection(newGuides.lines[0].p1, newGuides.lines[0].p2, newGuides.lines[1].p1, newGuides.lines[1].p2);
        }
    }
    setTrackingGuides(newGuides);
    
    // --- START of unified hover logic ---
    let foundElement: { type: 'point' | 'wall' | 'area' | 'tile' | 'cutPiece'; id: number | string; areaId?: number } | null = null;
    
    if (!isDragging && !isErasing && !isShiftErasing) {
        foundElement = currentHoveredElement;
    }
    setHoveredElement(foundElement);

    // Update tool-specific hover states
    if (activeTool === 'MOVE') {
        setHoveredMoveElement(foundElement as MoveSelection);
    } else if (hoveredMoveElement) {
        setHoveredMoveElement(null);
    }

    if (activeTool === 'POINTER' && !isCutViewActive) {
        if (foundElement?.type === 'wall' || foundElement?.type === 'tile') {
            setHoveredEditElement(foundElement as { type: 'wall' | 'tile'; id: number; areaId?: number });
        } else {
            setHoveredEditElement(null);
        }
    } else if (hoveredEditElement) {
        setHoveredEditElement(null);
    }
    // --- END of unified hover logic ---

    if (isDragging) {
      if (moveSelection) {
        const snapPos = getSnappedPos(currentPos).pos;
        onMoveSelection(currentPos, snapPos);
      } else {
        const dx = e.clientX - dragStart.x; const dy = e.clientY - dragStart.y;
        setViewTarget({ x: targetViewRef.current.x + dx, y: targetViewRef.current.y + dy });
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const svgPoint = getSVGPoint(e);
    if ((activeTool === 'PAN' && e.button === 0) || e.button === 1) { setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); return; }
    
    if (activeTool === 'ERASE') {
        setIsErasing(true);
        if (hoveredElement) {
            const key = `${hoveredElement.type}-${hoveredElement.id}${hoveredElement.areaId ? `-${hoveredElement.areaId}` : ''}`;
            setErasedPreviewKeys(new Set([key]));
        }
        return;
    }
    
    if (activeTool === 'MOVE' && hoveredMoveElement) { onSelectForMove(hoveredMoveElement, svgPoint); setIsDragging(true); }

    if (activeTool === 'TILE' && !isCutViewActive) {
      if (isShiftPressed) {
        setIsShiftErasing(true);
        const hoveredTile = findHoveredTile(svgPoint);
        if (hoveredTile) {
          const key = `tile-${hoveredTile.id}`;
          setErasedPreviewKeys(new Set([key]));
        }
      } else {
        e.preventDefault();
        setIsPaintingTiles(true);
        setPaintingBatch([]);
        addTileToPaintBatch(svgPoint);
      }
    }
  };
  
  const handleMouseUp = () => {
    if (isErasing) {
        setIsErasing(false);
        if (erasedPreviewKeys.size > 0) {
            const batchToErase: Array<{ type: 'point' | 'wall' | 'area' | 'tile' | 'cutPiece'; id: number | string; areaId?: number }> = [];
            erasedPreviewKeys.forEach(key => {
                const [type, idStr, areaIdStr] = key.split('-');
                const id = type === 'cutPiece' ? idStr : parseInt(idStr, 10);
                const areaId = areaIdStr ? parseInt(areaIdStr, 10) : undefined;
                batchToErase.push({ type: type as any, id, areaId });
            });
            onEraseBatch(batchToErase);
        }
        setErasedPreviewKeys(new Set());
    }

    if (isShiftErasing) {
        setIsShiftErasing(false);
        if (erasedPreviewKeys.size > 0) {
            const batchToErase: Array<{ type: 'point' | 'wall' | 'area' | 'tile'; id: number; areaId?: number }> = [];
            erasedPreviewKeys.forEach(key => {
                const [type, idStr, areaIdStr] = key.split('-');
                if (type === 'tile') {
                  const id = parseInt(idStr, 10);
                  const areaId = areaIdStr ? parseInt(areaIdStr, 10) : undefined;
                  batchToErase.push({ type: 'tile', id, areaId });
                }
            });
            onEraseBatch(batchToErase);
        }
        setErasedPreviewKeys(new Set());
    }
    
    if (isPaintingTiles) {
        setIsPaintingTiles(false);
        if (paintingBatch.length > 0) {
            onAddTilesBatch(paintingBatch);
        }
        setPaintingBatch([]);
    }
    if (isDragging) { 
        if (moveSelection) { onMoveSelectionEnd(); } 
        setIsDragging(false); 
    } 
  };
  const handleWheel = (e: React.WheelEvent) => { e.preventDefault(); const zoomFactor = 1.1; const newZoom = e.deltaY < 0 ? targetViewRef.current.zoom * zoomFactor : targetViewRef.current.zoom / zoomFactor; setViewTarget({ zoom: Math.max(0.1, Math.min(10, newZoom)) }); };

  const handleClick = (e: React.MouseEvent) => {
    if (activeTool === 'PAN' || e.button === 1 || isDragging) return;
    
    if (activeTool === 'ERASE' || (activeTool === 'TILE' && e.shiftKey)) {
        // Erase logic is handled by mousedown/mouseup to support drag-erase
        return;
    }

    if (activeTool === 'PLACE_FIELD') {
        const snappedPos = getFirstPointSnap(getSVGPoint(e)).pos;
        onPlaceField(snappedPos);
        return;
    }
    
    if (activeTool === 'TILE') {
      return;
    }

    if (activeTool === 'FILL') {
        const areaToFill = hoveredElement?.type === 'area' ? areas.find(a => a.id === hoveredElement.id) : null;
        if (areaToFill && areaToFill.isClosed) {
            onFillArea(areaToFill.id);
        }
        return;
    }

    if (activeTool === 'POINTER') {
      if (hoveredEditElement) {
        if (hoveredEditElement.type === 'wall' && hoveredEditElement.areaId) {
            onOpenWallEditDialog(hoveredEditElement.id, hoveredEditElement.areaId);
            return;
        } else if (hoveredEditElement.type === 'tile') {
            const tile = tiles.find(t => t.id === hoveredEditElement.id);
            if (tile) onOpenTileEditDialog(tile);
            return;
        }
      }
      
      // Fallback for clicking wall dimension labels
      let wallClicked = false;
      for (const area of visibleAreas) {
        for (const wall of area.walls) {
            const p1 = area.points.find(p => p.id === wall.p1Id), p2 = area.points.find(p => p.id === wall.p2Id); if (!p1 || !p2) continue;
            const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
            let displayAngle = angle; if (displayAngle > 90 || displayAngle < -90) displayAngle += 180;
            const clickPos = getSVGPoint(e);
            const labelWidth = (distance(p1,p2).toFixed(0).length * (dimensionFontSize / view.zoom) * 0.6);
            const labelHeight = dimensionFontSize / view.zoom;
            // Rough bounding box check for the label
            const labelBboxPoints = [
              {x: -labelWidth/2, y: -labelHeight - 8/view.zoom },
              {x: labelWidth/2, y: -labelHeight - 8/view.zoom },
              {x: labelWidth/2, y: -8/view.zoom },
              {x: -labelWidth/2, y: -8/view.zoom },
            ].map(p => {
              const rotatedX = p.x * Math.cos(displayAngle * Math.PI/180) - p.y * Math.sin(displayAngle * Math.PI/180);
              const rotatedY = p.x * Math.sin(displayAngle * Math.PI/180) + p.y * Math.cos(displayAngle * Math.PI/180);
              return { x: rotatedX + midX, y: rotatedY + midY };
            });
            
            if(pointInPolygon(clickPos, labelBboxPoints as Point[])) {
              onOpenWallEditDialog(wall.id, area.id);
              wallClicked = true;
              break;
            }
        }
        if(wallClicked) break;
      }
      return;
    }
    
    if (activeTool === 'WALL') {
      if (activeArea && activeArea.points.length > 2) {
          const firstPoint = activeArea.points[0]; const snapRadius = SNAP_DISTANCE / view.zoom;
          if (distance(mousePos, firstPoint) < snapRadius) { onAttemptClosePolygon(); return; }
      }
      let finalPos;
      if (isFirstPoint) finalPos = getFirstPointSnap(mousePos).pos;
      else finalPos = getSnappedPos(mousePos).pos;
      onAddPoint({ x: finalPos.x, y: finalPos.y });
    }
  };

  const renderGrid = useMemo(() => { const dashArray = gridDashScale > 0 ? `${gridDashScale / view.zoom} ${gridDashScale / view.zoom}` : 'none'; return (<pattern id="grid" width={tileDimensions.width} height={tileDimensions.height} patternUnits="userSpaceOnUse"><path d={`M ${tileDimensions.width} 0 L 0 0 0 ${tileDimensions.height}`} fill="none" stroke={gridColor} strokeWidth={gridThickness / view.zoom} strokeDasharray={dashArray}/></pattern>); }, [tileDimensions, gridColor, gridThickness, gridDashScale, view.zoom]);
  const renderHatchPatterns = useMemo(() => { return areas.map(area => (<pattern key={`hatch-${area.id}`} id={`hatch-${area.id}`} patternUnits="userSpaceOnUse" width={hatchScale} height={hatchScale}><path d={`M-1,1 l2,-2 M0,${hatchScale} l${hatchScale},-${hatchScale} M${hatchScale-1},${hatchScale+1} l2,-2`} stroke={area.color} strokeOpacity={0.3} strokeWidth={1} vectorEffect="non-scaling-stroke" /></pattern>)); }, [areas, hatchScale]);
  
  const renderPreviewLine = () => {
    if (activeTool !== 'WALL' || !isDrawing || !snapIndicator) return null;
    const points = activeArea.points;
    if (points.length === 0) return null;

    const lastPoint = points[points.length - 1];
    const snappedPos = snapIndicator.pos;
    const len = distance(lastPoint, snappedPos as Point);

    let angle: number;
    if (points.length >= 2) {
      const secondLastPoint = points[points.length - 2];
      const prevSegmentAngle = getAngle(secondLastPoint, lastPoint);
      const newSegmentAngle = getAngle(lastPoint, snappedPos as Point);
      angle = newSegmentAngle - prevSegmentAngle;
      if (angle > 180) angle -= 360;
      if (angle < -180) angle += 360;
    } else {
      angle = getAngle(lastPoint, snappedPos as Point);
    }
    const previewColor = '#22d3ee';
    return (
      <g className="pointer-events-none">
        <line
          x1={lastPoint.x}
          y1={lastPoint.y}
          x2={snappedPos.x}
          y2={snappedPos.y}
          stroke={previewColor}
          strokeOpacity="0.7"
          strokeWidth={2}
          strokeDasharray="4 2"
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={snappedPos.x + 10 / view.zoom}
          y={snappedPos.y}
          fill={previewColor}
          fontSize={12 / view.zoom}
          style={{ textShadow: '0 0 3px #000, 0 0 5px #000' }}
        >
          {len.toFixed(0)}mm, {angle.toFixed(0)}°
        </text>
      </g>
    );
  };
  
  const renderSnapIndicator = () => {
    if (!snapIndicator || snapIndicator.type === 'none') return null;
    const { pos, type } = snapIndicator; const size = 8 / view.zoom; const strokeColor = '#facc15';
    if (type === 'midpoint') {
      const s = size * 3; const pathData = `M ${pos.x},${pos.y - s*0.577} L ${pos.x + s*0.5},${pos.y + s*0.288} L ${pos.x - s*0.5},${pos.y + s*0.288} Z`;
      return <path d={pathData} stroke={strokeColor} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />;
    }
    if(moveSelection?.type === 'tile' || moveSelection?.type === 'cutPiece') return null;
    const d = size * 1.5; return <path d={`M ${pos.x - d},${pos.y - d} L ${pos.x + d},${pos.y + d} M ${pos.x - d},${pos.y + d} L ${pos.x + d},${pos.y - d}`} stroke={strokeColor} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />;
  };
  const renderTrackingGuides = () => {
    if (!svgRef.current) return null;
    const { x: vx, y: vy, zoom } = view; const viewWidth = svgRef.current.clientWidth / zoom, viewHeight = svgRef.current.clientHeight / zoom;
    const viewX1 = -vx / zoom, viewY1 = -vy / zoom, viewX2 = viewX1 + viewWidth, viewY2 = viewY1 + viewHeight; const guideColor = '#facc15';
    // Fix: Replaced undefined variables `d` and `strokeColor` with their correctly-scoped equivalents.
    return (<g> {trackingGuides.lines.map((line, index) => { let p1, p2; if (line.type === 'horizontal') { p1 = { x: viewX1, y: line.p1.y }; p2 = { x: viewX2, y: line.p1.y }; } else if (line.type === 'vertical') { p1 = { x: line.p1.x, y: viewY1 }; p2 = { x: line.p1.x, y: viewY2 }; } else { const { p1: lp1, p2: lp2 } = line; const dx = lp2.x - lp1.x; const dy = lp2.y - lp1.y; if (Math.abs(dx) > Math.abs(dy)) { p1 = { x: viewX1, y: lp1.y + (viewX1 - lp1.x) * dy / dx }; p2 = { x: viewX2, y: lp1.y + (viewX2 - lp1.x) * dy / dx }; } else { p1 = { x: lp1.x + (viewY1 - lp1.y) * dx / dy, y: viewY1 }; p2 = { x: lp1.x + (viewY2 - lp1.y) * dx / dy, y: viewY2 }; } } return <line key={`guide-${index}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={guideColor} strokeOpacity="0.6" strokeWidth={1} strokeDasharray={`4, ${4 / view.zoom}`} vectorEffect="non-scaling-stroke" />; })} {trackingGuides.intersection && (<path d={`M ${trackingGuides.intersection.x - 5 / view.zoom},${trackingGuides.intersection.y - 5 / view.zoom} L ${trackingGuides.intersection.x + 5 / view.zoom},${trackingGuides.intersection.y + 5 / view.zoom} M ${trackingGuides.intersection.x - 5 / view.zoom},${trackingGuides.intersection.y + 5 / view.zoom} L ${trackingGuides.intersection.x + 5 / view.zoom},${trackingGuides.intersection.y - (5 / view.zoom)}`} stroke={guideColor} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />)}</g>);
  };
  const renderWallEditPreview = () => {
    if (!wallBeingEditedId || !wallEditPreview) return null;
    const area = areas.find(a => a.walls.some(w => w.id === wallBeingEditedId)); if (!area) return;
    const wall = area.walls.find(w => w.id === wallBeingEditedId); if (!wall) return;
    const p1 = area.points.find(p => p.id === wall.p1Id); const p2 = area.points.find(p => p.id === wall.p2Id); if (!p1 || !p2) return null;
    const fixedPoint = p1.id === wallEditPreview.movingPointId ? p2 : p1; const { newPosition } = wallEditPreview; const previewColor = '#facc15';
    return (<g className="pointer-events-none"><line x1={fixedPoint.x} y1={fixedPoint.y} x2={newPosition.x} y2={newPosition.y} stroke={previewColor} strokeWidth={borderThickness + 2} strokeDasharray="8 4" vectorEffect="non-scaling-stroke" /><circle cx={newPosition.x} cy={newPosition.y} r={8 / view.zoom} fill="none" stroke={previewColor} strokeWidth={2} vectorEffect="non-scaling-stroke" /></g>);
  };

  const renderFieldPreview = () => {
    if (activeTool !== 'PLACE_FIELD' || !fieldPlacement) return null;
    const { width, height, rows, cols } = fieldPlacement;
    const totalWidth = cols * width;
    const totalHeight = rows * height;
    const placementPos = snapIndicator?.pos ?? mousePos;
    return (
        <g className="pointer-events-none" opacity="0.6">
            <rect 
                x={placementPos.x}
                y={placementPos.y - totalHeight}
                width={totalWidth}
                height={totalHeight}
                fill="none"
                stroke="#facc15"
                strokeWidth={2}
                strokeDasharray="4 2"
                vectorEffect="non-scaling-stroke"
            />
        </g>
    )
  };

  const renderTilePreview = () => {
    if (activeTool !== 'TILE' || fieldPlacement || isPaintingTiles) return null;
    
    let previewPos: { x: number, y: number };
    const currentPos = mousePos;
    
    if (snapModes.grid) {
        previewPos = {
            x: Math.floor(currentPos.x / tileDimensions.width) * tileDimensions.width,
            y: Math.floor(currentPos.y / tileDimensions.height) * tileDimensions.height,
        };
    } else {
        previewPos = {
            x: currentPos.x,
            y: currentPos.y - tileDimensions.height,
        };
    }

    return (
        <g className="pointer-events-none" opacity="0.6">
            <rect 
                x={previewPos.x}
                y={previewPos.y}
                width={tileDimensions.width}
                height={tileDimensions.height}
                fill="#facc1533"
                stroke="#facc15"
                strokeWidth={2}
                strokeDasharray="4 2"
                vectorEffect="non-scaling-stroke"
            />
        </g>
    )
  };

  const getCursorClassName = () => {
    if (activeTool === 'PAN') return isDragging ? 'cursor-grabbing' : 'cursor-grab';
    if (activeTool === 'MOVE') { if (isDragging && moveSelection) return 'cursor-grabbing'; if (hoveredMoveElement) return 'cursor-grab'; return 'cursor-move'; }
    if (activeTool === 'ERASE') return isErasing || hoveredElement ? 'cursor-not-allowed' : 'cursor-crosshair';
    if (activeTool === 'WALL') return 'cursor-crosshair';
    if (activeTool === 'PLACE_FIELD') return 'cursor-crosshair';
    if (activeTool === 'FILL') {
        const areaToFill = hoveredElement?.type === 'area' ? areas.find(a => a.id === hoveredElement.id) : null;
        return areaToFill && areaToFill.isClosed ? 'cursor-copy' : 'cursor-crosshair';
    }
    if (activeTool === 'TILE') return isShiftPressed ? 'cursor-not-allowed' : 'cursor-copy';
    if (activeTool === 'POINTER') {
        if (hoveredEditElement) return 'cursor-pointer';
        // Check if hovering over any dimension label first
        if (svgRef.current) {
            const clickPos = mousePos;
             for (const area of visibleAreas) {
                for (const wall of area.walls) {
                    const p1 = area.points.find(p => p.id === wall.p1Id), p2 = area.points.find(p => p.id === wall.p2Id); if (!p1 || !p2) continue;
                    const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
                    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
                    let displayAngle = angle; if (displayAngle > 90 || displayAngle < -90) displayAngle += 180;
                    const labelWidth = (distance(p1,p2).toFixed(0).length * (dimensionFontSize / view.zoom) * 0.6);
                    const labelHeight = dimensionFontSize / view.zoom;
                    const labelBboxPoints = [
                      {x: -labelWidth/2, y: -labelHeight - 8/view.zoom }, {x: labelWidth/2, y: -labelHeight - 8/view.zoom },
                      {x: labelWidth/2, y: -8/view.zoom }, {x: -labelWidth/2, y: -8/view.zoom },
                    ].map(p => {
                      const rotatedX = p.x * Math.cos(displayAngle * Math.PI/180) - p.y * Math.sin(displayAngle * Math.PI/180);
                      const rotatedY = p.x * Math.sin(displayAngle * Math.PI/180) + p.y * Math.cos(displayAngle * Math.PI/180);
                      return { x: rotatedX + midX, y: rotatedY + midY };
                    });
                    if(pointInPolygon(clickPos, labelBboxPoints as Point[])) return 'cursor-pointer';
                }
            }
        }
        return 'cursor-default';
    }
    return 'cursor-crosshair';
  };
  
  return (
    <div className={`flex-grow h-full bg-gray-800 overflow-hidden ${getCursorClassName()}`}>
      <svg ref={svgRef} className="w-full h-full" onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onClick={handleClick} onWheel={handleWheel} onMouseLeave={handleMouseUp} viewBox={`${-view.x / view.zoom} ${-view.y / view.zoom} ${window.innerWidth / view.zoom} ${window.innerHeight / view.zoom}`}>
        <defs> {renderGrid} {renderHatchPatterns} </defs>
        <rect x={-view.x/view.zoom - 100} y={-view.y/view.zoom - 100} width={window.innerWidth/view.zoom + 200} height={window.innerHeight/view.zoom + 200} fill="url(#grid)" />
        
        {(visibilityMode === 'both' || visibilityMode === 'floorPlanOnly') &&
          visibleAreas.map(area => {
            const areaKey = `area-${area.id}`;
            const isAreaSelectedForPointer = selectedAreaId === area.id;
            const isAreaSelectedForMove = moveSelection?.type === 'area' && moveSelection.id === area.id;
            const isAreaHoveredForDelete = hoveredElement?.type === 'area' && hoveredElement.id === area.id;
            const isAreaMarkedForDelete = erasedPreviewKeys.has(areaKey);
            const isAreaHoveredForMove = hoveredMoveElement?.type === 'area' && hoveredMoveElement.id === area.id;
            const highlightArea = isAreaSelectedForMove || isAreaHoveredForMove;
            const isAreaHoveredForFill = activeTool === 'FILL' && hoveredElement?.type === 'area' && hoveredElement.id === area.id && area.isClosed;

            return (
            <g key={`area-group-${area.id}`}>
                {area.isClosed && area.points.length > 2 && ( 
                  <polygon 
                    points={area.points.map(p => `${p.x},${p.y}`).join(' ')} 
                    fill={isAreaHoveredForDelete || isAreaMarkedForDelete ? '#ef444444' : isAreaHoveredForFill ? `${area.color}4D` : `url(#hatch-${area.id})`}
                    stroke={isAreaHoveredForFill ? area.color : 'none'}
                    strokeWidth={isAreaHoveredForFill ? 2 : 0}
                    vectorEffect="non-scaling-stroke"
                  /> 
                )}
                <g className="walls">
                {area.walls.map(wall => {
                    const wallKey = `wall-${wall.id}-${area.id}`;
                    const p1 = area.points.find(p => p.id === wall.p1Id), p2 = area.points.find(p => p.id === wall.p2Id); if (!p1 || !p2) return null;
                    const isSelectedForPointer = hoveredEditElement?.type === 'wall' && hoveredEditElement?.id === wall.id; const isSelectedForMove = moveSelection?.type === 'wall' && moveSelection.id === wall.id;
                    const isHoveredForDelete = hoveredElement?.type === 'wall' && hoveredElement.id === wall.id;
                    const isMarkedForDelete = erasedPreviewKeys.has(wallKey);
                    const isHoveredForMove = hoveredMoveElement?.type === 'wall' && hoveredMoveElement.id === wall.id;
                    const isBeingEdited = wall.id === wallBeingEditedId; let color = area.color;
                    if (isHoveredForDelete || isAreaHoveredForDelete || isMarkedForDelete || isAreaMarkedForDelete) color = '#ef4444';
                    else if (isSelectedForMove || isHoveredForMove || highlightArea || isSelectedForPointer) color = '#facc15';
                    return <line key={wall.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} className={`transition-all ${isSelectedForPointer ? 'glow' : ''}`} strokeWidth={isHoveredForDelete || isSelectedForPointer || isSelectedForMove || isHoveredForMove || highlightArea || isAreaSelectedForPointer || isAreaHoveredForDelete || isMarkedForDelete ? borderThickness + 2 : borderThickness} vectorEffect="non-scaling-stroke" strokeOpacity={isBeingEdited ? 0.3 : 1} />;
                })}
                </g>
                <g className="wall-labels">
                    {area.isClosed && area.walls.map(wall => {
                        const p1 = area.points.find(p => p.id === wall.p1Id), p2 = area.points.find(p => p.id === wall.p2Id); if (!p1 || !p2) return null;
                        const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
                        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                        const length = distance(p1, p2); 
                        let displayAngle = angle * (180 / Math.PI); 
                        if (displayAngle > 90 || displayAngle < -90) displayAngle += 180;
                        
                        const offsetAmount = 8 / view.zoom;
                        const testX = midX - Math.sin(angle) * (offsetAmount + 1);
                        const testY = midY + Math.cos(angle) * (offsetAmount + 1);
                        const isInside = pointInPolygon({ x: testX, y: testY }, area.points);
                        const finalOffset = isInside ? offsetAmount : -offsetAmount;

                        return <text key={`label-${wall.id}`} x={midX} y={midY} fill={area.color} fontSize={dimensionFontSize / view.zoom} textAnchor="middle" dominantBaseline="alphabetic" transform={`rotate(${displayAngle} ${midX} ${midY})`} dy={finalOffset}> {length.toFixed(0)} </text>;
                    })}
                </g>
                <g className="points">
                {area.points.map(p => {
                    const pointKey = `point-${p.id}-${area.id}`;
                    const isStartPointOfActiveDrawing = startPoint?.id === p.id && isDrawing;
                    const isHoveredForDelete = hoveredElement?.type === 'point' && hoveredElement.id === p.id;
                    const isMarkedForDelete = erasedPreviewKeys.has(pointKey);
                    const isSelectedForMove = moveSelection?.type === 'point' && moveSelection.id === p.id;
                    const isHoveredForMove = hoveredMoveElement?.type === 'point' && hoveredMoveElement.id === p.id; const isBeingEditedAndMoving = wallEditPreview?.movingPointId === p.id;
                    let pointColor = area.color;
                    let radius = isHoveredForDelete || isHoveredForMove || isMarkedForDelete ? 8 / view.zoom : 5 / view.zoom;
                    if (isHoveredForDelete || isAreaHoveredForDelete || isMarkedForDelete || isAreaMarkedForDelete) pointColor = '#ef4444';
                    else if (isSelectedForMove || isHoveredForMove || highlightArea) pointColor = '#facc15';
                    else if (isStartPointOfActiveDrawing) {
                        pointColor = '#ef4444';
                        radius = 8 / view.zoom;
                    }
                    return (
                        <g key={p.id}>
                          <circle cx={p.x} cy={p.y} r={radius} fill={pointColor} className="transition-all" strokeWidth={2} vectorEffect="non-scaling-stroke" fillOpacity={isBeingEditedAndMoving ? 0.3 : 1} />
                           {isStartPointOfActiveDrawing && (
                            <>
                              <path d={`M ${p.x - radius},${p.y} L ${p.x + radius},${p.y} M ${p.x},${p.y - radius} L ${p.x},${p.y + radius}`} stroke="#ffffff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                              <text 
                                x={p.x} 
                                y={p.y - radius - (5 / view.zoom)} 
                                fill="#ef4444" 
                                fontSize={12 / view.zoom} 
                                textAnchor="middle" 
                                dominantBaseline="alphabetic"
                                className="glow-text pointer-events-none"
                                style={{ textShadow: `0 0 5px #000` }}
                              >
                                START
                              </text>
                            </>
                          )}
                        </g>
                    );
                })}
                </g>
            </g>
        )})}
        
        {(visibilityMode === 'both' || visibilityMode === 'tilesOnly') && (
          isCutViewActive && cutPieces ? (
            <g>
              {cutPieces.map(piece => {
                const pieceKey = `cutPiece-${piece.id}`;
                const isHoveredForDelete = hoveredElement?.type === 'cutPiece' && hoveredElement.id === piece.id;
                const isMarkedForDelete = erasedPreviewKeys.has(pieceKey);
                const isSelectedForMove = moveSelection?.type === 'cutPiece' && moveSelection.id === piece.id;
                const isHoveredForMove = hoveredMoveElement?.type === 'cutPiece' && hoveredMoveElement.id === piece.id;

                let strokeColor: string = piece.originalTile.color;
                let fillColor: string = piece.isOffcut ? `${piece.originalTile.color}80` : `${piece.originalTile.color}4D`;
                let strokeWidth = 1;

                if (isHoveredForDelete || isMarkedForDelete) {
                  strokeColor = '#ef4444';
                  fillColor = '#ef444444';
                  strokeWidth = 2;
                } else if (isSelectedForMove || isHoveredForMove) {
                  strokeColor = '#facc15';
                  strokeWidth = 2;
                }

                const pathData = piece.polygons.map(poly => 
                    poly.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
                ).join(' ');

                const { originalTile } = piece;

                return (
                  <g key={piece.id} transform={`translate(${piece.x}, ${piece.y})`}>
                    <path
                      d={pathData}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      vectorEffect="non-scaling-stroke"
                      fillRule="evenodd"
                    />
                    {piece.isOffcut && piece.cutSegments && piece.cutSegments.map((segment, index) => (
                      <line
                          key={`cut-line-${index}`}
                          x1={segment[0].x}
                          y1={segment[0].y}
                          x2={segment[1].x}
                          y2={segment[1].y}
                          stroke="#ef4444"
                          strokeWidth={2}
                          vectorEffect="non-scaling-stroke"
                      />
                    ))}
                    {originalTile.number && (
                      <text
                          x={originalTile.width / 2}
                          y={originalTile.height / 2}
                          dy={piece.isOffcut ? 8 / view.zoom : 0}
                          fill={'#ffffff'}
                          opacity="0.8"
                          fontSize={tileNumberFontSize / view.zoom}
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="pointer-events-none"
                          style={{ paintOrder: 'stroke', stroke: '#00000099', strokeWidth: 2 / view.zoom }}
                      >
                          {originalTile.number.split('-')[1] || originalTile.number}
                      </text>
                    )}
                    {piece.isOffcut && (
                      <text
                          x={originalTile.width / 2}
                          y={originalTile.height / 2}
                          dy={-8 / view.zoom}
                          fill={'#ffffff'}
                          opacity="0.9"
                          fontSize={(tileNumberFontSize) / view.zoom}
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="pointer-events-none"
                          style={{ paintOrder: 'stroke', stroke: '#00000099', strokeWidth: 2 / view.zoom }}
                      >
                          {`${piece.wastePercentage.toFixed(1)}%`}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          ) : (
          <g>
            {paintingBatch.map((tile, index) => (
              <rect
                key={`batch-${index}`}
                x={tile.x}
                y={tile.y}
                width={tile.width}
                height={tile.height}
                fill={`${tile.color}66`}
                stroke={tile.color}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {tiles.map(tile => {
              const tileKey = `tile-${tile.id}`;
              const isHoveredForDelete = (hoveredElement?.type === 'tile' && hoveredElement.id === tile.id && activeTool === 'ERASE') || (isShiftErasing && findHoveredTile(mousePos)?.id === tile.id);
              const isMarkedForDelete = erasedPreviewKeys.has(tileKey);
              const isSelectedForMove = moveSelection?.type === 'tile' && moveSelection.id === tile.id;
              const isHoveredForMove = hoveredMoveElement?.type === 'tile' && hoveredMoveElement.id === tile.id;
              const isHoveredForEdit = hoveredEditElement?.type === 'tile' && hoveredEditElement.id === tile.id;
              
              let strokeColor = '#88888888';
              let fillColor = `${tile.color}4D`; // Add alpha for fill

              if (isHoveredForDelete || isMarkedForDelete) {
                strokeColor = '#ef4444';
                fillColor = '#ef444444';
              } else if (isSelectedForMove && isMoveColliding) {
                strokeColor = '#ef4444';
                fillColor = '#ef444499';
              } else if (isSelectedForMove || isHoveredForMove || isHoveredForEdit) {
                strokeColor = '#facc15';
              }
              
              return (
                <g key={`tile-group-${tile.id}`}>
                  <rect
                    x={tile.x}
                    y={tile.y}
                    width={tile.width}
                    height={tile.height}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isHoveredForDelete || isHoveredForMove || isSelectedForMove || isHoveredForEdit || isMarkedForDelete ? 2 : 1}
                    vectorEffect="non-scaling-stroke"
                  />
                  {tile.number && (
                    <text 
                      x={tile.x + tile.width / 2} 
                      y={tile.y + tile.height / 2} 
                      fill={'#ffffff'}
                      opacity="0.8" 
                      fontSize={tileNumberFontSize / view.zoom} 
                      fontWeight="bold" 
                      textAnchor="middle" 
                      dominantBaseline="middle"
                      className="pointer-events-none"
                      style={{ paintOrder: 'stroke', stroke: '#00000099', strokeWidth: 2 / view.zoom, strokeLinecap: 'butt', strokeLinejoin: 'miter' }}
                    > 
                      {tile.number.split('-')[1] || tile.number} 
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          )
        )}
        
        {renderPreviewLine()}
        {activeTool !== 'PAN' && <>{renderTrackingGuides()} {renderSnapIndicator()}</>}
        {renderWallEditPreview()}
        {renderFieldPreview()}
        {renderTilePreview()}
        {isFirstPoint && activeTool === 'WALL' && (
           <g className="pointer-events-none" style={{transform: `translate(${mousePos.x}px, ${mousePos.y}px)`}}>
             <g style={{transform: `scale(${1 / view.zoom})`}}>
                <path d="M -10 -10 L 10 10 M 10 -10 L -10 10" stroke="#ef4444" strokeWidth="2.5" />
                <circle cx="0" cy="0" r="6" fill="none" stroke="#ef4444" strokeWidth="2" />
             </g>
           </g>
        )}
      </svg>
    </div>
  );
};
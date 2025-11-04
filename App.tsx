import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Point, Wall, Tool, TileDimensions, Area, HistoryState, SnapIndicatorInfo, MoveSelection, Tile, TILE_COLORS, CutTilePiece, COLOR_NAMES, VisibilityMode, CalculationResult } from './types';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Canvas } from './components/Canvas';
import { Dialog } from './components/Dialog';
import { StatsPanel } from './components/StatsPanel';
import { pointInPolygon, polygonArea, polygonIntersectsRectangle, polygonPerimeter, distance, rectanglesIntersect, clipPolygonByPolygon } from './lib/geometry';
import { InputDialog } from './components/InputDialog';
import { SnapToolbar } from './components/SnapToolbar';
import { SnapSettingsDialog } from './components/SnapSettingsDialog';
import { WallEditDialog } from './components/WallEditDialog';
import { FieldDialog } from './components/TileGridDialog';
import { TileEditDialog } from './components/TileEditDialog';
import { VersionInfo } from './components/VersionInfo';
import { GitHubDialog } from './components/GitHubDialog';

const AREA_COLORS = ['#06b6d4', '#f59e0b', '#84cc16', '#ec4899', '#f43f5e', '#6366f1'];

const INITIAL_STATE = {
    areas: [] as Area[],
    activeTool: 'WALL' as Tool,
    gridColor: '#FFFFFF33',
    gridThickness: 0.9,
    gridDashScale: 9,
    borderThickness: 4,
    tileNumberFontSize: 14,
    dimensionFontSize: 12,
    hatchScale: 15,
    tileDimensions: { width: 465, height: 465 },
    selectedWallId: null,
    snapModes: { grid: true, osnap: true, otrack: true },
};

const INITIAL_HISTORY_STATE: HistoryState = {
    areas: INITIAL_STATE.areas,
    tiles: [],
}

interface MoveSnapshot {
    selection: MoveSelection;
    initialMousePos: { x: number; y: number };
    initialPoints: (Point | Tile | CutTilePiece)[];
}

const getNextAreaName = (areas: Area[]): string => {
  const existingNumbers = areas
    .map(area => {
      const match = area.name.match(/^Area (\d+)$/);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
      return null;
    })
    .filter((num): num is number => num !== null);

  if (existingNumbers.length === 0) {
    return 'Area 1';
  }

  const numberSet = new Set(existingNumbers);
  let nextNumber = 1;
  while (numberSet.has(nextNumber)) {
    nextNumber++;
  }
  
  return `Area ${nextNumber}`;
};

const renumberTilesByColor = (tiles: Tile[]): Tile[] => {
    const tilesByColor: Record<string, Tile[]> = {};

    // Group tiles by color
    for (const tile of tiles) {
        if (tile.number === null) continue;
        if (!tilesByColor[tile.color]) {
            tilesByColor[tile.color] = [];
        }
        tilesByColor[tile.color].push(tile);
    }

    const unnumberedTiles = tiles.filter(t => t.number === null);
    const allRenumberedTiles: Tile[] = [];

    // Sort and re-number each color group
    for (const color in tilesByColor) {
        const colorPrefix = TILE_COLORS.indexOf(color);
        
        const sortedTiles = tilesByColor[color].sort((a, b) => a.y - b.y || a.x - b.x); // Sort by position: top-to-bottom, then left-to-right
        
        const renumberedGroup = sortedTiles.map((tile, index) => ({
            ...tile,
            number: `${colorPrefix}-${index + 1}`
        }));
        allRenumberedTiles.push(...renumberedGroup);
    }
    
    // Combine numbered and unnumbered tiles, preserving original order
    const renumberedMap = new Map(allRenumberedTiles.map(t => [t.id, t]));
    const finalTiles = tiles.map(t => renumberedMap.get(t.id) || t);

    return finalTiles;
};

const isPolygonClockwise = (polygon: Point[]): boolean => {
    let sum = 0;
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
        sum += (p2.x - p1.x) * (p2.y + p1.y);
    }
    return sum > 0;
};

const arePointsCollinear = (p1: Point, p2: Point, p3: Point, epsilon = 1e-6): boolean => {
    const area = p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y);
    return Math.abs(area) < epsilon;
};

const isPointOnSegment = (p: Point, a: Point, b: Point, epsilon = 1e-6): boolean => {
    return arePointsCollinear(a, b, p, epsilon) &&
           Math.min(a.x, b.x) - epsilon <= p.x && p.x <= Math.max(a.x, b.x) + epsilon &&
           Math.min(a.y, b.y) - epsilon <= p.y && p.y <= Math.max(a.y, b.y) + epsilon;
};

const isSegmentOnTileBoundary = (segment: Point[], tile: Tile): boolean => {
    const [p1, p2] = segment;
    const { x, y, width, height } = tile;
    const tileEdges = [
        [{id: -1, x: x, y: y}, {id: -1, x: x + width, y: y}], // Top
        [{id: -1, x: x + width, y: y}, {id: -1, x: x + width, y: y + height}], // Right
        [{id: -1, x: x + width, y: y + height}, {id: -1, x: x, y: y + height}], // Bottom
        [{id: -1, x: x, y: y + height}, {id: -1, x: x, y: y}] // Left
    ];

    for (const edge of tileEdges) {
        const [e1, e2] = edge;
        if (isPointOnSegment(p1, e1, e2) && isPointOnSegment(p2, e1, e2)) {
            return true;
        }
    }
    return false;
};


export function App() {
  const [areas, setAreas] = useState<Area[]>(INITIAL_STATE.areas);
  const [activeAreaIndex, setActiveAreaIndex] = useState<number | null>(null);
  
  const [activeTool, setActiveTool] = useState<Tool>(INITIAL_STATE.activeTool);
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>('both');
  const [gridColor, setGridColor] = useState(INITIAL_STATE.gridColor);
  const [gridThickness, setGridThickness] = useState(INITIAL_STATE.gridThickness);
  const [gridDashScale, setGridDashScale] = useState(INITIAL_STATE.gridDashScale);
  const [borderThickness, setBorderThickness] = useState(INITIAL_STATE.borderThickness);
  const [tileNumberFontSize, setTileNumberFontSize] = useState(INITIAL_STATE.tileNumberFontSize);
  const [dimensionFontSize, setDimensionFontSize] = useState(INITIAL_STATE.dimensionFontSize);
  const [hatchScale, setHatchScale] = useState(INITIAL_STATE.hatchScale);
  const [tileDimensions, setTileDimensions] = useState<TileDimensions>(INITIAL_STATE.tileDimensions);
  const [isTileRatioLocked, setIsTileRatioLocked] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [snapModes, setSnapModes] = useState(INITIAL_STATE.snapModes);
  const [isClosePolygonDialogOpen, setClosePolygonDialogOpen] = useState(false);
  const [activeAngleSnap, setActiveAngleSnap] = useState<number | null>(null);
  const [activeLengthSnap, setActiveLengthSnap] = useState<number | null>(null);
  const [isStatsPanelOpen, setStatsPanelOpen] = useState(false);
  const [isSnapSettingsOpen, setSnapSettingsOpen] = useState(false);
  const [fitViewTrigger, setFitViewTrigger] = useState(0);
  const [zoomInTrigger, setZoomInTrigger] = useState(0);
  const [zoomOutTrigger, setZoomOutTrigger] = useState(0);
  const [zoomInFlash, setZoomInFlash] = useState(0);
  const [zoomOutFlash, setZoomOutFlash] = useState(0);
  const [fitViewFlash, setFitViewFlash] = useState(0);
  const [deleteAreaConfirmInfo, setDeleteAreaConfirmInfo] = useState<{ areaId: number; areaName: string; } | null>(null);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const [isAreaSummaryExpanded, setAreaSummaryExpanded] = useState(false);
  const [edgePanMargin, setEdgePanMargin] = useState(8);
  const [edgePanDelay, setEdgePanDelay] = useState(200);
  const [edgePanSpeed, setEdgePanSpeed] = useState(0.1);


  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [snappedMousePos, setSnappedMousePos] = useState<{x:number, y:number} | null>(null);
  const [snapIndicator, setSnapIndicator] = useState<SnapIndicatorInfo | null>(null);
  const [isLengthDialogOpen, setLengthDialogOpen] = useState(false);
  const [lengthEntryAngle, setLengthEntryAngle] = useState(0); // in radians
  const [moveSelection, setMoveSelection] = useState<MoveSelection | null>(null);
  const [moveSnapshot, setMoveSnapshot] = useState<MoveSnapshot | null>(null);
  const [wallEditInfo, setWallEditInfo] = useState<{ wallId: number; areaId: number } | null>(null);
  const [wallEditPreview, setWallEditPreview] = useState<{ movingPointId: number; newPosition: { x: number; y: number } } | null>(null);
  
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [isFieldDialogOpen, setIsFieldDialogOpen] = useState(false);
  const [fieldPlacement, setFieldPlacement] = useState<{ width: number; height: number; rows: number; cols: number; } | null>(null);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [isMoveColliding, setIsMoveColliding] = useState(false);
  const [activeColor, setActiveColor] = useState<string>(TILE_COLORS[5]);
  const [editingTile, setEditingTile] = useState<Tile | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  // CUT feature state
  const [isCutViewActive, setIsCutViewActive] = useState(false);
  const [preCutState, setPreCutState] = useState<{ areas: Area[], tiles: Tile[] } | null>(null);
  const [cutPieces, setCutPieces] = useState<CutTilePiece[] | null>(null);
  const [wasteDeletionPrompt, setWasteDeletionPrompt] = useState<{ allPieces: CutTilePiece[]; piecesToDeleteIds: string[] } | null>(null);

  // GitHub state
  const [isGitHubDialogOpen, setIsGitHubDialogOpen] = useState(false);
  const [githubRepoUrl, setGithubRepoUrl] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryState[]>([INITIAL_HISTORY_STATE]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [restorePromptData, setRestorePromptData] = useState<any | null>(null);
  const previousToolRef = useRef<Tool | null>(null);
  
  useEffect(() => {
    const savedDataString = localStorage.getItem('simplejack_autosave');
    if (savedDataString) {
      try {
        const parsedData = JSON.parse(savedDataString);
        if (parsedData && parsedData.version === "1.0" && Array.isArray(parsedData.areas) && parsedData.settings) {
          if (parsedData.settings.githubRepoUrl) {
            setGithubRepoUrl(parsedData.settings.githubRepoUrl);
          }
          setRestorePromptData(parsedData);
        } else {
          localStorage.removeItem('simplejack_autosave');
        }
      } catch (e) {
        console.error("Failed to parse autosaved data:", e);
        localStorage.removeItem('simplejack_autosave');
      }
    }
  }, []);

  useEffect(() => {
    if (restorePromptData) {
      return;
    }

    const stateToSave = {
      version: "1.0",
      areas,
      tiles,
      settings: {
        gridColor, gridThickness, gridDashScale, borderThickness,
        tileNumberFontSize, dimensionFontSize, hatchScale,
        tileDimensions, isTileRatioLocked, githubRepoUrl
      }
    };

    const handler = setTimeout(() => {
        if(areas.length === 0 && tiles.length === 0) {
            localStorage.removeItem('simplejack_autosave');
        } else {
            localStorage.setItem('simplejack_autosave', JSON.stringify(stateToSave));
        }
    }, 1000);

    return () => {
      clearTimeout(handler);
    };
  }, [
    areas, tiles, gridColor, gridThickness, gridDashScale, borderThickness,
    tileNumberFontSize, dimensionFontSize, hatchScale, tileDimensions,
    isTileRatioLocked, restorePromptData, githubRepoUrl
  ]);

  const recordHistory = (newAreas: Area[], newTiles: Tile[]) => {
    if (isCutViewActive) return;
    const newHistoryState: HistoryState = { 
      areas: JSON.parse(JSON.stringify(newAreas)),
      tiles: JSON.parse(JSON.stringify(newTiles)),
    };
    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, newHistoryState]);
    setHistoryIndex(newHistory.length);
  };
  
  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && !isCutViewActive) {
      const newIndex = historyIndex - 1;
      const prevState = history[newIndex];
      setAreas(prevState.areas);
      setTiles(prevState.tiles);
      setHistoryIndex(newIndex);
      const currentActiveArea = prevState.areas.findIndex(a => !a.isClosed);
      setActiveAreaIndex(currentActiveArea !== -1 ? currentActiveArea : null);
    }
  }, [history, historyIndex, isCutViewActive]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1 && !isCutViewActive) {
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];
      setAreas(nextState.areas);
      setTiles(nextState.tiles);
      setHistoryIndex(newIndex);
      const currentActiveArea = nextState.areas.findIndex(a => !a.isClosed);
      setActiveAreaIndex(currentActiveArea !== -1 ? currentActiveArea : null);
    }
  }, [history, historyIndex, isCutViewActive]);

  const activeArea = useMemo(() => activeAreaIndex !== null ? areas[activeAreaIndex] : null, [areas, activeAreaIndex]);

  const isDrawing = useMemo(() => activeArea !== null && !activeArea.isClosed, [activeArea]);
  
  const isFirstPoint = useMemo(() => {
    return areas.every(area => area.points.length === 0);
  }, [areas]);

  const totalArea = useMemo(() => {
    return areas.reduce((total, area) => {
      if (area.isClosed && area.isVisible && area.calculationResult) {
        return total + area.calculationResult.polygonArea;
      }
      return total;
    }, 0);
  }, [areas]);

  const totalTilesArea = useMemo(() => {
    return tiles.length * tileDimensions.width * tileDimensions.height;
  }, [tiles, tileDimensions]);

  const handleToolChange = (tool: Tool) => {
    if (isCutViewActive && !['PAN', 'MOVE', 'ERASE', 'POINTER'].includes(tool)) return;
    const newTool = activeTool === tool ? 'POINTER' : tool;
    setActiveTool(newTool);

    if (newTool !== 'POINTER') {
      setSelectedAreaId(null);
    }
  };


  const isMasterSnapOn = useMemo(() => {
      if (activeAngleSnap !== null || activeLengthSnap !== null) return false;
      return snapModes.grid && snapModes.osnap && snapModes.otrack;
  }, [snapModes, activeAngleSnap, activeLengthSnap]);

  useEffect(() => {
    if (activeAngleSnap !== null || activeLengthSnap !== null) {
        if (snapModes.grid || snapModes.osnap || snapModes.otrack) {
            setSnapModes({ grid: false, osnap: false, otrack: false });
        }
    }
  }, [activeAngleSnap, activeLengthSnap, snapModes.grid, snapModes.osnap, snapModes.otrack]);

  const handleToggleMasterSnap = () => {
    const newMasterState = !isMasterSnapOn;
    setSnapModes({ grid: newMasterState, osnap: newMasterState, otrack: newMasterState });
    setActiveAngleSnap(null);
    setActiveLengthSnap(null);
  };

  const handleToggleSnapMode = (mode: 'grid' | 'osnap' | 'otrack') => {
    setSnapModes(prev => {
        const newModes = { ...prev, [mode]: !prev[mode] };
        if (newModes.grid || newModes.osnap || newModes.otrack) {
            setActiveAngleSnap(null);
            setActiveLengthSnap(null);
        }
        return newModes;
    });
  };

  const handleTileDimensionsChange = (newDims: Partial<TileDimensions>) => {
    setTileDimensions(prevDims => {
        let updatedWidth = newDims.width ?? prevDims.width;
        let updatedHeight = newDims.height ?? prevDims.height;

        if (isTileRatioLocked && (prevDims.width > 0 && prevDims.height > 0)) {
            const ratio = prevDims.width / prevDims.height;
            if (newDims.width !== undefined && newDims.width !== prevDims.width) {
                updatedHeight = Math.round(updatedWidth / ratio);
            } else if (newDims.height !== undefined && newDims.height !== prevDims.height) {
                updatedWidth = Math.round(updatedHeight * ratio);
            }
        }
        
        updatedWidth = Math.max(1, updatedWidth);
        updatedHeight = Math.max(1, updatedHeight);

        return { width: updatedWidth, height: updatedHeight };
    });
  };
  
  const handleCycleVisibilityMode = () => {
    setVisibilityMode(currentMode => {
        if (currentMode === 'both') return 'tilesOnly';
        if (currentMode === 'tilesOnly') return 'floorPlanOnly';
        return 'both';
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      
      if (e.key === ' ') {
        e.preventDefault();
        if (activeTool !== 'PAN') {
            previousToolRef.current = activeTool;
            setActiveTool('PAN');
        }
        return;
      }
    
      if(e.key !== 'Shift') e.preventDefault();
      
      switch (e.key.toLowerCase()) {
        case 'd': if (!isCutViewActive) handleToolChange('WALL'); break;
        case 'm': handleToolChange('MOVE'); break;
        case 'e': handleToolChange('POINTER'); break;
        case 'x': handleToolChange('ERASE'); break;
        case 'p': 
          setSnapSettingsOpen(true);
          if (!isCutViewActive) {
            setActiveTool('PAN');
          }
          break;
        case 'a': setAreaSummaryExpanded(p => !p); break;
        case 'c':
          if (activeTool === 'WALL' && activeArea && !activeArea.isClosed && activeArea.points.length >= 3) {
            setClosePolygonDialogOpen(true);
          }
          break;
        case 'l':
          if (activeTool === 'WALL' && activeArea && !activeArea.isClosed && activeArea.points.length > 0) {
            const lastPoint = activeArea.points[activeArea.points.length - 1];
            // Use snapped position for direction if available, otherwise use raw mouse position
            const targetPos = snapIndicator ? snapIndicator.pos : mousePos;
            const angle = Math.atan2(targetPos.y - lastPoint.y, targetPos.x - lastPoint.x);
            setLengthEntryAngle(angle);
            setLengthDialogOpen(true);
          }
          break;
        case 'arrowup': setZoomInTrigger(t => t + 1); setZoomInFlash(t => t + 1); break;
        case 'arrowdown': setZoomOutTrigger(t => t + 1); setZoomOutFlash(t => t + 1); break;
        case 'f': setFitViewTrigger(prev => prev + 1); setFitViewFlash(t => t + 1); break;
        case 'u': handleUndo(); break;
        case 'r': handleRedo(); break;
        case 's': handleToggleMasterSnap(); break;
        case 'g': handleToggleSnapMode('grid'); break;
        case 'o': handleToggleSnapMode('osnap'); break;
        case 't': handleToggleSnapMode('otrack'); break;
        case 'v': handleCycleVisibilityMode(); break;
        default: break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'Shift') {
          setIsShiftPressed(false);
        }
        if (e.key === ' ') {
          if (previousToolRef.current) {
            setActiveTool(previousToolRef.current);
            previousToolRef.current = null;
          }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeTool, handleUndo, handleRedo, handleToggleMasterSnap, handleToggleSnapMode, activeArea, mousePos, wallEditInfo, snapIndicator, isCutViewActive]);

  const handleReset = () => {
    setAreas(INITIAL_STATE.areas);
    setTiles([]);
    setActiveAreaIndex(null);
    setActiveTool(INITIAL_STATE.activeTool);
    setVisibilityMode('both');
    setGridColor(INITIAL_STATE.gridColor);
    setGridThickness(INITIAL_STATE.gridThickness);
    setGridDashScale(INITIAL_STATE.gridDashScale);
    setBorderThickness(INITIAL_STATE.borderThickness);
    setTileNumberFontSize(INITIAL_STATE.tileNumberFontSize);
    setDimensionFontSize(INITIAL_STATE.dimensionFontSize);
    setHatchScale(INITIAL_STATE.hatchScale);
    setTileDimensions(INITIAL_STATE.tileDimensions);
    setSnapModes(INITIAL_STATE.snapModes);
    setActiveAngleSnap(null);
    setActiveLengthSnap(null);
    setHistory([INITIAL_HISTORY_STATE]);
    setHistoryIndex(0);
    setStartPoint(null);
    setIsCutViewActive(false);
    setPreCutState(null);
    setCutPieces(null);
    setGithubRepoUrl(null);
    localStorage.removeItem('simplejack_autosave');
  };
  
  const calculateStatsForArea = (area: Area, allTiles: Tile[], tileDims: TileDimensions): Area => {
    if (!area.isClosed || area.points.length < 3) {
      return { ...area, calculationResult: null };
    }

    let areaPolygon = area.points;
    if (isPolygonClockwise(areaPolygon)) {
        areaPolygon = [...areaPolygon].reverse();
    }

    const pArea = polygonArea(areaPolygon);
    const perimeter = polygonPerimeter(areaPolygon);
    const singleTileArea = tileDims.width * tileDims.height;

    if (singleTileArea === 0) { // Avoid division by zero
        return {
            ...area,
            calculationResult: {
                tileCount: 0,
                colorCount: 0,
                tileCountsByColor: {},
                total: 0,
                polygonArea: pArea,
                perimeter: perimeter,
            },
        };
    }

    const intersectingTiles = allTiles.filter(tile => polygonIntersectsRectangle(areaPolygon, tile));

    let totalUsedTileArea = 0;
    const tileAreaByColor: Record<string, number> = {};

    intersectingTiles.forEach(tile => {
        const tilePolygon: Point[] = [
            { id: -1, x: tile.x, y: tile.y },
            { id: -2, x: tile.x + tile.width, y: tile.y },
            { id: -3, x: tile.x + tile.width, y: tile.y + tile.height },
            { id: -4, x: tile.x, y: tile.y + tile.height },
        ];
        
        const intersection = clipPolygonByPolygon(tilePolygon, areaPolygon);
        const intersectionArea = polygonArea(intersection);
        
        if (intersectionArea > 1e-6) {
            totalUsedTileArea += intersectionArea;
            tileAreaByColor[tile.color] = (tileAreaByColor[tile.color] || 0) + intersectionArea;
        }
    });

    const finalTileCount = totalUsedTileArea / singleTileArea;
    const finalTileCountsByColor: Record<string, number> = {};
    for (const color in tileAreaByColor) {
        finalTileCountsByColor[color] = tileAreaByColor[color] / singleTileArea;
    }
    
    const colorCount = Object.keys(finalTileCountsByColor).length;

    return {
        ...area,
        calculationResult: { 
            tileCount: finalTileCount,
            colorCount: colorCount,
            tileCountsByColor: finalTileCountsByColor,
            total: finalTileCount,
            polygonArea: pArea, 
            perimeter: perimeter 
        },
    };
};

  const handleAddPoint = (point: { x: number; y: number }) => {
    const currentActiveAreaIndex = areas.findIndex(area => !area.isClosed);
    const newAreas = JSON.parse(JSON.stringify(areas));
    let targetArea;
    let targetIndex;

    if (currentActiveAreaIndex !== -1) {
      targetIndex = currentActiveAreaIndex;
      targetArea = newAreas[targetIndex];
    } else {
      const newAreaName = getNextAreaName(newAreas);
      const newAreaNumberMatch = newAreaName.match(/^Area (\d+)$/);
      if (!newAreaNumberMatch || !newAreaNumberMatch[1]) {
        console.error("Could not determine new area number from name:", newAreaName);
        return; 
      }
      const newAreaNumber = parseInt(newAreaNumberMatch[1], 10);

      const newArea: Area = {
        id: Date.now(),
        name: newAreaName,
        points: [],
        walls: [],
        color: AREA_COLORS[(newAreaNumber - 1) % AREA_COLORS.length],
        isClosed: false,
        calculationResult: null,
        isVisible: true,
      };
      
      let insertionIndex = newAreas.length;
      for (let i = 0; i < newAreas.length; i++) {
        const existingAreaName = newAreas[i].name;
        const existingAreaNumberMatch = existingAreaName.match(/^Area (\d+)$/);
        if (existingAreaNumberMatch && existingAreaNumberMatch[1]) {
            const existingAreaNumber = parseInt(existingAreaNumberMatch[1], 10);
            if (existingAreaNumber > newAreaNumber) {
                insertionIndex = i;
                break;
            }
        }
      }
      
      newAreas.splice(insertionIndex, 0, newArea);
      targetIndex = insertionIndex;
      targetArea = newAreas[targetIndex];
    }

    const newPointId = Date.now();
    const newPoint = { id: newPointId, ...point };
    targetArea.points.push(newPoint);

    if (targetArea.points.length === 1) {
      setStartPoint(newPoint);
    }

    if (targetArea.points.length > 1) {
      const p2 = targetArea.points[targetArea.points.length - 1];
      const p1 = targetArea.points[targetArea.points.length - 2];
      targetArea.walls.push({ id: Date.now() + 1, p1Id: p1.id, p2Id: p2.id });
    }

    setAreas(newAreas);
    if (currentActiveAreaIndex === -1) {
        setActiveAreaIndex(targetIndex);
    }
    recordHistory(newAreas, tiles);
  };
  
  const handleSelectForMove = (selection: MoveSelection, currentMousePos: { x: number; y: number }) => {
    setMoveSelection(selection);
    
    let itemsToMove: (Point | Tile | CutTilePiece)[] = [];
    if (selection.type === 'point') {
        const area = areas.find(a => a.id === selection.areaId);
        const point = area?.points.find(p => p.id === selection.id);
        if (point) itemsToMove = [point];
    } else if (selection.type === 'wall') {
        const area = areas.find(a => a.id === selection.areaId);
        const wall = area?.walls.find(w => w.id === selection.id);
        if (wall && area) {
            const p1 = area.points.find(p => p.id === wall.p1Id);
            const p2 = area.points.find(p => p.id === wall.p2Id);
            if (p1 && p2) itemsToMove = [p1, p2];
        }
    } else if (selection.type === 'area') {
        const area = areas.find(a => a.id === selection.areaId);
        if (area) itemsToMove = area.points;
    } else if (selection.type === 'tile') {
        const tile = tiles.find(t => t.id === selection.id);
        if (tile) itemsToMove = [tile];
    } else if (selection.type === 'cutPiece') {
        const piece = cutPieces?.find(p => p.id === selection.id);
        if (piece) itemsToMove = [piece];
    }

    setMoveSnapshot({
        selection,
        initialMousePos: currentMousePos,
        initialPoints: JSON.parse(JSON.stringify(itemsToMove)),
    });
  };

  const handleMoveSelection = (currentMousePos: { x: number; y: number }, snappedMousePos: { x: number, y: number } | null) => {
    if (!moveSnapshot) return;

    const { selection, initialMousePos, initialPoints } = moveSnapshot;
    
    if (selection.type === 'point') {
      const newPosition = snappedMousePos ?? currentMousePos;
      setAreas(prevAreas => {
        const newAreas = JSON.parse(JSON.stringify(prevAreas));
        const areaToUpdate = newAreas.find((a: Area) => a.id === selection.areaId);
        if (areaToUpdate) {
            const pointToUpdate = areaToUpdate.points.find((p: Point) => p.id === selection.id);
            if (pointToUpdate) {
                pointToUpdate.x = newPosition.x;
                pointToUpdate.y = newPosition.y;
            }
        }
        return newAreas;
      });
    } else if (selection.type === 'tile') {
        const initialTile = initialPoints[0] as Tile;
        
        const dx = currentMousePos.x - initialMousePos.x;
        const dy = currentMousePos.y - initialMousePos.y;

        let newX = initialTile.x + dx;
        let newY = initialTile.y + dy;

        if (snapModes.grid) {
            newX = Math.round(newX / tileDimensions.width) * tileDimensions.width;
            newY = Math.round(newY / tileDimensions.height) * tileDimensions.height;
        }
        
        const candidateRect = { ...initialTile, x: newX, y: newY };
        let collision = false;
        for (const otherTile of tiles) {
            if (otherTile.id !== selection.id && rectanglesIntersect(candidateRect, otherTile)) {
                collision = true;
                break;
            }
        }
        setIsMoveColliding(collision);

        setTiles(prevTiles => prevTiles.map(tile => 
          tile.id === selection.id ? { ...tile, x: newX, y: newY } : tile
        ));
    } else if (selection.type === 'cutPiece') {
        const initialPiece = initialPoints[0] as CutTilePiece;
        const dx = currentMousePos.x - initialMousePos.x;
        const dy = currentMousePos.y - initialMousePos.y;
        const newX = initialPiece.x + dx;
        const newY = initialPiece.y + dy;
        setCutPieces(prev => prev!.map(p => 
            p.id === selection.id ? { ...p, x: newX, y: newY } : p
        ));
    } else { // Wall or Area
        let dx = currentMousePos.x - initialMousePos.x;
        let dy = currentMousePos.y - initialMousePos.y;
        setAreas(prevAreas => {
            const newAreas = JSON.parse(JSON.stringify(prevAreas));
            const areaToUpdate = newAreas.find((a: Area) => a.id === selection.areaId);
            if (areaToUpdate) {
                initialPoints.forEach(initialPoint => {
                    const pointToUpdate = areaToUpdate.points.find((p: Point) => p.id === initialPoint.id);
                    if (pointToUpdate) {
                        pointToUpdate.x = (initialPoint as Point).x + dx;
                        pointToUpdate.y = (initialPoint as Point).y + dy;
                    }
                });
            }
            return newAreas;
        });
    }
  };

  const handleMoveSelectionEnd = () => {
    if (!moveSnapshot) return;

    if (moveSnapshot.selection.type !== 'cutPiece') {
        let finalAreas = areas;
        let workingTiles = tiles;

        if (isMoveColliding && moveSnapshot.selection.type === 'tile') {
            const originalTile = moveSnapshot.initialPoints[0] as Tile;
            workingTiles = tiles.map(t => t.id === originalTile.id ? originalTile : t);
        } else {
            finalAreas = areas.map(area => {
                if (area.isClosed && area.points.length > 2 && moveSnapshot.selection.type !== 'tile' && area.id === moveSnapshot.selection.areaId) {
                    return calculateStatsForArea(area, tiles, tileDimensions);
                }
                return area;
            });
        }
        
        const renumberedFinalTiles = renumberTilesByColor(workingTiles);

        setAreas(finalAreas);
        setTiles(renumberedFinalTiles);
        
        recordHistory(finalAreas, renumberedFinalTiles);
    }

    setMoveSelection(null);
    setMoveSnapshot(null);
    setIsMoveColliding(false);
  };

  const handleSelectArea = (areaId: number | null) => {
    if (activeTool === 'ERASE' && areaId !== null) {
        const area = areas.find(a => a.id === areaId);
        if (area) {
            setDeleteAreaConfirmInfo({ areaId: area.id, areaName: area.name });
        }
    } else {
        setSelectedAreaId(areaId);
        if (areaId) {
            setActiveTool('POINTER');
        }
    }
  };
  
  const handleToggleAreaVisibility = (areaId: number) => {
    const newAreas = areas.map(area => {
        if (area.id === areaId) {
            return { ...area, isVisible: !area.isVisible };
        }
        return area;
    });
    setAreas(newAreas);
    if (selectedAreaId === areaId) {
        setSelectedAreaId(null);
    }
    recordHistory(newAreas, tiles);
  };

  const wallToEditData = useMemo(() => {
    if (!wallEditInfo) return null;
    const area = areas.find(a => a.id === wallEditInfo.areaId);
    if (!area) return null;
    const wall = area.walls.find(w => w.id === wallEditInfo.wallId);
    if (!wall) return null;
    const p1 = area.points.find(p => p.id === wall.p1Id);
    const p2 = area.points.find(p => p.id === wall.p2Id);
    if (!p1 || !p2) return null;
    return { wall, p1, p2 };
  }, [wallEditInfo, areas]);
  
  const handlePreviewWallEdit = ({ newLength, fixedPointId }: { newLength: number; fixedPointId: number }) => {
    if (!wallToEditData) return;

    const { p1, p2 } = wallToEditData;
    const movingPointId = fixedPointId === p1.id ? p2.id : p1.id;
    const fixedPoint = fixedPointId === p1.id ? p1 : p2;
    const movingPoint = fixedPointId === p1.id ? p2 : p1;
    
    const dx = movingPoint.x - fixedPoint.x;
    const dy = movingPoint.y - fixedPoint.y;
    const currentLength = Math.sqrt(dx * dx + dy * dy);

    if (currentLength === 0) {
      setWallEditPreview({
        movingPointId,
        newPosition: { x: fixedPoint.x + newLength, y: fixedPoint.y }
      });
      return;
    }

    const ratio = newLength / currentLength;
    const newPosition = {
        x: fixedPoint.x + dx * ratio,
        y: fixedPoint.y + dy * ratio
    };

    setWallEditPreview({ movingPointId, newPosition });
  };
  
  const handleConfirmWallEdit = () => {
    if (!wallEditInfo || !wallEditPreview) return;

    const areaId = wallEditInfo.areaId;
    const { movingPointId, newPosition } = wallEditPreview;

    const finalAreas = areas.map(area => {
      if (area.id !== areaId) return area;

      const newPoints = area.points.map(point => 
          point.id === movingPointId ? { ...point, ...newPosition } : point
      );
      const updatedArea = { ...area, points: newPoints };

      return area.isClosed ? calculateStatsForArea(updatedArea, tiles, tileDimensions) : updatedArea;
    });
    
    setAreas(finalAreas);
    recordHistory(finalAreas, tiles);
    setWallEditInfo(null);
    setWallEditPreview(null);
  };

  const handleCloseWallEditDialog = () => {
    setWallEditInfo(null);
    setWallEditPreview(null);
  };

  const handleEraseBatch = (batch: Array<{ type: 'point' | 'wall' | 'area' | 'tile' | 'cutPiece'; id: number | string; areaId?: number }>) => {
      if (isCutViewActive) {
          const idsToErase = new Set(batch.map(item => item.id));
          setCutPieces(prev => prev!.filter(p => !idsToErase.has(p.id)));
          return;
      }
      
      let workingAreas = JSON.parse(JSON.stringify(areas));
      let workingTiles = JSON.parse(JSON.stringify(tiles));
      let tilesChanged = false;
      let activeAreaNeedsUpdate = false;
      
      for (const item of batch) {
          if (item.type === 'tile') {
              workingTiles = workingTiles.filter((t: Tile) => t.id !== item.id);
              tilesChanged = true;
          } else if (item.type === 'area') {
              if (activeArea && item.id === activeArea.id) activeAreaNeedsUpdate = true;
              workingAreas = workingAreas.filter((a: Area) => a.id !== item.id);
          } else if (item.areaId) {
              const areaIndex = workingAreas.findIndex((a: Area) => a.id === item.areaId);
              if (areaIndex === -1) continue;

              const area = workingAreas[areaIndex];
              
              if (item.type === 'point') {
                  const isStartPoint = area.points[0]?.id === item.id;
                  area.points = area.points.filter((p: Point) => p.id !== item.id);
                  area.walls = area.walls.filter((w: Wall) => w.p1Id !== item.id && w.p2Id !== item.id);
                  if (area.isClosed) {
                      area.isClosed = false;
                      area.calculationResult = null;
                      if (!activeAreaNeedsUpdate) activeAreaNeedsUpdate = true;
                  }
              } else if (item.type === 'wall') {
                  const wallToDelete = area.walls.find((w: Wall) => w.id === item.id);
                  if (!wallToDelete) continue;
                  const { p1Id, p2Id } = wallToDelete;
                  const remainingWalls = area.walls.filter((w: Wall) => w.id !== item.id);
                  area.walls = remainingWalls;
                  const pointsToDelete = new Set<number>();
                  if (!remainingWalls.some((w: Wall) => w.p1Id === p1Id || w.p2Id === p1Id)) pointsToDelete.add(p1Id);
                  if (!remainingWalls.some((w: Wall) => w.p1Id === p2Id || w.p2Id === p2Id)) pointsToDelete.add(p2Id);
                  if (pointsToDelete.size > 0) area.points = area.points.filter((p: Point) => !pointsToDelete.has(p.id));
                  if (area.isClosed) {
                      area.isClosed = false;
                      area.calculationResult = null;
                      if (!activeAreaNeedsUpdate) activeAreaNeedsUpdate = true;
                  }
              }
          }
      }
      
      if (tilesChanged) {
          workingTiles = renumberTilesByColor(workingTiles);
      }
      
      setAreas(workingAreas);
      setTiles(workingTiles);
      recordHistory(workingAreas, workingTiles);

      if (activeAreaNeedsUpdate) {
          const newActiveIndex = workingAreas.findIndex((a:Area) => !a.isClosed);
          setActiveAreaIndex(newActiveIndex !== -1 ? newActiveIndex : null);
      }
  };


  const handleDeleteArea = (areaId: number) => {
    const area = areas.find(a => a.id === areaId);
    if (area) {
        setDeleteAreaConfirmInfo({ areaId: area.id, areaName: area.name });
    }
  };

  const handleGenerateField = (params: { width: number; height: number; rows: number; cols: number }) => {
    setFieldPlacement(params);
    setIsFieldDialogOpen(false);
    setActiveTool('PLACE_FIELD');
  };

  const handlePlaceField = (pos: { x: number; y: number }) => {
    if (!fieldPlacement) return;

    const tilesToDeleteIds = new Set<number>();
    const newTilesToCreate: Omit<Tile, 'id' | 'number'>[] = [];
    const closedVisibleAreas = areas.filter(a => a.isClosed && a.isVisible);

    for (let row = 0; row < fieldPlacement.rows; row++) {
      for (let col = 0; col < fieldPlacement.cols; col++) {
        const candidateRect = {
          x: pos.x + col * fieldPlacement.width,
          y: pos.y - (row + 1) * fieldPlacement.height,
          width: fieldPlacement.width,
          height: fieldPlacement.height,
        };

        let areaCollision = false;
        for (const area of closedVisibleAreas) {
            if (polygonIntersectsRectangle(area.points, candidateRect)) {
                areaCollision = true;
                break;
            }
        }
        if (areaCollision) continue;

        for (const existingTile of tiles) {
            if (rectanglesIntersect(candidateRect, existingTile)) {
                tilesToDeleteIds.add(existingTile.id);
            }
        }
        
        newTilesToCreate.push({ ...candidateRect, color: activeColor });
      }
    }
    
    const remainingTiles = tiles.filter(t => !tilesToDeleteIds.has(t.id));

    if (newTilesToCreate.length === 0 && tilesToDeleteIds.size === 0) {
      setFieldPlacement(null);
      setActiveTool('POINTER');
      return;
    }

    let time = Date.now();
    const newTilesWithIds: Tile[] = newTilesToCreate.map((t, i) => ({
      ...t,
      id: time + i,
      number: '0',
    }));

    const finalTiles = renumberTilesByColor([...remainingTiles, ...newTilesWithIds]);
    setTiles(finalTiles);
    recordHistory(areas, finalTiles);

    setFieldPlacement(null);
    setActiveTool('POINTER');
  };

  const handleAddTilesBatch = (tilesToAdd: Omit<Tile, 'id' | 'number'>[]) => {
    if (tilesToAdd.length === 0) return;
    
    // 1. When using the TILE tool, do not check for collisions with floor plan areas.
    const validCandidates = tilesToAdd;
    
    // 2. Find existing tiles to be replaced by the new batch.
    const tilesToDeleteIds = new Set<number>();
    
    for (const candidate of validCandidates) {
      for (const existingTile of tiles) {
        if (rectanglesIntersect(candidate, existingTile)) {
          tilesToDeleteIds.add(existingTile.id);
        }
      }
    }

    // 3. Create the new list of tiles.
    const remainingTiles = tiles.filter(t => !tilesToDeleteIds.has(t.id));

    let time = Date.now();
    const newTiles: Tile[] = validCandidates.map((t, i) => ({
      ...t,
      id: time + i,
      number: '0', // Placeholder
    }));
    
    if (newTiles.length === 0 && tilesToDeleteIds.size === 0) return;

    // 4. Combine and renumber.
    const finalTiles = renumberTilesByColor([...remainingTiles, ...newTiles]);

    setTiles(finalTiles);
    recordHistory(areas, finalTiles);
  };

  const handleFillArea = (areaId: number) => {
    const areaToFill = areas.find(a => a.id === areaId);
    if (!areaToFill || !areaToFill.isClosed) {
      return;
    }

    let clipPolygon = areaToFill.points;
    if (isPolygonClockwise(clipPolygon)) {
        clipPolygon = [...clipPolygon].reverse();
    }

    const { points } = areaToFill;
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));

    const { width: tileW, height: tileH } = tileDimensions;

    const startCol = Math.floor(minX / tileW);
    const endCol = Math.ceil(maxX / tileW);
    const startRow = Math.floor(minY / tileH);
    const endRow = Math.ceil(maxY / tileH);

    const newTilesToCreate: Omit<Tile, 'id' | 'number'>[] = [];
    
    const existingTilePositions = new Set(tiles.map(t => `${Math.floor(t.x/tileW)},${Math.floor(t.y/tileH)}`));

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const tileX = col * tileW;
        const tileY = row * tileH;
        
        if (existingTilePositions.has(`${col},${row}`)) {
            continue;
        }

        const tileRect = {
          x: tileX,
          y: tileY,
          width: tileW,
          height: tileH,
        };
        
        const tilePolygon: Point[] = [
            { id: -1, x: tileRect.x, y: tileRect.y },
            { id: -2, x: tileRect.x + tileW, y: tileRect.y },
            { id: -3, x: tileRect.x + tileW, y: tileRect.y + tileH },
            { id: -4, x: tileRect.x, y: tileRect.y + tileH },
        ];

        const intersectionPolygon = clipPolygonByPolygon(tilePolygon, clipPolygon);
        const intersectionArea = polygonArea(intersectionPolygon);

        if (intersectionArea > 1e-6) {
          newTilesToCreate.push({ ...tileRect, color: activeColor });
        }
      }
    }
    
    if (newTilesToCreate.length === 0) {
      return;
    }

    let time = Date.now();
    const newTiles: Tile[] = newTilesToCreate.map((t, i) => ({
      ...t,
      id: time + i,
      number: '0',
    }));

    const finalTiles = renumberTilesByColor([...tiles, ...newTiles]);

    setTiles(finalTiles);
    recordHistory(areas, finalTiles);
    setActiveTool('POINTER');
  };
  
    const handleChangeTileColor = (tileId: number, newColor: string) => {
        const updatedTiles = tiles.map(tile => 
            tile.id === tileId ? { ...tile, color: newColor } : tile
        );
        const renumberedTiles = renumberTilesByColor(updatedTiles);
        setTiles(renumberedTiles);
        recordHistory(areas, renumberedTiles);
        setEditingTile(null);
    };

  const handleAddPointWithAngleAndLength = ({ length, angle }: { length: number; angle: number }) => {
    if (!activeArea || activeArea.points.length === 0) return;
    const lastPoint = activeArea.points[activeArea.points.length - 1];
    let finalAngleRad: number;
    if (activeArea.points.length > 1) {
        const secondLastPoint = activeArea.points[activeArea.points.length - 2];
        const prevAngleRad = Math.atan2(lastPoint.y - secondLastPoint.y, lastPoint.x - secondLastPoint.x);
        finalAngleRad = prevAngleRad + angle * (Math.PI / 180);
    } else {
        finalAngleRad = angle * (Math.PI / 180);
    }
    const newPoint = { x: lastPoint.x + length * Math.cos(finalAngleRad), y: lastPoint.y + length * Math.sin(finalAngleRad) };
    handleAddPoint(newPoint);
  };

  const handleConfirmLength = (length: number) => {
    if (activeArea && activeArea.points.length > 0 && length > 0) {
        const lastPoint = activeArea.points[activeArea.points.length - 1];
        const newPoint = {
            x: lastPoint.x + length * Math.cos(lengthEntryAngle),
            y: lastPoint.y + length * Math.sin(lengthEntryAngle),
        };
        handleAddPoint(newPoint);
    }
    setLengthDialogOpen(false);
  };
  
  const closeActivePolygon = () => {
    if (!activeArea || activeArea.points.length < 3) return;
    setAreas(prevAreas => {
        const newAreas = prevAreas.map((area, index) => {
            if (index === activeAreaIndex) {
                 const firstPoint = area.points[0];
                 const lastPoint = area.points[area.points.length - 1];
                 const updatedWalls = [...area.walls, { id: Date.now(), p1Id: lastPoint.id, p2Id: firstPoint.id }];
                 const updatedArea = { ...area, walls: updatedWalls, isClosed: true };
                 return calculateStatsForArea(updatedArea, tiles, tileDimensions);
            }
            return area;
        });
        recordHistory(newAreas, tiles);
        setActiveAreaIndex(null);
        setStartPoint(null);
        return newAreas;
    });
  };

  const handleConfirmClose = () => {
    closeActivePolygon();
    setClosePolygonDialogOpen(false);
  };

  const confirmDeleteArea = () => {
    if (deleteAreaConfirmInfo) {
      handleEraseBatch([{ type: 'area', id: deleteAreaConfirmInfo.areaId }]);
      setDeleteAreaConfirmInfo(null);
    }
  };

  const cancelDeleteArea = () => {
      setDeleteAreaConfirmInfo(null);
  };
  
  const handleEraseClick = () => {
    if (selectedAreaId && !isCutViewActive) {
        const area = areas.find(a => a.id === selectedAreaId);
        if (area) {
            setDeleteAreaConfirmInfo({ areaId: area.id, areaName: area.name });
        }
    } else {
        handleToolChange('ERASE');
    }
  };

  const getCurrentStateAsJSON = () => {
    const settings = {
        gridColor, gridThickness, gridDashScale, borderThickness,
        tileNumberFontSize, dimensionFontSize, hatchScale,
        tileDimensions, isTileRatioLocked, githubRepoUrl,
    };
    const saveData = { version: "1.0", areas, tiles, settings };
    return JSON.stringify(saveData, null, 2);
  };

  const handleSave = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(getCurrentStateAsJSON())}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "floorplan.sfc";
    link.click();
  };

  const handleLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sfc,application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const loadedData = JSON.parse(event.target?.result as string);
          if (loadedData && Array.isArray(loadedData.areas) && loadedData.settings) {
            const sanitizedTiles = Array.isArray(loadedData.tiles) ? loadedData.tiles : [];
            const { settings } = loadedData;
            const loadedTileDimensions = settings.tileDimensions ?? INITIAL_STATE.tileDimensions;
            const sanitizedAreas = loadedData.areas.map((area: any) => {
                const updatedArea = {
                  ...area,
                  points: Array.isArray(area.points) ? area.points : [],
                  walls: Array.isArray(area.walls) ? area.walls : [],
                  isVisible: area.isVisible !== false,
                };
                return area.isClosed ? calculateStatsForArea(updatedArea, sanitizedTiles, loadedTileDimensions) : updatedArea;
            });

            setAreas(sanitizedAreas);
            setTiles(sanitizedTiles);
            setGridColor(settings.gridColor ?? INITIAL_STATE.gridColor);
            setGridThickness(settings.gridThickness ?? INITIAL_STATE.gridThickness);
            setGridDashScale(settings.gridDashScale ?? INITIAL_STATE.gridDashScale);
            setBorderThickness(settings.borderThickness ?? INITIAL_STATE.borderThickness);
            setTileNumberFontSize(settings.tileNumberFontSize ?? INITIAL_STATE.tileNumberFontSize);
            setDimensionFontSize(settings.dimensionFontSize ?? INITIAL_STATE.dimensionFontSize);
            setHatchScale(settings.hatchScale ?? INITIAL_STATE.hatchScale);
            setTileDimensions(loadedTileDimensions);
            setIsTileRatioLocked(settings.isTileRatioLocked ?? true);
            setGithubRepoUrl(settings.githubRepoUrl ?? null);
            setActiveAreaIndex(null);
            setActiveTool('POINTER');
            setHistory([{ areas: sanitizedAreas, tiles: sanitizedTiles }]);
            setHistoryIndex(0);
            setTimeout(() => setFitViewTrigger(prev => prev + 1), 100);
          } else { alert("Error: Invalid or corrupted file format."); }
        } catch (error) { console.error("Failed to parse file:", error); alert("Error: Could not read the selected file."); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleRestoreAutosave = () => {
    if (!restorePromptData) return;

    const { areas: loadedAreas, tiles: loadedTiles, settings } = restorePromptData;
    setAreas(loadedAreas);
    setTiles(Array.isArray(loadedTiles) ? loadedTiles : []);
    setGridColor(settings.gridColor ?? INITIAL_STATE.gridColor);
    setGridThickness(settings.gridThickness ?? INITIAL_STATE.gridThickness);
    setGridDashScale(settings.gridDashScale ?? INITIAL_STATE.gridDashScale);
    setBorderThickness(settings.borderThickness ?? INITIAL_STATE.borderThickness);
    setTileNumberFontSize(settings.tileNumberFontSize ?? INITIAL_STATE.tileNumberFontSize);
    setDimensionFontSize(settings.dimensionFontSize ?? INITIAL_STATE.dimensionFontSize);
    setHatchScale(settings.hatchScale ?? INITIAL_STATE.hatchScale);
    setTileDimensions(settings.tileDimensions ?? INITIAL_STATE.tileDimensions);
    setIsTileRatioLocked(settings.isTileRatioLocked ?? true);
    setGithubRepoUrl(settings.githubRepoUrl ?? null);
    
    setActiveAreaIndex(null);
    setActiveTool('POINTER');
    
    setHistory([{ areas: loadedAreas, tiles: Array.isArray(loadedTiles) ? loadedTiles : [] }]);
    setHistoryIndex(0);
    
    setRestorePromptData(null);
    localStorage.removeItem('simplejack_autosave');
    setTimeout(() => setFitViewTrigger(prev => prev + 1), 100);
  };

  const handleDiscardAutosave = () => {
    if (restorePromptData) {
      localStorage.removeItem('simplejack_autosave');
      setRestorePromptData(null);
    }
  };

  const handleCut = () => {
      const closedAreas = areas.filter(a => a.isClosed && a.isVisible);
      if (closedAreas.length === 0 || tiles.length === 0) {
          alert("Please draw at least one closed area and place some tiles before cutting.");
          return;
      }
  
      setPreCutState({ areas, tiles });
  
      const allNewCutPieces: CutTilePiece[] = [];
  
      const correctedAreas = closedAreas.map(area => {
          if (isPolygonClockwise(area.points)) {
              return { ...area, points: [...area.points].reverse() };
          }
          return area;
      });
  
      tiles.forEach((tile) => {
          const tilePolygon: Point[] = [
              { id: -1, x: tile.x, y: tile.y }, { id: -2, x: tile.x + tile.width, y: tile.y },
              { id: -3, x: tile.x + tile.width, y: tile.y + tile.height }, { id: -4, x: tile.x, y: tile.y + tile.height },
          ];
  
          const inPiecePolygons: Point[][] = [];
          correctedAreas.forEach(area => {
              const intersection = clipPolygonByPolygon(tilePolygon, area.points);
              if (polygonArea(intersection) > 1e-6) {
                  inPiecePolygons.push(intersection);
              }
          });
          
          const cutSegments: Point[][] = [];
          inPiecePolygons.forEach(poly => {
              for (let i = 0; i < poly.length; i++) {
                  const p1 = poly[i];
                  const p2 = poly[(i + 1) % poly.length];
                  if (!isSegmentOnTileBoundary([p1, p2], tile)) {
                      cutSegments.push([p1, p2]);
                  }
              }
          });
  
          const totalInPieceArea = inPiecePolygons.reduce((sum, p) => sum + polygonArea(p), 0);
          const originalTileArea = tile.width * tile.height;
  
          if (totalInPieceArea < 1e-6) { // Fully outside
              allNewCutPieces.push({
                  id: `${tile.id}-offcut`, originalTile: tile, isOffcut: true,
                  x: tile.x, y: tile.y,
                  polygons: [[
                      {id:-1, x:0, y:0}, {id:-1, x:tile.width, y:0}, {id:-1, x:tile.width, y:tile.height}, {id:-1, x:0, y:tile.height}
                  ]],
                  wastePercentage: 100,
                  cutSegments: [], // No intersection with area, so no "cut" lines
              });
          } else {
              inPiecePolygons.forEach((poly, i) => {
                  allNewCutPieces.push({
                      id: `${tile.id}-in-${i}`, originalTile: tile, isOffcut: false,
                      x: tile.x, y: tile.y,
                      polygons: [poly.map(p => ({...p, x: p.x - tile.x, y: p.y - tile.y}))],
                      wastePercentage: 0,
                  });
              });
  
              if (originalTileArea - totalInPieceArea > 1e-6) { // Has offcut
                  const outerPoly = [{id:-1, x:0, y:0}, {id:-1, x:tile.width, y:0}, {id:-1, x:tile.width, y:tile.height}, {id:-1, x:0, y:tile.height}];
                  const holePolys = inPiecePolygons.map(poly => poly.map(p => ({...p, x: p.x - tile.x, y: p.y - tile.y})));
                  const wastePercentage = originalTileArea > 0 ? ((originalTileArea - totalInPieceArea) / originalTileArea) * 100 : 0;
                  
                  allNewCutPieces.push({
                      id: `${tile.id}-offcut`, originalTile: tile, isOffcut: true,
                      x: tile.x, y: tile.y,
                      polygons: [outerPoly, ...holePolys],
                      cutSegments: cutSegments.map(seg => seg.map(p => ({ ...p, id: -1, x: p.x - tile.x, y: p.y - tile.y }))),
                      wastePercentage: wastePercentage,
                  });
              }
          }
      });
  
      const offcutPiecesByColor = new Map<string, CutTilePiece[]>();
      allNewCutPieces.filter(p => p.isOffcut).forEach(p => {
          if (!offcutPiecesByColor.has(p.originalTile.color)) offcutPiecesByColor.set(p.originalTile.color, []);
          offcutPiecesByColor.get(p.originalTile.color)!.push(p);
      });
  
      const allPoints = [...areas.flatMap(a => a.points), ...tiles.flatMap(t => [{x: t.x, y: t.y, id:-1}, {x: t.x + t.width, y: t.y + t.height, id:-1}])];
      const minX = allPoints.length > 0 ? Math.min(...allPoints.map(p => p.x)) : 0;
      const maxY = allPoints.length > 0 ? Math.max(...allPoints.map(p => p.y)) : 0;
      const PADDING = tileDimensions.width / 2;
      let currentY = maxY + PADDING * 3;
      const sortedColors = Array.from(offcutPiecesByColor.keys()).sort((a, b) => TILE_COLORS.indexOf(a) - TILE_COLORS.indexOf(b));
  
      sortedColors.forEach(color => {
          const pieces = offcutPiecesByColor.get(color)!;
          let currentX = minX;
          const maxHeightInRow = Math.max(0, ...pieces.map(p => p.originalTile.height));
          
          pieces.sort((a, b) => {
            const numA = parseInt((a.originalTile.number || '0-0').split('-')[1]);
            const numB = parseInt((b.originalTile.number || '0-0').split('-')[1]);
            return numA - numB;
          });

          pieces.forEach(piece => {
              piece.x = currentX;
              piece.y = currentY;
              currentX += piece.originalTile.width + PADDING;
          });
          currentY += maxHeightInRow + PADDING * 2;
      });

      const fullyWastedPieces = allNewCutPieces.filter(p => p.isOffcut && p.wastePercentage >= 99.9);

      if (fullyWastedPieces.length > 0) {
          setWasteDeletionPrompt({
              allPieces: allNewCutPieces,
              piecesToDeleteIds: fullyWastedPieces.map(p => p.id)
          });
      } else {
          setCutPieces(allNewCutPieces);
          setIsCutViewActive(true);
          setActiveTool('MOVE');
      }
  };

  const handleConfirmDeleteWaste = () => {
    if (!wasteDeletionPrompt || !preCutState) return;
    const { allPieces, piecesToDeleteIds } = wasteDeletionPrompt;

    // 1. Find the original tile IDs to delete
    const piecesToDeleteIdSet = new Set(piecesToDeleteIds);
    const originalTileIdsToDelete = new Set<number>();
    allPieces.forEach(p => {
      if (piecesToDeleteIdSet.has(p.id) && p.isOffcut) {
        originalTileIdsToDelete.add(p.originalTile.id);
      }
    });

    // 2. Filter the tiles from the pre-cut state
    const newBaseTiles = preCutState.tiles.filter(t => !originalTileIdsToDelete.has(t.id));

    // 3. Renumber the remaining tiles
    const renumberedTiles = renumberTilesByColor(newBaseTiles);

    // 4. Update the main tiles state and the preCutState for a correct restore
    setTiles(renumberedTiles);
    setPreCutState({ areas: preCutState.areas, tiles: renumberedTiles });

    // 5. Filter the cut pieces to remove the deleted ones
    const finalCutPieces = allPieces.filter(p => !piecesToDeleteIdSet.has(p.id));
    
    // 6. Finalize the cut operation by setting the state for the interactive cut view
    setCutPieces(finalCutPieces);
    setIsCutViewActive(true);
    setActiveTool('MOVE');
    
    // 7. Record the deletion as a new history state
    recordHistory(preCutState.areas, renumberedTiles);

    // 8. Close the prompt
    setWasteDeletionPrompt(null);
  };

  const handleKeepWaste = () => {
      if (!wasteDeletionPrompt) return;
      const { allPieces } = wasteDeletionPrompt;
      setCutPieces(allPieces);
      setIsCutViewActive(true);
      setActiveTool('MOVE');
      setWasteDeletionPrompt(null);
  };

  const handleRestore = () => {
    if (preCutState) {
      setAreas(preCutState.areas);
      setTiles(preCutState.tiles);
    }
    setIsCutViewActive(false);
    setPreCutState(null);
    setCutPieces(null);
    setActiveTool('POINTER');
  };

  const handleConnectGitHub = (url: string) => {
    setGithubRepoUrl(url);
    setIsGitHubDialogOpen(false);
    alert(`Connected to GitHub repository: ${url}`);
  };

  const handleDisconnectGitHub = () => {
    setGithubRepoUrl(null);
    alert('Disconnected from GitHub repository.');
  };

  const handlePushToGitHub = () => {
    if (!githubRepoUrl) {
      alert("Not connected to a GitHub repository.");
      return;
    }
    const stateJson = getCurrentStateAsJSON();
    console.log(`Simulating PUSH to ${githubRepoUrl}`);
    console.log('Data:', stateJson);
    alert(`Pushed current state to ${githubRepoUrl} (simulated).`);
  };

  const handlePullFromGitHub = () => {
    if (!githubRepoUrl) {
      alert("Not connected to a GitHub repository.");
      return;
    }
    console.log(`Simulating PULL from ${githubRepoUrl}`);
    alert(`Pulled latest state from ${githubRepoUrl} (simulated). In a real app, the canvas would now update.`);
  };

  return (
    <div className="flex flex-col h-screen w-screen text-white select-none bg-gray-900">
      <div className="flex flex-grow h-full overflow-hidden">
        <main className="flex-grow flex flex-col relative">
           <Toolbar
              activeTool={activeTool}
              onToolChange={handleToolChange}
              onReset={handleReset}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={historyIndex > 0 && !isCutViewActive}
              canRedo={historyIndex < history.length - 1 && !isCutViewActive}
              onSave={handleSave}
              onLoad={handleLoad}
              onZoomIn={() => setZoomInTrigger(t => t + 1)}
              onZoomOut={() => setZoomOutTrigger(t => t + 1)}
              onZoomExtents={() => setFitViewTrigger(t => t + 1)}
              onEraseClick={handleEraseClick}
              zoomInFlash={zoomInFlash}
              zoomOutFlash={zoomOutFlash}
              zoomExtentsFlash={fitViewFlash}
              areas={areas}
              onToggleVisibility={handleToggleAreaVisibility}
              selectedAreaId={selectedAreaId}
              onSelectArea={handleSelectArea}
              totalArea={totalArea}
              totalTilesArea={totalTilesArea}
              isAreaSummaryExpanded={isAreaSummaryExpanded}
              onToggleAreaSummary={() => setAreaSummaryExpanded(p => !p)}
              onOpenStatsPanel={() => setStatsPanelOpen(true)}
              onOpenFieldDialog={() => setIsFieldDialogOpen(true)}
              activeColor={activeColor}
              onActiveColorChange={setActiveColor}
              onCut={handleCut}
              onRestore={handleRestore}
              isCutViewActive={isCutViewActive}
              visibilityMode={visibilityMode}
              onCycleVisibilityMode={handleCycleVisibilityMode}
              onOpenGitHubDialog={() => setIsGitHubDialogOpen(true)}
            />
          <Canvas
            areas={areas}
            activeAreaIndex={activeAreaIndex}
            activeTool={activeTool}
            gridColor={gridColor}
            gridThickness={gridThickness}
            gridDashScale={gridDashScale}
            borderThickness={borderThickness}
            tileNumberFontSize={tileNumberFontSize}
            dimensionFontSize={dimensionFontSize}
            hatchScale={hatchScale}
            snapModes={snapModes}
            tileDimensions={tileDimensions}
            onAddPoint={handleAddPoint}
            onOpenWallEditDialog={(wallId, areaId) => setWallEditInfo({ wallId, areaId })}
            onSelectArea={handleSelectArea}
            onAttemptClosePolygon={() => setClosePolygonDialogOpen(true)}
            selectedAreaId={selectedAreaId}
            activeAngleSnap={activeAngleSnap}
            activeLengthSnap={activeLengthSnap}
            fitViewTrigger={fitViewTrigger}
            zoomInTrigger={zoomInTrigger}
            zoomOutTrigger={zoomOutTrigger}
            mousePos={mousePos}
            onMouseMoveApp={(pos, snapPos) => {
                setMousePos(pos);
                if (moveSelection) {
                    handleMoveSelection(pos, snapPos);
                }
            }}
            snapIndicator={snapIndicator}
            onSnapIndicatorChange={setSnapIndicator}
            moveSelection={moveSelection}
            onSelectForMove={handleSelectForMove}
            onMoveSelection={handleMoveSelection}
            onMoveSelectionEnd={handleMoveSelectionEnd}
            wallBeingEditedId={wallEditInfo?.wallId ?? null}
            wallEditPreview={wallEditPreview}
            edgePanMargin={edgePanMargin}
            edgePanDelay={edgePanDelay}
            edgePanSpeed={edgePanSpeed}
            tiles={tiles}
            fieldPlacement={fieldPlacement}
            onPlaceField={handlePlaceField}
            onAddTilesBatch={handleAddTilesBatch}
            startPoint={startPoint}
            isMoveColliding={isMoveColliding}
            onOpenTileEditDialog={setEditingTile}
            activeColor={activeColor}
            isShiftPressed={isShiftPressed}
            onEraseBatch={handleEraseBatch}
            onFillArea={handleFillArea}
            isCutViewActive={isCutViewActive}
            cutPieces={cutPieces}
            visibilityMode={visibilityMode}
          />
          <SnapToolbar 
              snapModes={snapModes}
              isMasterSnapOn={isMasterSnapOn}
              onToggleMasterSnap={handleToggleMasterSnap}
              onToggleSnapMode={handleToggleSnapMode}
              onOpenSettings={() => setSnapSettingsOpen(true)}
              activeAngleSnap={activeAngleSnap}
              activeLengthSnap={activeLengthSnap}
              activeTool={activeTool}
          />
           <PropertiesPanel
              isOpen={isPropertiesPanelOpen}
              onToggle={() => setIsPropertiesPanelOpen(p => !p)}
              gridColor={gridColor}
              onGridColorChange={setGridColor}
              gridThickness={gridThickness}
              onGridThicknessChange={setGridThickness}
              gridDashScale={gridDashScale}
              onGridDashScaleChange={setGridDashScale}
              borderThickness={borderThickness}
              onBorderThicknessChange={setBorderThickness}
              tileNumberFontSize={tileNumberFontSize}
              onTileNumberFontSizeChange={setTileNumberFontSize}
              dimensionFontSize={dimensionFontSize}
              onDimensionFontSizeChange={setDimensionFontSize}
              hatchScale={hatchScale}
              onHatchScaleChange={setHatchScale}
              tileDimensions={tileDimensions}
              onTileDimensionsChange={handleTileDimensionsChange}
              isTileRatioLocked={isTileRatioLocked}
              onToggleTileRatioLock={() => setIsTileRatioLocked(prev => !prev)}
              activeTool={activeTool}
              isDrawing={isDrawing}
              activeAreaPointsLength={activeArea?.points.length || 0}
              onAddPointWithAngleAndLength={handleAddPointWithAngleAndLength}
              edgePanMargin={edgePanMargin}
              onEdgePanMarginChange={setEdgePanMargin}
              edgePanDelay={edgePanDelay}
              onEdgePanDelayChange={setEdgePanDelay}
              edgePanSpeed={edgePanSpeed}
              onEdgePanSpeedChange={setEdgePanSpeed}
            />
        </main>
      </div>
      <Dialog 
        isOpen={isClosePolygonDialogOpen}
        onConfirm={handleConfirmClose}
        onClose={() => setClosePolygonDialogOpen(false)}
        title="Close Polygon"
      >
        <p>Do you want to close the current shape?</p>
      </Dialog>
      <Dialog
        isOpen={!!deleteAreaConfirmInfo}
        onConfirm={confirmDeleteArea}
        onClose={cancelDeleteArea}
        title="Delete Area"
      >
        <p>Are you sure you want to delete the area "{deleteAreaConfirmInfo?.areaName}"?</p>
      </Dialog>
      <Dialog
        isOpen={!!restorePromptData}
        onConfirm={handleRestoreAutosave}
        onClose={handleDiscardAutosave}
        title="Restore Session"
        confirmText="Restore"
        cancelText="Discard"
      >
        <p>We found some unsaved work from a previous session. Would you like to restore it?</p>
      </Dialog>
      <Dialog
        isOpen={!!wasteDeletionPrompt}
        onConfirm={handleConfirmDeleteWaste}
        onClose={handleKeepWaste}
        title="Delete Unused Tiles?"
        confirmText="Delete Them"
        cancelText="Keep Them"
      >
        <p>Some tiles are located completely outside the floor plan (100% waste). Do you want to delete them?</p>
      </Dialog>
      <StatsPanel 
        isOpen={isStatsPanelOpen}
        onClose={() => setStatsPanelOpen(false)}
        areas={areas}
        totalTilesArea={totalTilesArea}
        cutPieces={cutPieces}
      />
      <InputDialog
        isOpen={isLengthDialogOpen}
        onConfirm={handleConfirmLength}
        onClose={() => setLengthDialogOpen(false)}
        title="Enter Length"
        label="Length (mm)"
       />
       <SnapSettingsDialog
        isOpen={isSnapSettingsOpen}
        onClose={() => setSnapSettingsOpen(false)}
        activeAngleSnap={activeAngleSnap}
        onAngleSnapChange={setActiveAngleSnap}
        activeLengthSnap={activeLengthSnap}
       />
       <WallEditDialog
        isOpen={!!wallEditInfo}
        onClose={handleCloseWallEditDialog}
        onConfirm={handleConfirmWallEdit}
        onPreviewChange={handlePreviewWallEdit}
        wallData={wallToEditData}
       />
       <FieldDialog 
        isOpen={isFieldDialogOpen}
        onClose={() => setIsFieldDialogOpen(false)}
        onGenerate={handleGenerateField}
        initialDimensions={tileDimensions}
      />
      <TileEditDialog
        isOpen={!!editingTile}
        onClose={() => setEditingTile(null)}
        onConfirm={handleChangeTileColor}
        tile={editingTile}
      />
      <GitHubDialog
        isOpen={isGitHubDialogOpen}
        onClose={() => setIsGitHubDialogOpen(false)}
        connectedRepo={githubRepoUrl}
        onConnect={handleConnectGitHub}
        onDisconnect={handleDisconnectGitHub}
        onPush={handlePushToGitHub}
        onPull={handlePullFromGitHub}
      />
      <VersionInfo />
    </div>
  );
}
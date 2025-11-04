// Fix: Define the Point interface here to break a circular dependency.
export interface Point {
  id: number;
  x: number;
  y: number;
}

export interface Wall {
  id: number;
  p1Id: number;
  p2Id: number;
}

export interface TileDimensions {
  width: number;
  height: number;
}

export const TILE_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#84cc16', // lime-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#78716c', // stone-500
];

export const COLOR_NAMES: Record<string, string> = {
  '#ef4444': 'Red',
  '#f97316': 'Orange',
  '#eab308': 'Yellow',
  '#84cc16': 'Lime',
  '#22c55e': 'Green',
  '#06b6d4': 'Cyan',
  '#3b82f6': 'Blue',
  '#8b5cf6': 'Violet',
  '#ec4899': 'Pink',
  '#78716c': 'Stone',
};

export interface Tile {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  number: string | null;
}

export interface CalculationResult {
  tileCount: number;
  colorCount: number;
  tileCountsByColor: Record<string, number>;
  total: number; // This can be removed if tileCount replaces it, but let's check usage. For now, let's assume total = tileCount.
  polygonArea: number;
  perimeter: number;
}

export interface Area {
  id: number;
  name: string;
  points: Point[];
  walls: Wall[];
  color: string;
  isClosed: boolean;
  calculationResult: CalculationResult | null;
  isVisible: boolean;
}

export type Tool = 'POINTER' | 'WALL' | 'MOVE' | 'ERASE' | 'PAN' | 'FIELD' | 'TILE' | 'PLACE_FIELD' | 'FILL' | 'CUT';

export type VisibilityMode = 'both' | 'tilesOnly' | 'floorPlanOnly';

export type IconType = Tool | 'SNAP' | 'UNDO' | 'REDO' | 'STATS' | 'SAVE' | 'LOAD' | 'EYE_OPEN' | 'EYE_CLOSED' | 'ZOOM_IN' | 'ZOOM_OUT' | 'ZOOM_EXTENTS' | 'RESET' | 'RESTORE' | 'VIEW_MODE' | 'GITHUB';

export interface HistoryState {
  areas: Area[];
  tiles: Tile[];
}

export type SnapType = 'vertex' | 'midpoint' | 'intersection' | 'grid' | 'extension' | 'none';

export interface SnapIndicatorInfo {
  pos: { x: number, y: number };
  type: SnapType;
}

export interface CutTilePiece {
  id: string; // Unique ID for the piece
  originalTile: Tile;
  
  // Geometry points are relative to the piece's own (x, y) origin.
  // First array is the outer boundary. Subsequent arrays are holes.
  polygons: Point[][]; 

  // Segments of the cut, relative to the piece's (x, y) origin.
  // Used to highlight the cut edge on offcut pieces.
  cutSegments?: Point[][];
  
  // Current position for MOVE tool (top-left of the original tile's bbox)
  x: number;
  y: number;
  
  // State
  isOffcut: boolean;
  wastePercentage: number;
}

export type MoveSelection = 
  | { type: 'point'; id: number; areaId: number }
  | { type: 'wall'; id: number; areaId: number }
  | { type: 'area'; id: number; areaId: number }
  | { type: 'tile'; id: number }
  | { type: 'cutPiece', id: string };
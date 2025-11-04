// Fix: Centralized Point type definition by importing from types.ts
import type { Point } from '../types';

const EPSILON = 1e-9; // Module-level epsilon for floating-point comparisons

export function distance(p1: {x: number, y: number}, p2: {x: number, y: number}): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

export function getAngle(p1: Point, p2: Point): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
}

// A robust function to check if a point is inside a polygon, including its boundary.
export function pointInPolygon(point: { x: number; y: number }, polygon: Point[]): boolean {
    const n = polygon.length;
    if (n < 3) return false;

    // First, check if the point lies on any of the polygon's edges.
    // This method is robust for checking collinearity and segment inclusion.
    for (let i = 0; i < n; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % n];
        
        const d_p1_p2 = distance(p1, p2);
        const d_p1_point = distance(p1, point);
        const d_point_p2 = distance(point, p2);

        // If p1-point-p2 are collinear, the sum of the smaller distances will equal the total distance.
        if (Math.abs(d_p1_point + d_point_p2 - d_p1_p2) < EPSILON) {
            return true; // Point is on the edge.
        }
    }

    // If not on an edge, use the standard ray-casting algorithm for points strictly inside.
    let isInside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const pi = polygon[i];
        const pj = polygon[j];
        
        const intersect = ((pi.y > point.y) !== (pj.y > point.y))
            && (point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x);
        
        if (intersect) {
            isInside = !isInside;
        }
    }

    return isInside;
}


// Shoelace formula to calculate the area of a polygon
export function polygonArea(polygon: Point[]): number {
  if (polygon.length < 3) return 0;
  let area = 0;
  let i = 0, j = polygon.length - 1;
  for (i = 0; i < polygon.length; j = i++) {
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area / 2);
}

// Calculate the perimeter of a polygon
export function polygonPerimeter(polygon: Point[]): number {
    let perimeter = 0;
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
        perimeter += distance(p1, p2);
    }
    return perimeter;
}


// Line segment intersection
function onSegment(p: Point, q: Point, r: Point): boolean {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
           q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}

function orientation(p: Point, q: Point, r: Point): number {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(val) < EPSILON) return 0; // Collinear check with tolerance
    return (val > 0) ? 1 : 2; // Clockwise or Counterclockwise
}

export function segmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) return true;

    // Special Cases for collinear points
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;

    return false;
}

export function polygonIntersectsRectangle(polygon: Point[], rect: { x: number; y: number; width: number; height: number }): boolean {
    const rectPoints: Point[] = [
        { id: -1, x: rect.x, y: rect.y },
        { id: -2, x: rect.x + rect.width, y: rect.y },
        { id: -3, x: rect.x + rect.width, y: rect.y + rect.height },
        { id: -4, x: rect.x, y: rect.y + rect.height },
    ];

    // Check if any polygon vertex is inside the rectangle
    for (const p of polygon) {
        if (p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height) {
            return true;
        }
    }

    // Check if any rectangle corner is inside the polygon
    for (const p of rectPoints) {
        if (pointInPolygon(p, polygon)) {
            return true;
        }
    }

    // Check if any polygon edge intersects with any rectangle edge
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const q1 = polygon[(i + 1) % polygon.length];
        for (let j = 0; j < rectPoints.length; j++) {
            const p2 = rectPoints[j];
            const q2 = rectPoints[(j + 1) % rectPoints.length];
            if (segmentsIntersect(p1, q1, p2, q2)) {
                return true;
            }
        }
    }
    
    return false;
}

// Finds the intersection of two infinite lines defined by points (p1, p2) and (p3, p4).
// Returns the intersection point or null if lines are parallel.
export function getLineIntersection(p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}, p4: {x:number, y:number}): { x: number; y: number } | null {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < 1e-9) { // Using an epsilon for floating point safety
        return null; // Parallel or collinear lines
    }
    
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;

    const intersectX = p1.x + t * (p2.x - p1.x);
    const intersectY = p1.y + t * (p2.y - p1.y);

    return { x: intersectX, y: intersectY };
}

// AABB intersection test
export function rectanglesIntersect(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

// Sutherland-Hodgman algorithm for clipping a subject polygon against a clip polygon.
// Returns the intersection polygon.
export function clipPolygonByPolygon(subjectPolygon: Point[], clipPolygon: Point[]): Point[] {
    let outputList = subjectPolygon;

    for (let i = 0; i < clipPolygon.length; i++) {
        const clipEdgeP1 = clipPolygon[i];
        const clipEdgeP2 = clipPolygon[(i + 1) % clipPolygon.length];
        
        const inputList = outputList;
        outputList = [];
        if (inputList.length === 0) break;

        let S = inputList[inputList.length - 1];

        for (let j = 0; j < inputList.length; j++) {
            const E = inputList[j];
            const crossProduct = (p2: Point, p1: Point, p: Point) => (p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x);

            const sInside = crossProduct(clipEdgeP2, clipEdgeP1, S) >= 0;
            const eInside = crossProduct(clipEdgeP2, clipEdgeP1, E) >= 0;
            
            if (sInside && eInside) {
                outputList.push(E);
            } else if (sInside && !eInside) {
                const intersection = getLineIntersection(S, E, clipEdgeP1, clipEdgeP2);
                if (intersection) outputList.push({id: -1, ...intersection});
            } else if (!sInside && eInside) {
                 const intersection = getLineIntersection(S, E, clipEdgeP1, clipEdgeP2);
                if (intersection) outputList.push({id: -1, ...intersection});
                outputList.push(E);
            }
            S = E;
        }
    }
    return outputList;
}
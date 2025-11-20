// Check if segment p1-p2 intersects with segment p3-p4
export function doLinesIntersect(p1, p2, p3, p4) {
    function getOrientation(p, q, r) {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        if (Math.abs(val) < 0.001) return 0; // Collinear
        return (val > 0) ? 1 : 2;
    }

    function onSegment(p, q, r) {
        return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
            q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
    }

    const o1 = getOrientation(p1, p2, p3);
    const o2 = getOrientation(p1, p2, p4);
    const o3 = getOrientation(p3, p4, p1);
    const o4 = getOrientation(p3, p4, p2);

    if (o1 !== o2 && o3 !== o4) return true;

    // Ignore shared endpoints
    if (arePointsEqual(p1, p3) || arePointsEqual(p1, p4) ||
        arePointsEqual(p2, p3) || arePointsEqual(p2, p4)) {
        return false;
    }

    if (o1 === 0 && onSegment(p1, p3, p2)) return true;
    if (o2 === 0 && onSegment(p1, p4, p2)) return true;
    if (o3 === 0 && onSegment(p3, p1, p4)) return true;
    if (o4 === 0 && onSegment(p3, p2, p4)) return true;

    return false;
}

function arePointsEqual(p1, p2) {
    return Math.abs(p1.x - p2.x) < 0.1 && Math.abs(p1.y - p2.y) < 0.1;
}

// Check if polyline (array of points) intersects with another polyline
export function doPolylineIntersection(path1, path2) {
    for (let i = 0; i < path1.length - 1; i++) {
        for (let j = 0; j < path2.length - 1; j++) {
            if (doLinesIntersect(path1[i], path1[i + 1], path2[j], path2[j + 1])) {
                return true;
            }
        }
    }
    return false;
}


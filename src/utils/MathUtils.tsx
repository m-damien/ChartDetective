import AxisCoordinate1D from "../datastructure/AxisCoordinate1D";
import AxisCoordinate2D from "../datastructure/AxisCoordinate2D";

export default class MathUtils {
    /**
     * Project a value that is contained within [minA, maxA] to the corresponding value in [minB, maxB]
     * @param value 
     * @param minA 
     * @param maxA 
     * @param minB 
     * @param maxB 
     * @returns Projected value
     */
    static project(value : number, minA : number, maxA : number, minB : number, maxB : number) : number {
        return ((value-minA)/(maxA-minA)*(maxB-minB))+minB;
    }

    static interpolate(points : AxisCoordinate2D[], pixelPosX : number) : AxisCoordinate2D {
        if (points.length === 0) {
            return null;
        }

        // First, find the two values immediately before and after the value to interpolate
        var prevPt = points[0];
        var nextPt = points[points.length-1];

        // This assumes the points are not sorted, otherhwise could be optimized
        for (var i = 0; i < points.length; ++i) {
            var pt = points[i];

            if (pt.x.pixel === pixelPosX) {
                // Exact match
                return pt;
            }
            if (pt.x.pixel > pixelPosX && pt.x.pixel < nextPt.x.pixel) {
                nextPt = pt;
            }

            if (pt.x.pixel < pixelPosX && pt.x.pixel > prevPt.x.pixel) {
                prevPt = pt;
            }
        }

        if (prevPt.x.pixel > pixelPosX || nextPt.x.pixel < pixelPosX) {
            return null; // Cannot interpolate if lies outside of range
        }

        var range = Math.abs(nextPt.x.pixel - prevPt.x.pixel);
        // We have an exact match, no need to interpolate
        if (range === 0) {
            return nextPt;
        }

        var coeff = Math.abs(nextPt.x.pixel - pixelPosX) / range;
        var pixelPosY = (prevPt.y.pixel * (coeff) + nextPt.y.pixel * (1-coeff));

        return new AxisCoordinate2D(
            new AxisCoordinate1D(pixelPosX, prevPt.x.axis), 
            new AxisCoordinate1D(pixelPosY, prevPt.y.axis)
        );
    }

    /**
     * Euclidean distance between two points
     * @param ax 
     * @param ay 
     * @param bx 
     * @param by 
     */
    static dist(ax, ay, bx, by) : number {
        const dx = bx - ax;
        const dy = by = ay;
        return Math.sqrt(dx*dx + dy*dy);
    }
}
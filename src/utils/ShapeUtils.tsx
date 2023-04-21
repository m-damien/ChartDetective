import AxisCoordinate1D from "../datastructure/AxisCoordinate1D";
import ShapeCommand from "../datastructure/ShapeCommand";
import Axis from "../datastructure/chartelements/Axis";
import AxisCoordinate2D from "../datastructure/AxisCoordinate2D";

export default class ShapeUtils {
    /**
     * Converts a list of shapes to a list of coordinates
     * This implementation is fairly basic, possible improvements:
     * - Handling other types (e.g. Bezier curves)
     * - Ignoring useless moveto
     * @param {[ShapeCommand]} shapes 
     * @param {Axis} xaxis
     * @param {Axis} yaxis
     * @returns {[AxisCoordinate2D]} A list containing all the points forming the shape
     */
    static shapesToPoints(shapes : ShapeCommand[], xaxis : Axis, yaxis : Axis) : AxisCoordinate2D[] {
        var points : AxisCoordinate2D[] = [];

        for (var i = 0; i < shapes.length; ++i) {
            var path = shapes[i].path;
            var transfo = shapes[i].transform;
            for (var j = 0; j < path.length; ++j) {
                var type = path[j][0];
                var args = path[j][1];
    
                if (type === ShapeCommand.types.LINETO || type === ShapeCommand.types.MOVETO) {
                    var pt = new DOMPoint(args[0], args[1]);
                    var transfoPt = pt.matrixTransform(transfo);
                    var xcoord = new AxisCoordinate1D(transfoPt.x, xaxis);
                    var ycoord = new AxisCoordinate1D(transfoPt.y, yaxis);
                    points.push(new AxisCoordinate2D(xcoord, ycoord));
                }
            }
        }
        return points;
    }

    /**
     * Take one shape and split into sub-shapes, if possible
     * This assumes multiple disconnected shapes are being drawn using the same path (by using 'moveto')
     * @param shape 
     */
    static splitIntoSubShapes(shape : ShapeCommand) : ShapeCommand[] {
        var path = shape.path;
        var transfo = shape.transform;
        var subShapes = [];
        let currentPath = [];

        for (var j = 0; j < path.length; ++j) {
            var type = path[j][0];

            if (type === ShapeCommand.types.MOVETO) {
                if (currentPath.length > 1) {
                    // TODO: Smarter split, based on the moveto position. Only split if moves away from any known point
                    const subShape = new ShapeCommand();
                    ShapeCommand.copyStyle(subShape, shape);
                    subShape.path = currentPath;
                    subShape.transform = transfo;
                    subShape.isFilled = shape.isFilled;
                    subShape.computeBBox(null);
                    subShapes.push(subShape);
                    currentPath = [];
                }
            }

            currentPath.push(path[j]);
        }

        if (currentPath.length > 0) {
            const subShape = new ShapeCommand();
            ShapeCommand.copyStyle(subShape, shape);
            subShape.path = currentPath;
            subShape.transform = transfo;
            subShape.isFilled = shape.isFilled;
            subShape.computeBBox(null);
            subShapes.push(subShape);
        }

        return subShapes;
    }

    /**
     * Same as #splitIntoSubShapes but for a list of shapes (all shapes are going to be split, and resulting subshapes are returned in the same list)
     * @param shapes 
     */
    static splitShapesIntoSubShapes(shapes : ShapeCommand[]) : ShapeCommand[] {
        let subShapes = [];
        for (const shape of shapes) {
            subShapes = subShapes.concat(ShapeUtils.splitIntoSubShapes(shape));
        }
        return subShapes;
    }

    /**
     * Calculate the angles between the successive path operations froming the shape
     * @param shape 
     * @param multiplicator Multiplicators applied to the angle in radians. By default, will convert to degree
     * @returns List of shape angles in degree
     */
    static shapeToAngles(shape : ShapeCommand, multiplicator = 180/Math.PI, relatedToOrigin = false)  : number[] {
        const angles = [];

        if (shape != null && shape.path.length > 2) {
            const positionHistory : number[][] = [];
            for (var i = 0; i < shape.path.length; ++i) {
                const type = shape.path[i][0];

                if (type === ShapeCommand.types.BEGIN) {
                    continue; // Thse commands do not have x,y positions, so we skip them
                } 

                let x = 0;
                let y = 0;
                if (type === ShapeCommand.types.CLOSE) {
                    x = positionHistory[0][0]
                    y = positionHistory[0][1]
                } else {
                    const args = shape.path[i][1];
                    x = args[0];
                    y = args[1];
                }
                
                positionHistory.push([x, y]);
                
                if (relatedToOrigin) {
                    if (positionHistory.length >= 2) {
                        const p1 = positionHistory[positionHistory.length-2];
                        const p2 = positionHistory[positionHistory.length-1];
    
                        const angleRad = Math.atan2(p1[1] - p2[1], p1[0] - p2[0]);
                        const angle = Math.round(angleRad * multiplicator);
                        angles.push(angle)
                    }
                } else {
                    if (positionHistory.length >= 3) {
                        const p1 = positionHistory[positionHistory.length-3];
                        const p2 = positionHistory[positionHistory.length-2];
                        const p3 = positionHistory[positionHistory.length-1];
    
                        const dAx = p2[0] - p1[0];
                        const dAy = p2[1] - p1[1];
                        const dBx = p3[0] - p2[0];
                        const dBy = p3[1] - p2[1];
                        const angleRad = Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy);
                        const angleDeg = angleRad * 180/Math.PI;
                        
                        if (Math.abs(angleDeg) !== 0 && Math.abs(angleDeg) !== 180) { // Discard flat angles
                            const angle = Math.round(angleRad * multiplicator);
                            angles.push(angle)
                        }
                    }
                }

                
            }  
        }

        return angles;
    }

    static isLine(shape : ShapeCommand) : boolean {
        return ShapeUtils.shapeToAngles(shape).length === 0;
    }

    static isRectangle(shape : ShapeCommand) : boolean {
        const angles = ShapeUtils.shapeToAngles(shape);
        return angles.length === 3 && angles.every((e) => {return Math.abs(e) === 90});
    }

    // https://stackoverflow.com/a/11508164
    static colorHexToRgb(hex : string) : number[] {
        hex = hex.startsWith('#') ? hex.substring(1, hex.length) : hex;
        var bigint = parseInt(hex, 16);
        var r = (bigint >> 16) & 255;
        var g = (bigint >> 8) & 255;
        var b = bigint & 255;
    
        return [r, g, b];
    }

    /**
     * Test if a color is a color (as in, not black, white, or gray)
     * @param hex 
     */
    static isColor(hex : string) : boolean {
        const rgb = ShapeUtils.colorHexToRgb(hex);
        return !(rgb[0] === rgb[1] && rgb[1] === rgb[2]);
    }
}
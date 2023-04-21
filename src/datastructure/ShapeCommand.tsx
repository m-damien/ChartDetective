interface Rectangle {
    x : number;
    y : number;
    width : number;
    height : number;
}

interface Point {
    x : number;
    y : number;
}

export default class ShapeCommand {
    path : any[];
    isFilled : boolean;
    lineWidth : number;
    lineCap : string;
    lineJoin : string;
    miterLimit : number;
    lineDash : number[];
    font : string;
    textAlign : string;
    textBaseline : string;
    direction : string;
    fillStyle : string;
    strokeStyle : string;
    transform : any;
    globalAlpha : number;
    globalCompositeOperation : string;
    bbox : any;
    clipPaths : any[][];

    text : string;
    textX : number;
    textY : number;

    unicode : any;

    constructor() {
        this.path = [];
        this.isFilled = false;
        this.lineWidth = 1.0;
        this.lineCap = "butt";
        this.lineJoin = "miter";
        this.miterLimit = 10;
        this.lineDash = [];
        
        this.font = '10px sans-serif';
        this.textAlign = 'start';
        this.textBaseline = 'alphabetic';
        this.direction = 'inherit';

        this.fillStyle = "#000";
        this.strokeStyle = "#000";
        this.transform = null;

        this.globalAlpha = 1.0;
        this.globalCompositeOperation = 'source-over';

        this.bbox = {x:0, y:0, width:0, height:0};
        this.clipPaths = null;
    }

    static types = {
        BEGIN: 0,
        CLOSE: 1,
        MOVETO: 2,
        LINETO: 3,
        CURVETO: 4
    };
    
    /**
     * Apply the current transform used by this shape to a coordinate
     * @param {Number} x 
     * @param {Number} y 
     */
    transformPos(x : number, y : number, transform = this.transform) : any {
        var point = new DOMPoint(x, y);
        var transformedPt = point.matrixTransform(transform);

        return {x: transformedPt.x, y: transformedPt.y};
    }

    get rect() : any {
        return this.bbox;
    }

    /**
     * Test if the ShapeCommand is fully contained within a specified rectangle
     * @param {Rectangle} rect
     */
    isContained(rect : Rectangle) : boolean {
        return rect.x < this.rect.x && rect.y < this.rect.y &&
        rect.x + rect.width > this.rect.x + this.rect.width &&
        rect.y + rect.height > this.rect.y + this.rect.height;
    }

    pointsToRect(topLeft : Point, botRight : Point) : any {
        return {
            x: Math.min(topLeft.x, botRight.x), 
            y: Math.min(topLeft.y, botRight.y), 
            width: Math.abs(botRight.x-topLeft.x), 
            height: Math.abs(botRight.y-topLeft.y)
        };
    }

    computeBBox(ctx : CanvasRenderingContext2D) : void {
        if (this.text !== undefined) {
            // We make sure the ctx has the right style to properly measure the text width
            var prevFont = ctx.font;
            ctx.font = this.font;
            
            var metrics = ctx.measureText(this.text);
            var pos = this.transformPos(this.textX-metrics.actualBoundingBoxLeft,
                this.textY-metrics.actualBoundingBoxAscent);

            var posEnd = this.transformPos(this.textX+metrics.actualBoundingBoxRight,
                this.textY+metrics.actualBoundingBoxDescent);

            this.bbox = this.pointsToRect(pos, posEnd);

            // Restore style
            ctx.font = prevFont;
        } else {
            var pathRect = this.pathToRect(this.path);
            var thickness = 0;//this.isFilled? 0 : this.lineWidth/2;
            var topLeft = this.transformPos(pathRect.left-thickness, pathRect.top-thickness);
            var botRight = this.transformPos(pathRect.right+thickness, pathRect.bottom+thickness);
    
            this.bbox = this.pointsToRect(topLeft, botRight);
        }

        // Take into account clipping path
        if (this.clipPaths) {
            for (const clipPath of this.clipPaths) {
                if (clipPath) {
                    const rect = this.pathToRect((clipPath as any).path);
                    const transform = (clipPath as any).transform;

                    var topLeft = this.transformPos(rect.left, rect.top, transform);
                    var botRight = this.transformPos(rect.right, rect.bottom, transform);
                    var transformedRect = this.pointsToRect(topLeft, botRight);

                    // Intersect with previous clipping rect if there is one
                    var leftX   = Math.max( transformedRect.x, this.bbox.x );
                    var rightX  = Math.min( transformedRect.x+transformedRect.width, this.bbox.x+this.bbox.width );
                    var topY    = Math.max( transformedRect.y, this.bbox.y );
                    var bottomY = Math.min( transformedRect.y+transformedRect.height, this.bbox.y+this.bbox.height);
                    this.bbox = {x: leftX, y: topY, width: rightX-leftX, height: bottomY-topY };
                }
            }
        }
    }

    pathToRect(path) {
        var lastPt = {x: 0, y: 0};
        var minX = Number.MAX_SAFE_INTEGER
        var minY = Number.MAX_SAFE_INTEGER;
        var maxX = Number.MIN_SAFE_INTEGER;
        var maxY = Number.MIN_SAFE_INTEGER;

        for (var i = 0; i < path.length; ++i) {
            var type = path[i][0];
            var args = path[i][1];
            if (type === ShapeCommand.types.MOVETO) {
                lastPt = {x: args[0], y: args[1]};
            } else if (type === ShapeCommand.types.LINETO) {
                minX = Math.min(lastPt.x, args[0], minX);
                minY = Math.min(lastPt.y, args[1], minY);
                maxX = Math.max(lastPt.x, args[0], maxX);
                maxY = Math.max(lastPt.y, args[1], maxY);
                lastPt = {x: args[0], y: args[1]};
            } else if (type === ShapeCommand.types.CURVETO) {
                //TODO: Better approximation
                // The bbox could be much larger depending on the curve
                // Needs more computations to estimate it properly
                minX = Math.min(lastPt.x, args[4], minX);
                minY = Math.min(lastPt.y, args[5], minY);
                maxX = Math.max(lastPt.x, args[4], maxX);
                maxY = Math.max(lastPt.y, args[5], maxY);
                lastPt = {x: args[4], y: args[5]};
            }
        }

        return {left: minX, x: minX, top: minY, y: minY, width: maxX-minX, height: maxY-minY, right: maxX, bottom: maxY};
    }

    addCmd(type : number, args=[]) : void {
        this.path.push([type, args]);
    }

    /**
     * Copy all style related variables of b and apply them on a
     * @param {Object} a Receiver: Object that receive the style of b
     * @param {Object} b Giver: Object that gets its style copied
     */
    static copyStyle(a : any, b : any) : void {
        a.lineWidth = b.lineWidth;
        a.lineCap = b.lineCap;
        a.lineJoin = b.lineJoin;
        a.miterLimit = b.miterLimit;
        // setLineDash is kind of an outlier in the canvas API in that it uses functions
        // Because we want to stay compatible with Contexts, we need to use the function if it exists
        var lineDash = b.getLineDash !== undefined ? b.getLineDash() : b.lineDash;
        if (a.setLineDash !== undefined) {
            a.setLineDash(lineDash);
        } else {
            a.lineDash = lineDash;
        }
        
        a.font = b.font;
        a.textAlign = b.textAlign;
        a.textBaseline = b.textBaseline;
        a.direction = b.direction;

        a.fillStyle = b.fillStyle;
        a.strokeStyle = b.strokeStyle;
        
        a.globalAlpha = b.globalAlpha;
        a.globalCompositeOperation = b.globalCompositeOperation;

        a.clipPaths = b.clipPaths;
    }


    saveStyle(ctx : any) : void {
        ShapeCommand.copyStyle(this, ctx);

        this.transform = DOMMatrix.fromMatrix(ctx.getTransform());
    }

    applyStyle(ctx : any) : void {
        ShapeCommand.copyStyle(ctx, this);

        const currentTransform = DOMMatrix.fromMatrix(ctx.getTransform());

        if (this.clipPaths) {
            for (const clipPath of this.clipPaths) {
                if (clipPath) {
                    const path = (clipPath as any).path;
                    const transform = (clipPath as any).transform;

                    ctx.setTransform(currentTransform.a, currentTransform.b,
                        currentTransform.c, currentTransform.d, 
                        currentTransform.e, currentTransform.f);

                    ctx.transform(transform.a, transform.b,
                        transform.c, transform.d, 
                        transform.e, transform.f);

                    this.applyPath(path, ctx);
                    ctx.clip();
                }
            }
        }

        ctx.setTransform(currentTransform.a, currentTransform.b,
            currentTransform.c, currentTransform.d, 
            currentTransform.e, currentTransform.f);

        ctx.transform(this.transform.a, this.transform.b,
            this.transform.c, this.transform.d, 
            this.transform.e, this.transform.f);
    }

    getTransform() : DOMMatrix {
        return this.transform;
    }

    clone() : ShapeCommand {
        var clone = new ShapeCommand();
        clone.saveStyle(this);
        clone.path = clone.path.concat(this.path);
        if (this.clipPaths) {
            clone.clipPaths = clone.clipPaths.concat(this.clipPaths);
        }
        clone.isFilled = this.isFilled;

        clone.text = this.text;
        clone.textX = this.textX;
        clone.textY = this.textY;
        clone.unicode = this.unicode;

        clone.bbox = {x: this.bbox.x, y: this.bbox.y, width: this.bbox.width, height: this.bbox.height};

        return clone;
    }

    applyPath(path, ctx) {
        for (var i = 0; i < path.length; ++i) {
            var type = path[i][0];
            var args = path[i][1];

            if (type === ShapeCommand.types.BEGIN) {
                ctx.beginPath();
            } else if (type === ShapeCommand.types.CLOSE) {
                ctx.closePath();
            } else if (type === ShapeCommand.types.MOVETO) {
                ctx.moveTo(args[0], args[1]);
            } else if (type === ShapeCommand.types.LINETO) {
                ctx.lineTo(args[0], args[1]);
            } else if (type === ShapeCommand.types.CURVETO) {
                ctx.bezierCurveTo(args[0], args[1], args[2], args[3], args[4], args[5]);
            }
        }
    }

    draw(ctx : CanvasRenderingContext2D) : void {
        ctx.save();
        this.applyStyle(ctx);

        if (this.text !== undefined) {
            if (this.isFilled) {
                ctx.fillText(this.text, this.textX, this.textY);
            } else {
                ctx.strokeText(this.text, this.textX, this.textY);
            }
            
        } else {
            this.applyPath(this.path, ctx);

            if (this.isFilled) {
                ctx.fill();
            } else {
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}
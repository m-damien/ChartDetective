import ShapeCommand from "../../datastructure/ShapeCommand";
import ShapeUtils from "../../utils/ShapeUtils";

class ComparableShape {
    angles : number[];
    shape : ShapeCommand;
    hash : string;

    constructor(shape : ShapeCommand) {
        this.angles = [];
        this.shape = shape;
        this.hash = "";

        if (shape.text !== undefined) {
            this.hash = "text";
        } else {
            this.angles = ShapeUtils.shapeToAngles(shape, 45/Math.PI, true); // We are generous and only consider 10 different angles + related to origin as orientations matter
            this.hash = this.angles.join(".");
        }
    }

    /**
     * Called whenever another shape is found to have the same hash
     * Used to updated the shape and only keep the most representative one
     * @param shape 
     */
    updateShape(shape : ShapeCommand) : void {
        // Keep the shape that fits the best inside a rectangle
        // If we have to draw an icon, it will fit better if it's squared
        // We also prefer non-filled versions
        const squareRatio = Math.abs(1 - (this.shape.rect.width/this.shape.rect.height));
        const candidateRatio = Math.abs(1 - (shape.rect.width/shape.rect.height));

        if ((!shape.isFilled && this.shape.isFilled) || candidateRatio < squareRatio) {
            this.shape = shape;
        }
    }
}

export default class ShapeFilter {
    /**
     * Extract the value used by the filter
     * @param {ShapeCommand} shape 
     */
    getValue(shape : ShapeCommand) : any {
        // Compute a representation of the shape taht can easily be compared
        // Here, we compute the list of angles
        return new ComparableShape(shape);
    }

    /**
     * Paint a representation of the value, usually used as icons on filter buttons
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Color} value 
     * @param {Number} width Width of the canvas
     * @param {Number} height Height of the canvas
     */
    paint(ctx : CanvasRenderingContext2D, value : ComparableShape, width : number, height : number) : void {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "black";
        if (value.hash === "text") {
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = 'bold 80px Arial';
            ctx.fillText("Aa", width/2, height/2);
        } else if (value.hash === "misc") {
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = 'bold 100px Arial';
            ctx.fillText("?", width/2, height/2);
        } else {
            const rect = value.shape.rect;
            const s = (width-1) / Math.max(rect.width, rect.height);

            ctx.save();
			// Center the shape
			ctx.translate((width-(rect.width*s))/2.0, (width-(rect.height*s))/2.0);
			// Resize to fit within the icon
			ctx.scale(s, s);
			// Place the shape at 0,0
			ctx.translate(-rect.x, -rect.y);
            // Save the shape's style
            var cmdStyle = {};
            ShapeCommand.copyStyle(cmdStyle, value.shape);
            value.shape.fillStyle = value.shape.strokeStyle = "black"
            value.shape.globalAlpha = 1.0;

            value.shape.draw(ctx);
            // Restore the shape's original style
            ShapeCommand.copyStyle(value.shape, cmdStyle);

            ctx.restore();
        }
    }

    getName() : string {
        return "Shape Filter";
    }

    minNumberElements() : number {
        return 1; // Only group shapes as one filter if there is more than 1 element
    }
}
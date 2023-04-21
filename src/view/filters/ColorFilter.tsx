import ShapeCommand from "../../datastructure/ShapeCommand";


class ComparableColor {
    color : string
    hash : string
    constructor(shape : ShapeCommand) {
        this.hash = this.color = shape.isFilled ? shape.fillStyle : shape.strokeStyle;
    }

    /**
     * Called whenever another shape is found to have the same hash
     * Used to updated the shape and only keep the most representative one
     * @param shape 
     */
    updateShape(shape : ShapeCommand) : void {
        return;
    }
}
export default class ColorFilter {
    /**
     * Extract the value used by the filter
     * @param {ShapeCommand} shape 
     */
    getValue(shape : ShapeCommand) : any {
        return new ComparableColor(shape);
    }

    /**
     * Paint a representation of the value, usually used as icons on filter buttons
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Color} value 
     * @param {Number} width Width of the canvas
     * @param {Number} height Height of the canvas
     */
    paint(ctx : CanvasRenderingContext2D, value : ComparableColor, width : number, height : number) : void {
        ctx.fillStyle = value.color;
        ctx.fillRect(0, 0, width, height);
    }

    getName() : string {
        return "Color Filter";
    }

    minNumberElements() : number {
        return 0; // Only group colours as one filter if there is more than 0 element
    }
}
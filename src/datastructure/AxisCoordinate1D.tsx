import Axis from "./chartelements/Axis";

export default class AxisCoordinate1D {
    pixel : number;
    axis : Axis;

    /**
     * 
     * @param {Number} pixelPosition 
     * @param {Axis} axis 
     */
    constructor(pixelPosition : number, axis : Axis) {
        this.pixel = pixelPosition;
        this.axis = axis;
    }

    get value() : string {
        return this.axis.pixelToTick(this.pixel);
    }

    set value(newValue : string) {
        this.pixel = this.axis.tickToPixel(newValue);
    }

    clone(axis : Axis) : AxisCoordinate1D {
        return new AxisCoordinate1D(this.pixel, axis);
    }
}
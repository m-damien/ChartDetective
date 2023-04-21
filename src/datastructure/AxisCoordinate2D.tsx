import AxisCoordinate1D from "./AxisCoordinate1D"
import Axis from "./chartelements/Axis";

export default class AxisCoordinate2D {
    x : AxisCoordinate1D;
    y : AxisCoordinate1D;

    constructor(x: AxisCoordinate1D, y : AxisCoordinate1D) {
        this.x = x;
        this.y = y;
    }

    clone(axisX : Axis = this.x.axis, axisY : Axis = this.y.axis) : AxisCoordinate2D {
        return new AxisCoordinate2D(this.x.clone(axisX), this.y.clone(axisY));
    }
}
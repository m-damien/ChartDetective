import AxisCoordinate2D from "../AxisCoordinate2D";
import Axis from "./Axis";
import ChartElement, { ChartElementType } from "./ChartElement";
import SubChartElement from "./SubChartElement";


export enum Bound {
    UPPER,
    LOWER
}

export default class ErrorBar extends SubChartElement {
    _bound : Bound
    /**
     * 
     */
    constructor(serie : ChartElement, bound : Bound) {
        super(ChartElementType.ERRORBAR, serie, "↳ Error " + (bound === Bound.UPPER? "⏉" : "⏊"));
        this._bound = bound;
    }

    get data() : AxisCoordinate2D[] {
        // We make sure that the data is always at least the same size as the serie
        if (this._data.length < this._serie.data.length) {
            for (let i = this._data.length; i < this._serie.data.length; ++i) {
                this._data.push(this._serie.data[i].clone());
            }
        }

        return this._data;
    }

    /**
     * Create a copy of this ErrorBar element
     * @returns {ErrorBar} a copy of the element
     */
    clone(axisX : Axis, axisY : Axis) : ErrorBar {
        var copy = new ErrorBar(this._serie, this._bound);
        copy.copy(this, axisX, axisY);
        return copy;
    }

    isUpperBound() : boolean {
        return this._bound === Bound.UPPER;
    }

    isLowerBound() : boolean {
        return this._bound === Bound.LOWER;
    }
}
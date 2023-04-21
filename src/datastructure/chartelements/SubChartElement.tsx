import Axis from "./Axis";
import ChartElement, { ChartElementType } from "./ChartElement";


export enum Bound {
    UPPER,
    LOWER
}

export default class SubChartElement extends ChartElement {
    _serie : ChartElement // Sub elements cannot live on their own, they are always associated with series
    /**
     * 
     */
    constructor(type : ChartElementType, serie : ChartElement, name : string) {
        super(type, name);
        this._serie = serie;
    }

    /**
     * Create a copy of this ErrorBar element
     * @returns {ErrorBar} a copy of the element
     */
    clone(axisX : Axis, axisY : Axis) : SubChartElement {
        var copy = new SubChartElement(this._type, this._serie, this.name);
        copy.copy(this, axisX, axisY);
        return copy;
    }

    getMainColor() : string {
        // Inherit the color of the associated serie
        return this._serie.getMainColor();
    }

    getMainSerie() : ChartElement {
        return this._serie;
    }

    canHaveErrorBars() : boolean {
        return false;
    }
}
import MathUtils from "../../utils/MathUtils";
import ShapeUtils from "../../utils/ShapeUtils";
import AxisCoordinate1D from "../AxisCoordinate1D";
import AxisCoordinate2D from "../AxisCoordinate2D";
import ShapeCommand from "../ShapeCommand";
import Axis from "./Axis";
import ErrorBar from "./ErrorBar";

export enum ChartElementType {
    AXIS,
    BAR,
    LINE,
    SCATTER,
    ERRORBAR,
    BOX_PLOT,
    BOX_PLOT_Q1,
    BOX_PLOT_Q3,
    BOX_PLOT_MIN,
    BOX_PLOT_MAX
}

export default class ChartElement {
    _type : ChartElementType;
    name : string;
    _data : AxisCoordinate2D[];
    shapes : ShapeCommand[];
    linkedElements : ChartElement[];
    mainColor : string;
    canBeInterpolated : boolean;
    _canHaveErrorBars : boolean;

    constructor(type : ChartElementType, name : string) {
        this._type = type;
        this.name = name;
        this._data = [];
        this.shapes = [];
        this.mainColor = null;
        this.linkedElements = [null, null]; // The first are always reserved for errorbars
        this.canBeInterpolated = type === ChartElementType.LINE; // Only lines can be interpolated
        this._canHaveErrorBars = type !== ChartElementType.BOX_PLOT; // Only boxplots cannot have error bars
    }

    get data() : AxisCoordinate2D[] {
        return this._data;
    }

    set data(d : AxisCoordinate2D[]) {
        this._data = d;
    }

    /**
     * Copy another ChartElement
     * @param {ChartElement} elementToCopy 
     */
    copy(elementToCopy : ChartElement, axisX : Axis, axisY : Axis) : void {
        this._type = elementToCopy._type;
        this.name = elementToCopy.name;
        this._data = [];
        for (var coord of elementToCopy.data) {
            this._data.push(coord.clone(axisX, axisY));
        }
        this.linkedElements = [...elementToCopy.linkedElements];
        // Shallow copy of shapes here
        // Shapes should not be cloned, we assume that the shape referenced still exists
        this.shapes = [...elementToCopy.shapes];
    }

    /**
     * Creates a copy of this element
     * @returns The cloned element
     */
    clone(axisX : Axis, axisY : Axis) : ChartElement {
        var copy = new ChartElement(this._type, this.name);
        copy.copy(this, axisX, axisY);
        return copy;
    }

    /**
     * Test the object's type
     * @param {ChartElement.type} type 
     */
    is(type : ChartElementType) : boolean {
        return this._type === type;
    }

    /**
     * Returns the main color of this serie based on the selected shapes
     */
    getMainColor() : string {
        // TODO: Reset main color everytime shapes is modified
        if (this.mainColor !== null) {
            return this.mainColor;
        }

        var colors = {};
        var mainColor = null;
        var mainColorfulColor = null;
        for (var i = 0; i < this.shapes.length; ++i) {
            var shape = this.shapes[i];
            var color = shape.strokeStyle;
            if (shape.isFilled) {
                color = shape.fillStyle;
            }
            colors[color] = color in colors ? colors[color]+1 : 1;

            if (mainColor === null || colors[color] > colors[mainColor]) {
                mainColor = color;
            }

            if (ShapeUtils.isColor(color) && (mainColorfulColor === null || colors[color] > colors[mainColorfulColor])) {
                mainColorfulColor = color;
            }
        }

        this.mainColor = mainColorfulColor !== null ? mainColorfulColor : mainColor; // Prefer colorful colors over gray/white/black
        return this.mainColor;
    }

    /**
     * Get the serie's coordinate at the X position
     * @param {String} x Value on the X axis
     * @returns {AxisCoordinate1D} The y value if it exists, otherwise null
     */
    getAtTickX(x : string) : AxisCoordinate1D {
        for (var i = 0; i < this.data.length; ++i) {
            var pt = this.data[i];
            if (pt.x.value === x) {
                return pt.y;
            }
        }

        return null;
    }

    getAtPixelX(pixelPosX : number, skipCount=0) : AxisCoordinate2D {
        if (!this.canBeInterpolated) {
            for (const coord of this.data) {
                if (coord.x.pixel === pixelPosX) {
                    if (skipCount === 0) {
                        return coord;
                    }
                    skipCount--;
                }
            }
            return null; // Value not found...
        }

        return MathUtils.interpolate(this.data, pixelPosX);
    }

    canHaveErrorBars() : boolean {
        return this._canHaveErrorBars;
    }

    hasErrorBars() : boolean {
        return this.linkedElements[0] !== null && this.linkedElements[1] !== null;
    }

    get upperErrorBar() : ErrorBar {
        return this.linkedElements[0] as ErrorBar;
    }

    set upperErrorBar(errorBar : ErrorBar) {
        this.linkedElements[0] = errorBar;
    }

    get lowerErrorBar() : ErrorBar {
        return this.linkedElements[1] as ErrorBar;
    }

    set lowerErrorBar(errorBar : ErrorBar) {
        this.linkedElements[1] = errorBar;
    }
}
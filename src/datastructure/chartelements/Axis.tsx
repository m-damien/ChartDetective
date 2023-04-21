import MathUtils from "../../utils/MathUtils";
import AxisCoordinate1D from "../AxisCoordinate1D";
import ChartElement, { ChartElementType } from "./ChartElement";


interface TickValue {
    pixel : number,
    value : string
}

export enum Interpolation {
    LINEAR,
    CATEGORICAL
}

export enum Direction {
    X,
    Y
}

export default class Axis extends ChartElement {
    _interpolation : Interpolation;
    _direction : Direction;
    ticks : TickValue[];
    /**
     * 
     * @param {Axis.interpolation} interpolation 
     */
    constructor(name : string, interpolation : number, direction : number) {
        super(ChartElementType.AXIS, name);
        this._interpolation = interpolation;
        this._direction = direction;
        this.ticks = [];
    }

    /**
     * Create a copy of this Axis element
     * @returns {Axis} a copy of the element
     */
    clone() : Axis {
        var copy = new Axis(this.name, this._interpolation, this._direction);
        copy.copy(this, null, null);
        copy.ticks = [];
        for (var tick of this.ticks) {
            copy.ticks.push({pixel: tick.pixel, value: tick.value});
        }

        return copy;
    }

    isHorizontal() : boolean {
        return this._direction === Direction.X;
    }

    isVertical() : boolean {
        return this._direction === Direction.Y;
    }

    /**
     * Add the value and position of a tick on the axis
     * If the axis is linear, only 2 tick values are needed
     * @param {String} value 
     * @param {Number} pixelPos 
     */
    addTickValue(value : string, pixelPos : number) : void {
        this.ticks.push({value: value, pixel: pixelPos});

        // If the value is not a number, set the axis as categorical
        if (!this.isCategorical() && isNaN(value as any)) {
            this._interpolation = Interpolation.CATEGORICAL;
        }

        // Keep the ticks sorted by their pixel position
        this.ticks = this.ticks.sort(function(a, b) {
            return a.pixel - b.pixel;
        });
    }

    /**
     * Convert a pixel position into the corresponding tick on the axis
     * @param {Number} pixelPos 
     * @returns {String} tick value
     */
    pixelToTick(pixelPos : number) : any {
        if (this.ticks.length === 0) {
            // Not enough ticks to do the conversion, so we return the pixel position by default
            return pixelPos;
        }

        if (this._interpolation === Interpolation.LINEAR && this.ticks.length > 1) {
            // Works because ticks are sorted by pixel position
            var minTick = this.ticks[0];
            var maxTick = this.ticks[this.ticks.length-1];
            var minValue = parseFloat(minTick.value);
            var maxValue = parseFloat(maxTick.value);
            
            return MathUtils.project(pixelPos, minTick.pixel, maxTick.pixel, minValue, maxValue);
        }

        if (this._interpolation === Interpolation.CATEGORICAL && this.ticks.length > 1) {
            // Categorical, we simply look for the closest tick
            let closestTick = this.ticks[0];

            for (let i = 1; i < this.ticks.length; ++i) {
                const tick = this.ticks[i];
                const dist = Math.abs(tick.pixel - pixelPos);
                if (dist < Math.abs(closestTick.pixel - pixelPos)) {
                    closestTick = tick;
                }
            }

            return closestTick.value;
        }

        return this.ticks.length > 0 ? this.ticks[0].value : "0";
    }

    /**
     * Convert a pixel position into the corresponding tick on the axis
     * @param {Number} pixelPos 
     * @returns {String} tick value
     */
     tickToPixel(tick : string) : any {
        if (this.ticks.length === 0) {
            // Not enough ticks to do the conversion, so we return the tick converted to float by default
            return parseFloat(tick);
        }

        if (this._interpolation === Interpolation.LINEAR && this.ticks.length > 1) {
            // Works because ticks are sorted by pixel position
            var minTick = this.ticks[0];
            var maxTick = this.ticks[this.ticks.length-1];
            var minValue = parseFloat(minTick.value);
            var maxValue = parseFloat(maxTick.value);
            var value = parseFloat(tick);
            
            return MathUtils.project(value, minValue, maxValue, minTick.pixel, maxTick.pixel);
        }

        if (this._interpolation === Interpolation.CATEGORICAL && this.ticks.length > 1) {
            // Categorical, we simply look for the specified tick and return its pixel position
            for (const t of this.ticks) {
                if (t.value === tick) {
                    return t.pixel;
                }
            }

            // If we cannot find the tick, we arbitrarily return the first tick. TODO: Propagate error message?
            return this.ticks[0].pixel;
        }

        // This should never be reached
        return 0;
    }


    getTicks(n=null) : AxisCoordinate1D[] {
        if (n === null) {
            // Just return the list of ticks converted to the right type
            const res = [];
            for (const tick of this.ticks) {
                res.push(new AxisCoordinate1D(tick.pixel, this));
            }
            return res;
        }

        if (this.ticks.length === 0 || n <= 0) {
            return [];
        }

        var resampledTicks : AxisCoordinate1D[] = [];
        var min = this.ticks[0].pixel;
        var max = this.ticks[this.ticks.length-1].pixel;
        var interval = n <= 1 ? 0 : (max-min)/(n-1);
        
        for (var i = 0; i < n; ++i) {
            resampledTicks.push(new AxisCoordinate1D(min+interval*i, this));
        }
        return resampledTicks;
    }

    isCategorical() : boolean {
        return this._interpolation === Interpolation.CATEGORICAL;
    }

    getInterpolationName() : string {
        let str = Interpolation[this._interpolation].toLowerCase().replace("_", " ");
        
        if (str.length > 0) {
            str = str[0].toUpperCase() + str.substr(1, str.length)
        }

        return str;
    }

    clear() : void {
        this.ticks = [];
        this.shapes = [];
        this._interpolation = Interpolation.LINEAR;
    }
}
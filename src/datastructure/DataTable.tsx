import Axis, { Direction, Interpolation } from "./chartelements/Axis";
import ChartElement, { ChartElementType } from "./chartelements/ChartElement";
import SubChartElement from "./chartelements/SubChartElement";

export default class DataTable {
    name : string;
    axisX : Axis;
    axisY : Axis;
    series : ChartElement[];

    constructor() {
        this.name = "Chart Title";
        this.axisX = new Axis("Horizontal (X) Axis", Interpolation.LINEAR, Direction.X);
        this.axisY = new Axis("Vertical (Y) Axis", Interpolation.LINEAR, Direction.Y);

        this.series = [];
    }

    clone() : DataTable {
        var copy = new DataTable();
        copy.axisX = this.axisX.clone();
        copy.axisY = this.axisY.clone();
        copy.name = this.name;

        var oldRefs : ChartElement[] = []; // Maintain a list of the old refs so that we can later fix broken links
        
        for (var i = 0; i < this.series.length; ++i) {
            const oldRef = this.series[i];
            const newRef = oldRef.clone(copy.axisX, copy.axisY);
            oldRefs.push(oldRef);
            copy.series.push(newRef);
        }

        // Fix broken references
        for (var i = 0; i < copy.series.length; ++i) {

            for (let j = 0; j < oldRefs[i].linkedElements.length; ++j) {
                const linkedElement = oldRefs[i].linkedElements[j];
                if (linkedElement !== null) {
                    const idx = oldRefs.indexOf(linkedElement);
                    copy.series[i].linkedElements[j] = copy.series[idx];
                }
            }

            if (copy.series[i] instanceof SubChartElement) {
                const mainSerie = (oldRefs[i] as SubChartElement)._serie;
                (copy.series[i] as SubChartElement)._serie = copy.series[oldRefs.indexOf(mainSerie)];
            }
        }

        return copy;
    }
}
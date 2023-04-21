import AxisCoordinate1D from "../../datastructure/AxisCoordinate1D";
import AxisCoordinate2D from "../../datastructure/AxisCoordinate2D";
import ChartElement, { ChartElementType } from "../../datastructure/chartelements/ChartElement";
import SubChartElement from "../../datastructure/chartelements/SubChartElement";
import DataTable from "../../datastructure/DataTable";
import ShapeCommand from "../../datastructure/ShapeCommand";
import ShapeUtils from "../ShapeUtils";

export default class BoxPlotExtractor {
    datatable : DataTable;
    serie : ChartElement;

    constructor(datatable : DataTable, serie : ChartElement) {
        this.datatable = datatable;
        this.serie = serie;
    }

    groupShapesByCenterX(shapes : ShapeCommand[]) {
        const groupedShapes = [];
        for (const shape of shapes) {
            const rect = shape.rect;
            const mx = rect.x + (rect.width/2);


            let groupIdx = -1;
            for (let i = 0; i < groupedShapes.length; ++i) {
                const grect = groupedShapes[i][0].rect;
                const groupx = grect.x + (grect.width/2);

                if (Math.abs(groupx - mx) < 1) {
                    groupIdx = i;
                    break;
                }
            }
            if (groupIdx === -1) {
                // No group found, we form a new group
                groupedShapes.push([shape]);
            } else {
                groupedShapes[groupIdx].push(shape)
            }
        }

        return groupedShapes;
    }

    /**
     * Helper function to set a datapoint if it already exists, or create a new one otherwise
     * @param serie 
     * @param datapoint 
     */
    setDatapoint(serie : ChartElement, datapoint : AxisCoordinate2D) : void {
        const xpos = datapoint.x.pixel;
        let found = false;
        for (const existingDatapoint of serie.data) {
            if (Math.abs(existingDatapoint.x.pixel - xpos) < 0.1) {
                existingDatapoint.x = datapoint.x;
                existingDatapoint.y = datapoint.y;
                found = true;
                break;
            }
        }

        if (!found) { // Not found so we add a new value
            serie.data.push(datapoint);
        }
    }

    onShapesSelected(shapes : ShapeCommand[], allShapes : ShapeCommand[] = []) : void {
        // Boxplots usually represent 5 values: the median (an horizontal line), Q1 and Q3 (a box) and minimum and maximum (whiskers)

        // Because we might have to extract multiple boxplots, we first sort all shapes by their horizontal center and form groups
        // We should also consider already included shapes as we need to consider all shapes to properly compute the boxplot
        // We also split all shapes as they might have been grouped as one single shape
        // TODO: Prevent manually edited value from being overriden
        const groupedBoxplots = this.groupShapesByCenterX(ShapeUtils.splitShapesIntoSubShapes(shapes.concat(this.serie.shapes)));

        if (this.serie.linkedElements.length <= 2) {
            this.serie.linkedElements.push(new SubChartElement(ChartElementType.BOX_PLOT_Q3, this.serie, "↳ Q3"));
            this.serie.linkedElements.push(new SubChartElement(ChartElementType.BOX_PLOT_Q1, this.serie, "↳ Q1"));
            this.serie.linkedElements.push(new SubChartElement(ChartElementType.BOX_PLOT_MIN, this.serie, "↳ Min"));
            this.serie.linkedElements.push(new SubChartElement(ChartElementType.BOX_PLOT_MAX, this.serie, "↳ Max"));

            // Add them to the datatable too
            for (let i = 2; i < this.serie.linkedElements.length; ++i) {
                const idx = this.datatable.series.indexOf(this.serie);
                this.datatable.series.splice(idx+1, 0, this.serie.linkedElements[i]);
            }
        }

        const elementQ3 = this.serie.linkedElements[2];
        const elementQ1 = this.serie.linkedElements[3];
        const elementMin = this.serie.linkedElements[4];
        const elementMax = this.serie.linkedElements[5];

        for (const boxplotShapes of groupedBoxplots) {
            const medians = [];
            let min = boxplotShapes[0].rect.y;
            let max = boxplotShapes[0].rect.y+boxplotShapes[0].rect.height;
            let q1 = min;
            let q3 = max;
            const mx = boxplotShapes[0].rect.x + boxplotShapes[0].rect.width/2;
            for (const boxplotShape of boxplotShapes) {
                if (ShapeUtils.isLine(boxplotShape) && boxplotShape.rect.width > boxplotShape.rect.height) { // Horizontal line, might be the median
                    medians.push(boxplotShape.rect.y + boxplotShape.rect.height/2);
                }

                if (ShapeUtils.isRectangle(boxplotShape)) { // Rectangle, most likely correspond to quartiles
                    q1 = boxplotShape.rect.y;
                    q3 = boxplotShape.rect.y+boxplotShape.rect.height;
                }

                min = Math.min(min, boxplotShape.rect.y);
                max = Math.max(max, boxplotShape.rect.y+boxplotShape.rect.height);
            }

            let median = (q3+q1)/2; // If we can find a median, we take the middle pos
            // Median should be between q1 and q3
            for (const candidateMedian of medians) {
                if (candidateMedian > q1 && candidateMedian < q3) {
                    median = candidateMedian;
                    break;
                }
            }

            this.setDatapoint(this.serie, new AxisCoordinate2D(new AxisCoordinate1D(mx, this.datatable.axisX), new AxisCoordinate1D(median, this.datatable.axisY)));
            this.setDatapoint(elementQ3, new AxisCoordinate2D(new AxisCoordinate1D(mx, this.datatable.axisX), new AxisCoordinate1D(q3, this.datatable.axisY)));
            this.setDatapoint(elementQ1, new AxisCoordinate2D(new AxisCoordinate1D(mx, this.datatable.axisX), new AxisCoordinate1D(q1, this.datatable.axisY)));
            this.setDatapoint(elementMin, new AxisCoordinate2D(new AxisCoordinate1D(mx, this.datatable.axisX), new AxisCoordinate1D(min, this.datatable.axisY)));
            this.setDatapoint(elementMax, new AxisCoordinate2D(new AxisCoordinate1D(mx, this.datatable.axisX), new AxisCoordinate1D(max, this.datatable.axisY)));
        }


        // Link the element with the shapes
        this.serie.shapes = this.serie.shapes.concat(shapes);
    }
}

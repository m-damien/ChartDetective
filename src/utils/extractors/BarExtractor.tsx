import AxisCoordinate1D from "../../datastructure/AxisCoordinate1D";
import AxisCoordinate2D from "../../datastructure/AxisCoordinate2D";
import ChartElement from "../../datastructure/chartelements/ChartElement";
import DataTable from "../../datastructure/DataTable";
import ShapeCommand from "../../datastructure/ShapeCommand";
import ShapeUtils from "../ShapeUtils";
import LegendExtractor from "./LegendExtractor";

export default class BarExtractor {
    datatable : DataTable;
    element : ChartElement;

    constructor(datatable : DataTable, element : ChartElement) {
        this.datatable = datatable;
        this.element = element;
    }

    onShapesSelected(shapes : ShapeCommand[], allShapes : ShapeCommand[] = []) : void {
        const shapesToLink = shapes;
        if (shapes.length === 1) {
            // It happens quite often that bars are drawn using a single shape (but multiple calls to moveto)
            // When we receive only one shape, we look if it is possible to divide it into subshapes
            shapes = ShapeUtils.splitIntoSubShapes(shapes[0]);
        }

        // We simply extract all the upper-most point of all shapes
        for (const shape of shapes) {
            const mx = shape.rect.x + shape.rect.width/2;
            this.element.data.push(new AxisCoordinate2D(new AxisCoordinate1D(mx, this.datatable.axisX), new AxisCoordinate1D(shape.rect.y, this.datatable.axisY)));
        }

        // Link the element with the shapes
        this.element.shapes = this.element.shapes.concat(shapesToLink);

        // Automatically extract the name of the serie by looking for a legend
        if (allShapes.length > 0) {
            const legendExtractor = new LegendExtractor(this.element);
            legendExtractor.onShapesSelected(allShapes);
        }
    }
}

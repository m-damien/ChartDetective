import AxisCoordinate1D from "../../datastructure/AxisCoordinate1D";
import AxisCoordinate2D from "../../datastructure/AxisCoordinate2D";
import ChartElement from "../../datastructure/chartelements/ChartElement";
import DataTable from "../../datastructure/DataTable";
import ShapeCommand from "../../datastructure/ShapeCommand";
import LegendExtractor from "./LegendExtractor";

export default class ScatterExtractor {
    datatable : DataTable;
    element : ChartElement;

    constructor(datatable : DataTable, element : ChartElement) {
        this.datatable = datatable;
        this.element = element;
    }

    onShapesSelected(shapes : ShapeCommand[], allShapes : ShapeCommand[] = []) : void {
        // We simply extract the center of all the shapes
        for (const shape of shapes) {
            const mx = shape.rect.x + shape.rect.width/2;
            const my = shape.rect.y + shape.rect.height/2;
            this.element.data.push(new AxisCoordinate2D(new AxisCoordinate1D(mx, this.datatable.axisX), new AxisCoordinate1D(my, this.datatable.axisY)));
        }
        
        // Link the element with the shapes
        this.element.shapes = this.element.shapes.concat(shapes);

        // Automatically extract the name of the serie by looking for a legend
        if (allShapes.length > 0) {
            const legendExtractor = new LegendExtractor(this.element);
            legendExtractor.onShapesSelected(allShapes);
        }
    }
}

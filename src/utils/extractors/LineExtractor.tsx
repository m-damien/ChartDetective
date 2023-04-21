import ChartElement from "../../datastructure/chartelements/ChartElement";
import DataTable from "../../datastructure/DataTable";
import ShapeCommand from "../../datastructure/ShapeCommand";
import ShapeUtils from "../ShapeUtils";
import LegendExtractor from "./LegendExtractor";

export default class LineExtractor {
    datatable : DataTable;
    element : ChartElement;

    constructor(datatable : DataTable, element : ChartElement) {
        this.datatable = datatable;
        this.element = element;
    }

    onShapesSelected(shapes : ShapeCommand[], allShapes : ShapeCommand[] = []) : void {
        // We simply extract all the points forming the shapes
        var points = ShapeUtils.shapesToPoints(shapes, this.datatable.axisX, this.datatable.axisY);
        
        // Link the element with the shapes
        this.element.shapes = this.element.shapes.concat(shapes);

        // Add the data
        this.element.data = this.element.data.concat(points);

        // Automatically extract the name of the serie by looking for a legend
        if (allShapes.length > 0) {
            const legendExtractor = new LegendExtractor(this.element);
            legendExtractor.onShapesSelected(allShapes);
        }
    }
}

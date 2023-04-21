import AxisCoordinate1D from "../../datastructure/AxisCoordinate1D";
import AxisCoordinate2D from "../../datastructure/AxisCoordinate2D";
import ErrorBar from "../../datastructure/chartelements/ErrorBar";
import DataTable from "../../datastructure/DataTable";
import ShapeCommand from "../../datastructure/ShapeCommand";
import ShapeUtils from "../ShapeUtils";

export default class ErrorBarExtractor {
    datatable : DataTable;
    errorBar : ErrorBar;

    constructor(datatable : DataTable, errorBar : ErrorBar) {
        this.datatable = datatable;
        this.errorBar = errorBar;
    }

    onShapesSelected(shapes : ShapeCommand[], allShapes : ShapeCommand[] = []) : void {
        // Error bars are usually represented using 3 disctinct shapes (1 for the vertical line, and 2 lines for the whiskers)
        // Less commonly using 4 or more shapes (e.g., by separating the top and bottom part, or left and right whiskers)
        // Finally (rare) using only one shape (moveto)

        // As such, we only consider shapes with a barycenter close to one of the series' points
        const serie = this.errorBar._serie;

        for (const shape of shapes) {
            const rect = shape.rect;
            const mx = rect.x + (rect.width/2);
            //const my = rect.y + (rect.height/2);
            
            let minDist = Number.MAX_VALUE;
            let idx = -1;
            for (let i = 0; i < serie.data.length; ++i) {
                const pt = serie.data[i];
                const dist = Math.abs(mx - pt.x.pixel);//MathUtils.dist(mx, my, pt.x.pixel, pt.y.pixel);
                if (dist < minDist) {
                    idx = i;
                    minDist = dist;
                }
            }

            if (minDist < 1) { // Arbitrary, but we can reasonably expect the error bar to be close to the serie
                const associatedPt = serie.data[idx];

                // Find the bound, make sure that it is better than what was already there
                let bound = Math.min(rect.y, this.errorBar.data[idx].y.pixel); // Upper bound
                if (this.errorBar.isLowerBound()) {
                    bound = Math.max(rect.y + rect.height, this.errorBar.data[idx].y.pixel); // Lower bound
                }

                this.errorBar.data[idx] = new AxisCoordinate2D(new AxisCoordinate1D(associatedPt.x.pixel, associatedPt.x.axis), new AxisCoordinate1D(bound, associatedPt.y.axis));
            }
        }
        

        // We simply extract all the points forming the shapes
        var points = ShapeUtils.shapesToPoints(shapes, this.datatable.axisX, this.datatable.axisY);
        
        // Link the element with the shapes
        this.errorBar.shapes = this.errorBar.shapes.concat(shapes);
    }
}

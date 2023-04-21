import Axis from "../../datastructure/chartelements/Axis";
import ChartElement, { ChartElementType } from "../../datastructure/chartelements/ChartElement";
import ErrorBar from "../../datastructure/chartelements/ErrorBar";
import DataTable from "../../datastructure/DataTable";
import AxisExtractor from "./AxisExtractor";
import BarExtractor from "./BarExtractor";
import BoxPlotExtractor from "./BoxPlotExtractor";
import ErrorBarExtractor from "./ErrorBarExtractor";
import LineExtractor from "./LineExtractor";
import ScatterExtractor from "./ScatterExtractor";

export class ExtractorUtils {
    static getSerieExtractor(serie : ChartElement, dataTable : DataTable) : any {
        // We need to use a different extractor for the next selections depending on the element
        var extractor = null;
        if (serie.is(ChartElementType.AXIS)) {
            extractor = new AxisExtractor(serie as Axis);
        } else if (serie.is(ChartElementType.LINE)) {
            extractor = new LineExtractor(dataTable, serie);
        } else if (serie.is(ChartElementType.BAR)) {
            extractor = new BarExtractor(dataTable, serie);
        } else if (serie.is(ChartElementType.SCATTER)) {
            extractor = new ScatterExtractor(dataTable, serie);
        } else if (serie.is(ChartElementType.BOX_PLOT)) {
            extractor = new BoxPlotExtractor(dataTable, serie);
        } else if (serie.is(ChartElementType.ERRORBAR)) {
            extractor = new ErrorBarExtractor(dataTable, serie as ErrorBar);
        } else {
            //TODO: Handle other types
            alert("Unsupported element");
        }

        return extractor;
    }

    static chartTypeToString(type : ChartElementType) : string {
        // Hacky code to convert a chart type into a nice string
        let str = ChartElementType[type].toLowerCase().replace("_", " ");
        
        if (str.length > 0) {
            str = str[0].toUpperCase() + str.substr(1, str.length)
        }

        return str;
    }
}
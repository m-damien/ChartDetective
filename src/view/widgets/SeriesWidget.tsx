import React, { ChangeEvent } from 'react';
import TableWidget from './TableWidget';
import DropZone, { AcceptFilter } from '../DropZone';
import TextMerger from '../../utils/TextMerger';
import ChartElement, { ChartElementType } from '../../datastructure/chartelements/ChartElement';
import Axis from '../../datastructure/chartelements/Axis';
import ShapeUtils from '../../utils/ShapeUtils';
import ShapeCommand from '../../datastructure/ShapeCommand';
import DataTable from '../../datastructure/DataTable';
import AxisCoordinate1D from '../../datastructure/AxisCoordinate1D';
import AxisCoordinate2D from '../../datastructure/AxisCoordinate2D';
import ErrorBar, { Bound } from '../../datastructure/chartelements/ErrorBar';
import ElementDropZone from '../ElementDropZone';
import { ExtractorUtils } from '../../utils/extractors/ExtractorUtils';
import UndoManager from '../../utils/UndoManager';
import SubChartElement from '../../datastructure/chartelements/SubChartElement';

class Tick {
    coord : AxisCoordinate1D;
    duplicateId : number;

    constructor(coord : AxisCoordinate1D, duplicateId = 0) {
        this.coord = coord;
        this.duplicateId = duplicateId;
    }
}

/**
 * A widget to show a table representing all the series
 * Shapes can be dropped in the table to fill it.
 */
export default class SeriesWidget extends TableWidget {
    decimalPrecision: number;
    nTicks: number;
    cachedTicks: Tick[];
    cachedHeaders: string[];
    cachedData: string;
    cachedRawData: string[][];
    lastRowCount : number;
    constructor(props) {
        super(props);

        this.cellSelectedListener = this.onCellSelectedCallback.bind(this);
        this.cellEditedListener = this.onCellEditedCallback.bind(this);
        this.nTicks = null;
        this.minWidth = 350;
        this.maxHeight = 600;
        this.decimalPrecision = 2;
        this.colWidths = [100]; // Make first column representing the name of the series a little larger
        this.cachedTicks = null;
        this.cachedData = "";
        this.cachedRawData = null;
        this.cachedHeaders = null;
    }

    /**
     * Returns the minimal number of decimals needed to make all numbers in the list unique
     * @param{[Number]} numbers 
     * @returns 
     */
    getMinDecimals(numbers: number[]): number {
        // only works if the array contains numbers
        if (numbers.length <= 0 || typeof numbers[0] != 'number') {
            return 0;
        }

        var decimals = 0;
        var truncatedNumbers = new Set();
        while (truncatedNumbers.size !== numbers.length && decimals < 20) {
            const constDec = decimals;
            truncatedNumbers = new Set(numbers.map(x => parseFloat(x.toFixed(constDec))));
            decimals++;
        }

        return decimals-1;
    }

    /**
     * A sorting method that work for both strings (alphabetically) and numbers
     * @param {Array} values 
     */
    sortValues(values: number[]): number[] {
        return values.sort(function (a, b) {
            if (a === b) return 0;
            return a < b ? -1 : 1;
        });
    }

    /**
     * Finds all the necessary ticks to represent all the series
     */
    getTicksX(): Tick[] {
        // Optimization: This operation can be slow, so we avoid re-computing if not necessary
        if (this.cachedTicks !== null) {
            return this.cachedTicks;
        }

        var data: DataTable = this.props.state.dataTable;
        var ticks = [];//data.axisX.getTicks(this.nTicks);

        if (ticks.length === 0 && data.series.length > 0) {
            // Fallback solution if there is no ticks defined but there is series
            // We go through all the series to find the ticks that are used
            var uniqueTicks: Set<number> = new Set();
            var duplicatedTicks = {};

            for (var i = 0; i < data.series.length; ++i) {
                var uniqueTicksSeries: Set<number> = new Set();
                var duplicatedTicksSeries = {};
                var serie = data.series[i];
                for (var j = 0; j < serie.data.length; ++j) {
                    var pixel = serie.data[j].x.pixel;
                    if (uniqueTicksSeries.has(pixel)) { //TODO: Also check if the point has a different y value
                        // The series contain multiple points at the same exact pixel pos (possible with scatter plots for example). We need to create two ticks artificially
                        if (!duplicatedTicksSeries.hasOwnProperty(pixel)) {
                            duplicatedTicksSeries[pixel] = 0;
                        }
                        duplicatedTicksSeries[pixel] += 1;
                    }
                    uniqueTicksSeries.add(pixel);
                    uniqueTicks.add(pixel);
                }
                // Merge duplicated ticks, to make sure we don't duplicate too much
                for (const duplicatePix in duplicatedTicksSeries) {
                    if (duplicatedTicks.hasOwnProperty(duplicatePix)) {
                        duplicatedTicks[duplicatePix] = Math.max(duplicatedTicks[duplicatePix], duplicatedTicksSeries[duplicatePix]);
                    } else {
                        duplicatedTicks[duplicatePix] = duplicatedTicksSeries[duplicatePix];
                    }
                }
            }
            var tickPixels = Array.from(uniqueTicks);
            ticks = tickPixels.map(pos => new Tick(new AxisCoordinate1D(pos, data.axisX)));
            // Add duplicated ticks
            for (const duplicatePix in duplicatedTicks) {
                const nb = duplicatedTicks[duplicatePix];
                for (let i = 0; i < nb; ++i) {
                    ticks.push(new Tick(new AxisCoordinate1D(parseFloat(duplicatePix), data.axisX), i+1))
                }
            }

            // Sort ticks by their pixel positions
            ticks = ticks.sort(function (a, b) {
                return a.coord.pixel - b.coord.pixel;
            });
        }

        this.cachedTicks = ticks;

        return ticks;
    }

    getCellValue(col: number, row: number): AxisCoordinate2D {
        if (col === 0 || row >= this.props.dataTable.series.length) {
            // Selected the name of the row
            return null;
        }

        var ticks = this.getTicksX();
        var serie: ChartElement = this.props.dataTable.series[row];

        return serie.getAtPixelX(ticks[col - 1].coord.pixel, ticks[col - 1].duplicateId);
    }

    getData(decimalPrecision=2): string[][] {
        if (this.cachedRawData !== null) {
            return this.cachedRawData;
        }
        var data = [];
        var ticks = this.getTicksX();

        if (ticks.length > 0) {
            var headers = ["Name"];
            if ((this.props.state.dataTable.axisX as Axis).isCategorical()) {
                headers = headers.concat(ticks.map(x => x.coord.value));
            } else {
                // For the header, we don't want full precision
                var tickValues = ticks.filter(x => x.duplicateId == 0).map(x => parseFloat(x.coord.value));
                var minDecimals = this.getMinDecimals(tickValues)
                var roundedTicks = ticks.map(x => parseFloat(x.coord.value).toFixed(minDecimals));
                headers = headers.concat(roundedTicks);
            }
            data.push(headers);
        }
        
        for (var i = 0; i < this.props.dataTable.series.length; ++i) {
            var serie: ChartElement = this.props.dataTable.series[i];
            var serieData = [serie.name];

            for (var tickId = 0; tickId < ticks.length; ++tickId) {
                var pt = serie.getAtPixelX(ticks[tickId].coord.pixel, ticks[tickId].duplicateId);
                var value = "";
                if (pt !== null) {
                    value = pt.y.value;
                    if (!pt.y.axis.isCategorical()) {
                        if (serie.is(ChartElementType.ERRORBAR)) {
                            // Exception for error bar, we show the difference
                            var mainSerie = (serie as ErrorBar).getMainSerie()
                            var mainSerieVal = parseFloat(mainSerie.getAtPixelX(ticks[tickId].coord.pixel, ticks[tickId].duplicateId).y.value)
                            value = (Math.abs(parseFloat(value) - mainSerieVal)).toString();
                        }
                        // The value is a number and can be rounded
                        if (decimalPrecision !== null) {
                            value = parseFloat(value).toFixed(decimalPrecision);
                        }
                    }
                }
                serieData.push(value);
            }

            data.push(serieData);
        }

        return data;
    }


    getFloatingHeader(): string {
        return this.props.dataTable.name;
    }

    getRowBackgroundColor(rowId: number): string {
        // We use the color of the serie as the background for each row
        var series = this.props.dataTable.series;

        if (rowId - 1 < series.length) {
            var color = series[rowId - 1].getMainColor();
            color = color === null ? "#ffffff" : color;
            var rgb = ShapeUtils.colorHexToRgb(color);

            return 'rgba(' + rgb.join(',') + ',' + 0.2 + ')';
        }

        return null;
    }

    updateDatatable(): void {
        this.cachedTable = null;
        this.props.setState({ dataTable: this.props.state.dataTable });
    }

    getGridOverlay(): JSX.Element {
        // We modify the table to also add dropzones
        // There should be two dropzones per row/serie: one for the title (first column) and one for the serie (to add new values)

        var dropzones = [];
        let dropzoneSkipper = 0;
        var series = this.props.dataTable.series as ChartElement[];
        for (var i = 0; i < series.length; ++i) {
            const serie = series[i];
            const rowId = i + 1;
            // Add the dropzone to change the name of the serie
            var nameRect = this.getCellRect(0, rowId);

            dropzones.push(
                <DropZone
                    isSelectionAccepted={AcceptFilter.TextOnly}
                    recommendedDropCount={1}
                    key={rowId * 3 + 1}
                    state={this.props.state}
                    setState={this.props.setState}
                    style={{ width: nameRect.width, height: nameRect.height, position: 'absolute', top: nameRect.y, left: nameRect.x }}
                    text=""
                    onShapesDropped={shapes => { return this.onShapesDroppedOnSerieName(shapes, serie) }}
                />
            );

            if (dropzoneSkipper > 0) {
                dropzoneSkipper--;
                continue;
            }

            // Add the dropzone to add values to a serie
            let dropzoneHeight = nameRect.height;
            let onShapesDroppedCallback = shapes => { return this.onShapesDroppedOnSerie(shapes, serie) };

            // Special case: For error bars, we merge the dropzone for the upper and lower bounds
            if (serie.is(ChartElementType.ERRORBAR)) {
                const errorBar = (serie as ErrorBar);
                if (i + 1 < series.length && series[i + 1].is(ChartElementType.ERRORBAR)) {
                    
                    const errorBar2 = series[i + 1] as ErrorBar;
                    if (errorBar2._serie === errorBar._serie) {
                        dropzoneHeight = nameRect.height * 2;
                        onShapesDroppedCallback = shapes => { return this.onShapesDroppedOnSerie(shapes, errorBar) && this.onShapesDroppedOnSerie(shapes, errorBar2) };
                        dropzoneSkipper = 1;
                    }
                }
            }

            // Special case: Series with sub-elements should share the same dropzone
            if (serie.linkedElements.length > 2) {
                // The subelements should follow, we make sure they follow and calculate the dropzone/s new size
                let subElementsCount = 0;
                while (subElementsCount + 1 < series.length && series[i + subElementsCount + 1] instanceof SubChartElement && (series[i + subElementsCount + 1] as SubChartElement).getMainSerie() === serie) {
                    subElementsCount++;
                }
                dropzoneHeight = nameRect.height * (subElementsCount + 1);
                dropzoneSkipper = subElementsCount;
            }

            var lastCell = this.getCellRect(this.getColCount() - 1, rowId);
            var startX = nameRect.x + nameRect.width;
            var endX = lastCell.x + lastCell.width;

            dropzones.push(
                <DropZone
                    isSelectionAccepted={AcceptFilter.ShapeOnly}
                    recommendedDropCount={0}
                    key={rowId * 3 + 2}
                    state={this.props.state}
                    setState={this.props.setState}
                    style={{ width: endX - startX - 2, height: dropzoneHeight, position: 'absolute', top: nameRect.y, left: startX + 1 }}
                    text=""
                    onShapesDropped={onShapesDroppedCallback}
                />
            );
        }

        return (<div>
            {super.getGridOverlay()}
            {dropzones}
        </div>);
    }

    getFloatingHeaderHTML(): JSX.Element {
        return (<div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div style={{ left: '0%', width: '90%', top: '50%', transform: 'translate(0%, -50%)', position: 'absolute' }}>
                {this.getFloatingHeader()}
            </div>
            <div style={{ right: 1, top: '50%', transform: 'translate(0%, -50%)', position: 'absolute' }}>
                <button className="button small gray tooltip" onClick={this.downloadCSV.bind(this)}><i className="fa fa-download" aria-hidden="true"></i> CSV</button>
            </div>
            <DropZone
                recommendedDropCount={1}
                isSelectionAccepted={AcceptFilter.TextOnly}
                state={this.props.state}
                setState={this.props.setState}
                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
                text=""
                onShapesDropped={this.onShapesDroppedOnTitle.bind(this)}
            />
        </div>);
    }

    onNbTicksChanged(event: ChangeEvent): void {
        var value = (event.target as HTMLInputElement).value;
        if (value === null || value === "0") {
            this.nTicks = null;
        } else {
            this.nTicks = parseInt(value);
        }

        this.forceUpdate();
    }

    isCellSelectable(col: number, row: number): boolean {
        return row > 0; // Cells on the first column cannot be edited because they are labels
    }

    isCellEditable(col: number, row: number): boolean {
        return row > 0; // TODO: Support for editing ticks, for now we just block it
    }

    onCellSelectedCallback(col: number, row: number): void {
        // Update the overlay
        this.props.state.overlay.clear();
        if (col > 0 && col !== -1 && row !== -1) {
            var coord = this.getCellValue(col, row - 1);
            if (coord !== null) {
                this.props.state.overlay.points.push(coord);
            }
        }
    }

    onCellEditedCallback(col: number, row: number, newVal: string): void {
        if (col === 0) {
            // Edited the name of the series
            const serie = this.props.dataTable.series[row - 1];
            UndoManager.get().addUndoRestorePoint();
            serie.name = newVal;
        } else {
            // Edited a position
            var coord = this.getCellValue(col, row - 1);
            if (coord !== null) {
                UndoManager.get().addUndoRestorePoint();
                coord.y.value = newVal;
            }
        }
        this.forceUpdate();
    }

    onRowDeleted(row: number): void {
        UndoManager.get().addUndoRestorePoint();
        const serie: ChartElement = this.props.dataTable.series.splice(row, 1)[0];

        // Also remove associated sub elements
        for (const subElement of serie.linkedElements) {
            if (subElement !== null) {
                const idx = this.props.dataTable.series.indexOf(subElement);
                if (idx > -1) {
                    this.props.dataTable.series.splice(idx, 1);
                }
            }
        }

        // If it's a subelement, update the associated serie
        if (serie instanceof SubChartElement) {
            const mainSerie = (serie as SubChartElement).getMainSerie();
            const idx = mainSerie.linkedElements.indexOf(serie);
            if (idx >= 2) { // First 2 are errorbars and cannot be removed
                //mainSerie.linkedElements.splice(idx, 1);
                mainSerie.linkedElements[idx] = null;
            }

            if (idx === 0) mainSerie.upperErrorBar = null;
            if (idx === 1) mainSerie.lowerErrorBar = null;

        }
        this.updateDatatable();
    }

    onAddErrorBars(row: number): void {
        UndoManager.get().addUndoRestorePoint();
        const serie: ChartElement = this.props.dataTable.series[row];
        if (serie.lowerErrorBar === null) {
            var lowerBound = new ErrorBar(serie, Bound.LOWER);
            this.props.dataTable.series.splice(row + 1, 0, lowerBound);
            serie.lowerErrorBar = lowerBound;
        }

        if (serie.upperErrorBar === null) {
            var upperBound = new ErrorBar(serie, Bound.UPPER);
            this.props.dataTable.series.splice(row + 1, 0, upperBound);
            serie.upperErrorBar = upperBound;
        }

        this.updateDatatable();

    }

    onShapesDroppedOnSerie(shapes: ShapeCommand[], serie: ChartElement): boolean {
        // Add data on an existing serie
        var extractor = ExtractorUtils.getSerieExtractor(serie, this.props.dataTable);
        if (extractor !== null) {
            UndoManager.get().addUndoRestorePoint();
            extractor.onShapesSelected(shapes);
            this.updateDatatable();
        }

        return true;
    }

    onShapesDroppedOnErrorBar(shapes: ShapeCommand[], serie: ChartElement, row: number): boolean {
        // Simulates two actions: 1) Adding the error bars; 2) dropping the shapes
        this.onAddErrorBars(row);
        return this.onShapesDroppedOnSerie(shapes, serie.upperErrorBar) && this.onShapesDroppedOnSerie(shapes, serie.lowerErrorBar);
    }

    onShapesDroppedOnSerieName(shapes: ShapeCommand[], serie: ChartElement): boolean {
        TextMerger.getTextFromShapes(shapes).then(extractedText => {
            if (extractedText !== null) {
                UndoManager.get().addUndoRestorePoint();
                serie.name = extractedText;
                this.updateDatatable();
                return true;
            }
    
            return false;
        });

        return true;
    }

    onShapesDroppedOnTitle(shapes: ShapeCommand[]): boolean {
        TextMerger.getTextFromShapes(shapes).then(extractedText => {
            if (extractedText === null) {
                alert("No text found in selection");
            }
            UndoManager.get().addUndoRestorePoint();
            this.props.dataTable.name = extractedText;
            this.updateDatatable();
        });
        return true;
    }

    isErrorBarButtonShown(row: number): boolean {
        if (row < 0) {
            return true;
        }
        const serie: ChartElement = this.props.dataTable.series[row];
        return serie.hasErrorBars() || !serie.canHaveErrorBars();
    }

    getCellStyle(col: number, row: number) {
        return { backgroundColor: row === 0 ? "#f0f0f0" : this.getRowBackgroundColor(row), textAlign: row === 0 ? "center" : "left" }
    }

    getColumnStickyCount() {
        return 2;
    }

    getColumnStickyWidth() {
        return 40;
    }

    getStickyButton(columnIndex, rowIndex) {
        if (columnIndex === 1 && !this.isErrorBarButtonShown(rowIndex - 1)) {
            return <div style={{ position: 'relative' }}>
                <div
                    onMouseUp={e => { this.onAddErrorBars(rowIndex - 1) }}
                    className="deleteSeriesButton"
                    style={{ paddingLeft: 3, paddingTop: 1 }}
                >
                    ⌶
                </div>
                <DropZone
                    isSelectionAccepted={AcceptFilter.ShapeOnly}
                    recommendedDropCount={1}
                    state={this.props.state}
                    setState={this.props.setState}
                    style={{ width: "100%", height: "100%", position: 'absolute', top: 0, left: 0 }}
                    text=""
                    onShapesDropped={shapes => { return this.onShapesDroppedOnErrorBar(shapes, this.props.state.dataTable.series[rowIndex - 1], rowIndex - 1) }}
                />
            </div>

        } else if (columnIndex === 0 && rowIndex > 0) {
            return <div
                onMouseUp={e => { this.onRowDeleted(rowIndex - 1) }}
                className="deleteSeriesButton"
                style={{ padding: 4 }}>
                <i className="fa fa-trash" aria-hidden="true"></i>
            </div>


        }
        return <div></div>;
    }

    getColumnStickyHTML() {
        const Sticky = (({ columnIndex, rowIndex, style }) => (
            <div className={"tableCell " +
                (columnIndex % 2 === 0 ? "evenCol " : "oddCol ") +
                (rowIndex % 2 === 0 ? "evenRow " : "oddRow ") +
                (rowIndex === 0 ? "firstRow " : "") +
                (columnIndex === 0 ? "firstCol " : "") +
                (rowIndex === this.getRowCount() - 1 ? "lastRow " : "") +
                (columnIndex === this.getColCount() - 1 ? "lastCol " : "")
            }
                style={{ ...style, backgroundColor: "#f0f0f0", padding: 0, width: this.getColumnStickyWidth() / this.getColumnStickyCount() }}>
                {this.getStickyButton(columnIndex, rowIndex)}
            </div>
        ));
        return Sticky;
    }

    download(filename, text) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }

    downloadCSV() {
        //TODO: Move to its own class (Exporters)
        let csvContent = "";
        this.cachedRawData = null;
        // Export at high precision
        csvContent += this.getData(null).map((v) => { return v.join(",") }).join("\n");
        this.download(this.props.dataTable.name + ".csv", csvContent);
    }

    updateDataTableSize(): void {
        // We need to update the maxHeight to take into account the drag and drop area
        // Ideally, the area should always be visible
        const dragAndDropArea = document.getElementById("dragAndDropArea");
        const seriesWidget = document.getElementById("seriesWidget");

        if (dragAndDropArea !== null && seriesWidget !== null) {
            const floatingHeader = document.getElementById("seriesWidget").querySelector(".tableFloatingHeader")
            this.maxHeight = (seriesWidget.clientHeight - dragAndDropArea.clientHeight) - (floatingHeader !== null ? floatingHeader.clientHeight + 2 : 0); // Available height, after considering the dropzone area (which should always be visible)
        }

        super.updateDataTableSize();
    }

    onNewRowAdded(rowId : number) {
        this.scrollToRow(rowId); // We make sure the new row is visible
    }

    componentDidUpdate(): void {
        const rowCount = this.getRowCount();
        if (this.lastRowCount !== rowCount) {
            if (this.lastRowCount < rowCount) {
                this.onNewRowAdded(rowCount)
            }
            this.lastRowCount = rowCount;
        }

        super.componentDidUpdate();
    }


    render(): JSX.Element {
        this.cachedRawData = null;
        this.cachedTicks = null;
        this.cachedRawData = this.getData();

        return (<div id="seriesWidget" style={{ height: '100%', overflowY: "auto" }}>
            {super.render()}
            <div id="dragAndDropArea" style={{ display: "flex", flexDirection: "column" }}>
                <div className="panelSeparator"> <i style={{ marginLeft: 5 }} className="fa fa-hand-pointer-o" aria-hidden="true"></i> Drag&Drop Chart Elements</div>
                <div id="seriesDropzones" style={{ display: "flex", flexDirection: "row"}}>
                    <ElementDropZone color="#C7E2ED" imgFile="icons/line.svg" state={this.props.state} shapes={this.props.shapes} setState={this.props.setState} type={ChartElementType.LINE} />
                    <ElementDropZone color="rgb(229, 239, 212)" imgFile="icons/vertical_bar.svg" shapes={this.props.shapes} state={this.props.state} setState={this.props.setState} type={ChartElementType.BAR} />
                    <ElementDropZone color="#E4CCF0" imgFile="icons/vertical_boxplot.svg" shapes={this.props.shapes} state={this.props.state} setState={this.props.setState} type={ChartElementType.BOX_PLOT} />
                    <ElementDropZone color="#F6E6C3" imgFile="icons/scatter.svg" shapes={this.props.shapes} state={this.props.state} setState={this.props.setState} type={ChartElementType.SCATTER} />
                </div>
            </div>
        </div>)
    }

}
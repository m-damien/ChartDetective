import React from 'react';
import ChartView from './ChartView';
import FilterPanel from './filters/FilterPanel';
import DataTable from '../datastructure/DataTable';
import ShapeSelection from '../datastructure/ShapeSelection';
import AxisExtractor from '../utils/extractors/AxisExtractor';
import UndoManager from '../utils/UndoManager';
import DraggableShapeSelection from './DraggableShapeSelection';
import AxisWidget from './widgets/AxisWidget';
import SeriesWidget from './widgets/SeriesWidget';
import ShapeCommand from '../datastructure/ShapeCommand';
import Overlay from '../datastructure/Overlay';
import GridLayout from 'react-grid-layout';
import ReconstructedChart from './ReconstructedChart';
import ColorFilter from './filters/ColorFilter';
import ShapeFilter from './filters/ShapeFilter';


export interface ChartExtractorState {
    filteredShapes : ShapeCommand[],
    extractor : any,
    dataTable : DataTable,
    shapeSelection : ShapeSelection,
    overlay : Overlay
}

interface ChartExtractorProps {
    chart : any
}

export default class ChartExtractor extends React.Component<ChartExtractorProps, ChartExtractorState> {
    filters : FilterPanel[];
    chartView : ChartView;
    seriesWidget : SeriesWidget;
    xAxisWidget : AxisWidget;
    yAxisWidget : AxisWidget;
    statusBarText : string;
    draggableShapeSelection : DraggableShapeSelection;
    globalMouseMoveListener : (this: Document, ev: MouseEvent) => any;


    constructor(props : ChartExtractorProps) {
        super(props);

        var dataTable = new DataTable();

        this.state = {
            filteredShapes: this.props.chart.shapes,
            extractor: new AxisExtractor(dataTable.axisX),
            dataTable: dataTable,
            shapeSelection: new ShapeSelection(),
            overlay: new Overlay()
        };

        UndoManager.get().dataTable = dataTable;
        this.filters = [];
        this.chartView = null;
        this.seriesWidget = null;
        this.xAxisWidget = null;
        this.yAxisWidget = null;
        this.statusBarText = "";
        this.draggableShapeSelection = null;
        this.globalMouseMoveListener = null;

        var self = this;
        window.onresize = function () {
            self.forceUpdate();
        }

        document.onkeydown = (ev => {this.onKeyDown(ev)});
        document.onkeyup = (ev => {this.onKeyUp(ev)});
    }

    onUndo() : void {
        if (UndoManager.get().canUndo()) {
            this.restoreDataTable(UndoManager.get().undo());
        }
    }

    onRedo() : void {
        if (UndoManager.get().canRedo()) {
            this.restoreDataTable(UndoManager.get().redo());
        }
    }

    onKeyDown(event : KeyboardEvent) : void {
        if (event.ctrlKey || event.metaKey) { // Use metaKey for macOS
            // It's a keyboard shortcut
            if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
                this.onRedo();
            } else if (event.key === 'z') {
                this.onUndo();
            }
        } else {
            if (event.key === " ") {
                if (this.chartView !== null) {
                    this.chartView.enterPanMode();
                }
            } else if (event.key === "Escape") {
                if (this.draggableShapeSelection !== null) {
                    this.draggableShapeSelection.clearShapes();
                }
            } else if (event.key === "Shift") {
                if (this.draggableShapeSelection !== null) {
                    this.draggableShapeSelection.hide(); // No draggable selection while using shift as it would hamper proper selection
                }
            }
        }
    }

    restoreDataTable(dataTable : DataTable) : void {
        this.setState({dataTable: dataTable});
        UndoManager.get().dataTable = dataTable;
    }

    onKeyUp(event : KeyboardEvent) : void {
        if (event.key === " ") {
            if (this.chartView !== null) {
                this.chartView.exitPanMode();
            }
        } else if (event.key === "Shift") {
            if (this.draggableShapeSelection !== null) {
                this.draggableShapeSelection.show();
            }
        }
    }

    /**
     * Returns all the 'ghost" shapes
     * A shape becomes a ghost once its selected
     */
    getGhostShapes() : ShapeCommand[] {
        var ghosts : ShapeCommand[] = [];
        // No other solution than to go through all the elements
        ghosts = ghosts.concat(this.state.dataTable.axisX.shapes);
        ghosts = ghosts.concat(this.state.dataTable.axisY.shapes);
        for (var i = 0; i < this.state.dataTable.series.length; ++i) {
            var serie = this.state.dataTable.series[i];
            ghosts = ghosts.concat(serie.shapes);
        }

        // Shapes from the draggable selection should also be ghosts
        if (this.state.shapeSelection.isDragged) {
            var shapesIdx = this.state.shapeSelection.shapesIdx;
            for (var j = 0; j < shapesIdx.length; ++j) {
                var idx = shapesIdx[j];
                var shape = this.state.filteredShapes[idx];
                ghosts.push(shape);
            }
        }

        return ghosts;
    }

    onFilterChanged() : void {
        var shapes = this.props.chart.shapes;
        for (var i = 0; i < this.filters.length; ++i) {
            shapes = this.filters[i].apply(shapes);
        }

        // Should clear the selection too in case the selected shapes got filtered
        this.state.shapeSelection.clear();

        this.setState({ filteredShapes: shapes});
    }

    onMouseMoved(pos : MouseEvent) : void {
        var text = "Value: ("
        let vx = this.state.dataTable.axisX.pixelToTick(pos.x);
        let vy = this.state.dataTable.axisY.pixelToTick(pos.y);
        if (Number.isFinite(vx)) vx = vx.toFixed(2);
        if (Number.isFinite(vy)) vy = vy.toFixed(2);

        text += vx;
        text += ", ";
        text += vy;
        text += " Pixels: (";
        text += pos.x.toFixed() + ", " + pos.y.toFixed() + ")";

        this.statusBarText = text;

        // We kind of bypass React's default way of updating the DOM here (by modifying the state)
        // to avoid performances issues (we do not want the element to be re-rendered every time the mouse moves).
        var statusBar = document.getElementById("statusBar");
        if (statusBar !== undefined && statusBar !== null) {
            statusBar.innerHTML = this.statusBarText;
        }

    }

    updateLayout() : void {
        if (this.chartView != null) {
            this.chartView.resize();
        }
    }


    onGlobalMouseMove(event : MouseEvent) : void {
        var dragElement = document.getElementById("dragElement");
        if (dragElement !== null) {
            dragElement.style.left = (event.clientX - dragElement.clientWidth/2) + 'px';
            dragElement.style.top = (event.clientY - dragElement.clientHeight/2) + 'px';
        }
    }

    componentDidMount() : void {
        this.updateLayout();
        this.globalMouseMoveListener = this.onGlobalMouseMove.bind(this);
        document.addEventListener('mousemove', this.globalMouseMoveListener);
    }

    componentWillUnmount() : void {
        document.removeEventListener('mousemove', this.globalMouseMoveListener);
    }

    componentDidUpdate() : void {
        this.updateLayout();
    }

    getChart() : any {
        return this.props.chart;
    }

    getDraggableSelection() : DraggableShapeSelection {
        return this.draggableShapeSelection;
    }

    render() : JSX.Element {
        const nbRows = 24;
        const nbCols = 24;
        const verticalMargin = 4; // Vertical margin between panels
        const horizontalMargin = 4; // Horizontal margin between panels
        const rowHeight = Math.floor(Math.max((document.body.offsetHeight-verticalMargin)/nbRows-verticalMargin, 21)); // Cannot go below 21 otherwise some panels become unusable
        const chartRect = this.props.chart.rect;
        const aspectRatio = chartRect.height/chartRect.width;
        const chartViewHeight = aspectRatio * 15 * (document.body.offsetWidth-horizontalMargin)/nbCols-horizontalMargin;
        const chartViewHeightUnits = Math.min(Math.round(chartViewHeight/rowHeight)+1, 22); // +1 for the filters
        const chartViewMargin = Math.round((22-chartViewHeightUnits)/2);

        const layout = [
            {i: 'menuBar'   , x: 0, y: 0,  w: 24, h: 1, static: true},
            {i: 'axisTableX', x: 0, y: 1,  w: 9,  h: 3},
            {i: 'axisTableY', x: 0, y: 4,  w: 9,  h: 3},
            {i: 'dataTable' , x: 0, y: 6,  w: 9,  h: 8},
            {i: 'newChart'  , x: 0, y: 14,  w: 9,  h: 9},
            {i: 'chartView' , x: 9, y: 1,  w: 15, h: chartViewHeightUnits},
            {i: 'statusBar' , x: 9, y: chartViewHeightUnits+1, w: 15, h: 1, static: true},
          ];

          // Need to clear the filters as we are going to add new ones
          this.filters = [];

          return (
            <div id='chartExtractor'>
                <DraggableShapeSelection ref={draggableShapeSelection => this.draggableShapeSelection = draggableShapeSelection}
                    state={this.state}
                    setState={this.setState.bind(this)}
                />
                <GridLayout className="layout" 
                            draggableHandle=".panelDragHandle"
                            layout={layout} 
                            cols={nbCols} 
                            rowHeight={rowHeight} 
                            width={document.body.offsetWidth}
                            containerPadding={[0, 0]}
                            margin={[horizontalMargin, verticalMargin]}
                            onLayoutChange={e => {this.updateLayout()}}
                            resizeHandles={["se"]}
                            autoSize={false}
                            compactType={null}
                            >
                <div key="menuBar" className="title">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div>
                            <button className={"button big" + (UndoManager.get().canUndo() ? "" : " disabled")} onMouseDown={(e) => e.preventDefault()} onClick={(event)=> this.onUndo()}>
                                <i className="fa fa-undo" aria-hidden="true"></i> Undo ({UndoManager.get().undoHistory.length > 9 ? "+9" : UndoManager.get().undoHistory.length})
                            </button>
                            <button className={"button big" + (UndoManager.get().canRedo() ? "" : " disabled")} onMouseDown={(e) => e.preventDefault()} onClick={(event)=> this.onRedo()}>
                                <i className="fa fa-repeat" aria-hidden="true"></i> Redo ({UndoManager.get().redoHistory.length > 9 ? "+9" : UndoManager.get().redoHistory.length})
                            </button>
                        </div>

                        <div>
                            <i className="fa fa-bar-chart" aria-hidden="true"></i> ChartDetective 
                        </div>

                        <div></div>
                    </div>
                </div>

                <div key="chartView" className="panel">
                    <div style={{width: '100%', height: '100%'}}> {/* This div is just there so that the ChartView can resize properly and take the filters into account */}
                        <div className="panelDragHandle panelTitle"><i className="fa fa-line-chart" aria-hidden="true"></i> Chart</div>


                        <FilterPanel ref={filter => {if (filter !== null) this.filters.push(filter)}}
                                onFilterChanged={this.onFilterChanged.bind(this)}
                                filter={new ColorFilter()}
                                shapes={this.props.chart.shapes} />

                        <FilterPanel ref={filter => {if (filter !== null) this.filters.push(filter)}}
                                onFilterChanged={this.onFilterChanged.bind(this)}
                                filter={new ShapeFilter()}
                                shapes={this.props.chart.shapes} />

                        <div className="panelSeparator"></div>
                        <ChartView ref={chartView => this.chartView = chartView}
                            state={this.state}
                            setState={this.setState.bind(this)}
                            getDraggableSelection={this.getDraggableSelection.bind(this)}
                            ghostShapes={this.getGhostShapes()}
                            chart={{rect: this.props.chart.rect, shapes: this.state.filteredShapes}} // Should display what has been filtered
                            onMouseMoved={this.onMouseMoved.bind(this)} />
                    </div>
                </div>
                <div key="axisTableX" className="panel" >
                        <AxisWidget
                            ref={axisWidget => this.xAxisWidget = axisWidget}
                            axis={this.state.dataTable.axisX}
                            state={this.state}
                            shapes={this.props.chart.shapes}
                            setState={this.setState.bind(this)}
                        >
                            <div className="panelDragHandle" style={{position: "absolute", top: 4, left: 5, fontSize: "14px"}}><i className="fa fa-arrow-right" aria-hidden="true"></i></div>
                        </AxisWidget>
                </div>

                <div key="axisTableY" className="panel">
                        <AxisWidget
                            ref={axisWidget => this.yAxisWidget = axisWidget}
                            axis={this.state.dataTable.axisY}
                            state={this.state}
                            shapes={this.props.chart.shapes}
                            setState={this.setState.bind(this)}
                        >
                            <div className="panelDragHandle" style={{position: "absolute", top: 4, left: 5, fontSize: "14px"}}><i className="fa fa-arrow-up" aria-hidden="true"></i></div>
                        </AxisWidget>
                </div>
                <div key="dataTable" className="panel scrollY" >
                        <SeriesWidget
                            ref={seriesWidget => this.seriesWidget = seriesWidget}
                            dataTable={this.state.dataTable}
                            state={this.state}
                            shapes={this.props.chart.shapes}
                            setState={this.setState.bind(this)}
                        >
                            <div className="panelDragHandle" style={{position: "absolute", top: 4, left: 5, fontSize: "16px"}}><i className="fa fa-table" aria-hidden="true"></i></div>
                        </SeriesWidget>
                </div>
                <div key="newChart" className="panel" >
                        <div className="panelDragHandle panelTitle"><i className="fa fa-line-chart" aria-hidden="true"></i> Reconstructed Chart</div>
                        <div style={{flex: 1, width: "100%", overflow: "scroll"}}>
                            <ReconstructedChart
                                state={this.state}
                                setState={this.setState.bind(this)}
                            />
                        </div>
                </div>

                <div key="statusBar" className="panel" >
                    <div id='statusBar' style={{ textAlign: 'right' }}>{this.statusBarText}</div>
                </div>
                </GridLayout>
                <div id="snackbar-container"></div>
            </div>
          )
    }
}
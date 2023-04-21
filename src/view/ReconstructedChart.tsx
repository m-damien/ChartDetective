import React from 'react';
import { ChartElementType } from '../datastructure/chartelements/ChartElement';
import {ChartExtractorState} from './ChartExtractor';

import Plot from 'react-plotly.js';
import AxisCoordinate2D from '../datastructure/AxisCoordinate2D';
import SubChartElement from '../datastructure/chartelements/SubChartElement';

interface ReconstructedChartProps {
    state : ChartExtractorState;
    setState : any;
}

interface CoordArray {
    x : number[],
    y : number[]
}

export default class ReconstructedChart extends React.Component<ReconstructedChartProps, any> {
    static dashLineStyle = ['solid', 'dash', 'dot', 'longdash', 'dashdot', 'longdashdot'];
    static markerSymbols = ['circle', 'cross', 'square', 'diamond', 'triangle', 'pentagon', 'hexagon', 'octagon', 'star'];
    static barPatternStyle = ['', '/', '\\', 'x', '-', '|', '+', '.'];

    constructor(props) {
        super(props)
    }

    axisCoordToArray(coord : AxisCoordinate2D[]) : CoordArray {
        const x = [];
        const y = [];

        for (const pt of coord) {
            x.push(pt.x.value);
            y.push(pt.y.value);
        }

        return {x: x, y: y};
    }

    render() : JSX.Element {

        // Get all the series and put them in plotly's data format
        const traces = [];
        const styleCounter = {};
        for (const serie of this.props.state.dataTable.series) {
            if (!(serie instanceof SubChartElement)) { // Only main elements have traces. Error bars etcs are just parameters
                const coords = this.axisCoordToArray(serie.data);

                let errorBar = null;
                if (serie.hasErrorBars()) {
                    const upperValue = this.axisCoordToArray(serie.upperErrorBar.data).y;
                    const lowerValue = this.axisCoordToArray(serie.lowerErrorBar.data).y;
                    const array = upperValue.map((v, i) => Math.abs(v - coords.y[i]));
                    const arrayMinus = lowerValue.map((v, i) => Math.abs(v - coords.y[i]));

                    errorBar = {
                        type: 'data',
                        symmetric: false,
                        array: array,
                        arrayminus: arrayMinus
                    }
                }

                let color = serie.getMainColor();
                if (color === "#ffffff") color = "#CCCCCC" // White series are invisible with plotly, so we convert them to gray
                const trace = {
                    x: coords.x,
                    y: coords.y,
                    name: serie.name,
                    error_y: errorBar,
                    line: {
                        color: color
                    },
                    marker: {
                        color: color
                    }
                };

                const styleHash = ChartElementType.LINE + "." + color;
                // We do not want two series to have the same style, so we count them to determine the style to use
                if (!(styleHash in styleCounter)) styleCounter[styleHash] = 0;
                const styleId = styleCounter[styleHash];

                if (serie.is(ChartElementType.LINE)) {
                    trace['type'] = "scatter";
                    trace['mode'] = "lines";
                    trace.line['dash'] = ReconstructedChart.dashLineStyle[styleId % ReconstructedChart.dashLineStyle.length];
                }

                if (serie.is(ChartElementType.SCATTER)) {
                    trace['type'] = "scatter"
                    trace['mode'] = "markers"
                    trace.marker['symbol'] = ReconstructedChart.markerSymbols[styleId % ReconstructedChart.markerSymbols.length];
                }

                if (serie.is(ChartElementType.BAR)) {
                    trace['type'] = "bar"
                    trace.marker['pattern'] = {
                        shape: ReconstructedChart.barPatternStyle[styleId % ReconstructedChart.barPatternStyle.length]
                    };
                }

                if (serie.is(ChartElementType.BOX_PLOT)) {
                    trace['type'] = "box";
                    trace['median'] = coords.y;
                    trace['y'] = undefined;
                    if (serie.linkedElements[5] !== null) trace['lowerfence'] = this.axisCoordToArray(serie.linkedElements[5].data).y;
                    if (serie.linkedElements[4] !== null) trace['upperfence'] = this.axisCoordToArray(serie.linkedElements[4].data).y;
                    if (serie.linkedElements[2] !== null) trace['q1'] = this.axisCoordToArray(serie.linkedElements[2].data).y;
                    if (serie.linkedElements[3] !== null) trace['q3'] = this.axisCoordToArray(serie.linkedElements[3].data).y;
                }
                
                traces.push(trace);
                styleCounter[styleHash] += 1;
            }
        }


        return (
            <Plot
                style={{width: "100%", height: "100%"}}
                useResizeHandler={true}
                data={traces}
                layout={ {
                    autosize: true,
                    title: this.props.state.dataTable.name,
                    xaxis: {
                        type: this.props.state.dataTable.axisX.isCategorical() ? "category" : "linear",
                        title: this.props.state.dataTable.axisX.name
                    },
                    yaxis: {
                        type: this.props.state.dataTable.axisY.isCategorical() ? "category" : "linear",
                        title: this.props.state.dataTable.axisY.name
                    },
                    boxmode: 'group' // Needed to support boxplot with the x position. Should not impact other types of charts.
                } }
            />
        );
    }
}
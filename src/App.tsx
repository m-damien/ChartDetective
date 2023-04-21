import './App.css';
import React from 'react';


import ChartExtractor from './view/ChartExtractor';
import PDFJSViewer from './view/pdfViewer/PDFJSViewer';
import ShapeCommand from './datastructure/ShapeCommand';
import Rectangle from './datastructure/Rectangle';

interface AppState {
  chartSelection : any;
}

export default class App extends React.Component<any, AppState> {
  constructor(props) {
    super(props);
    this.state = {
      chartSelection: {}
    }
  }

  setSelectedChart(shapes : ShapeCommand[], rect : Rectangle) : void {
    if (shapes.length > 0) {
      this.setState({chartSelection: {shapes: shapes, rect: rect}});

    }
  }

  getChart() : any {
    return { rect: this.state.chartSelection.rect, shapes: this.state.chartSelection.shapes };
  }

  render() : JSX.Element {
    if (this.state.chartSelection.shapes === undefined) {
      // If no shapes are selected, show the PDFViewer so that
      // the user can select the chart. Usually happens when the app was just loaded.
      return (
        <div className="App">
          <PDFJSViewer onShapesSelected={this.setSelectedChart.bind(this)}></PDFJSViewer>
        </div>
      );
    } else {
      return (
        <div className="App">
          <ChartExtractor chart={this.getChart()}/>
        </div>
      )
    }
  }
}
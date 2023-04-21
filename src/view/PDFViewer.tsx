import React from 'react';
import ShapeCommand from '../datastructure/ShapeCommand';
import HookedCanvasFactory from './HookedCanvasFactory';


interface Point {
  x : number;
  y : number;
}

interface PDFViewerState {
  startPt: Point;
  endPt : Point;
  isDragging : boolean;
  page : number;
  maxPage : number;
  isDraggingOver : boolean;
  pdfLoaded : boolean;
}

export default class PDFViewer extends React.Component<any, PDFViewerState> {
  pdfjs : any;
  pdfBuffer : HTMLCanvasElement;
  renderTask : any;
  commands : ShapeCommand[];
  pdf : any;
  onFinishedLoading : any;

  constructor(props) {
    super(props);
    this.pdfjs = window['pdfjs-dist/build/pdf'];
    this.pdfjs.GlobalWorkerOptions.workerSrc = "libs/pdf.worker.js";
    this.pdfBuffer = document.createElement('canvas');
    this.renderTask = null;
    this.commands = [];
    this.onFinishedLoading = null;

    this.state = {
      startPt: {x:-1, y:-1},
      endPt: {x:-1, y:-1},
      isDragging: false,
      page: 1,
      maxPage: 1,
      isDraggingOver: false,
      pdfLoaded: false
    };
  }

  disableEvent(event : MouseEvent) : boolean {
    this.setState({isDraggingOver: true});
    event.preventDefault();
    return false;
  }

  onFileDropped(event : DragEvent) : void {
    event.preventDefault();
    this.setState({isDraggingOver: false});
    var file = event.dataTransfer.files[0]; // We'll handle only one file for now
    var fileReader = new FileReader();
    var self = this;
    fileReader.onload = function () {
      self.loadFromData(new Uint8Array(this.result as ArrayBufferLike));
    };
    fileReader.readAsArrayBuffer(file);
  }

  setPage(pageNumber : number) : void {
    this.commands = [];
    this.setState({page: pageNumber});
    if (this.pdf !== undefined) {
      var self = this;
      this.pdf.getPage(pageNumber).then(function (page) {
        var viewport = page.getViewport({ scale: 1 });

        self.pdfBuffer = document.createElement('canvas'); // FIX: For some reasons, on Google Chrome we need to re-create the pdfbuffer otherwise the hook of save/restore creates issues
        var context = self.pdfBuffer.getContext('2d');
        var hookedCanvasFactory = new HookedCanvasFactory(context);
        self.pdfBuffer.height = viewport.height;
        self.pdfBuffer.width = viewport.width;

        var renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvasFactory: hookedCanvasFactory
        };

        if (self.renderTask != null) {
          // Cancel the current task if one was already getting processed
          self.renderTask.cancel();
          self.renderTask = null;
        }

        self.renderTask = page.render(renderContext);
        self.renderTask.promise.then(function () {
          self.renderTask = null;
          self.commands = self.commands.concat(hookedCanvasFactory.getCommands());
          if (self.onFinishedLoading !== null) {
            self.onFinishedLoading();
          }
          self.redraw();
        }).catch(function (reason) {
          // That's fine, a rendering task can be cancelled.
        });
      });
    }
  }

  eventToMousePos(event : MouseEvent) : Point {
    var canvas = document.getElementById("pdf-canvas");
    var canvasRect = canvas.getBoundingClientRect();

    return {x: event.clientX-canvasRect.left, y: event.clientY-canvasRect.top};
  }

  onMouseDown(event : MouseEvent) : void {
    var pos = this.eventToMousePos(event);
    this.setState({isDragging: true, startPt: pos, endPt: pos});
  }

  onMouseMove(event : MouseEvent) : void {
    if (this.state.isDragging) {
      var pos = this.eventToMousePos(event);
      this.setState({endPt: pos});
    }
  }

  selectChart(x, y, width, height) : void {
      // Get all the selected shapes
      var selectRect = {x: x, y: y, width: width, height: height};
      var selectedShapes = [];
      for (var i = 0; i < this.commands.length; ++i) {
        if (this.commands[i].isContained(selectRect)) {
          var cmd = this.commands[i];
          /*if (cmd.text === undefined) {
            selectedShapes = selectedShapes.concat(ShapeUtils.splitIntoSubShapes(cmd));
          } else {*/
            selectedShapes.push(cmd);
          //}
          
        }
      }
      
      if (selectedShapes.length > 0) {
        this.props.setSelectedChart({rect: selectRect, shapes: selectedShapes});
      }
  }


  onMouseUp(event : MouseEvent) : void {
    this.setState({isDragging: false});
    var sx = Math.min(this.state.startPt.x, this.state.endPt.x);
    var sy = Math.min(this.state.startPt.y, this.state.endPt.y);
    var w = Math.abs(this.state.endPt.x - this.state.startPt.x);
    var h = Math.abs(this.state.endPt.y - this.state.startPt.y);

    this.selectChart(sx, sy, w, h);
  }

  onMouseLeave(event : MouseEvent) : void {
    this.setState({isDragging: false, isDraggingOver: false});
  }

  onPageChanged(pageNumber : number) : void {
    this.setPage(pageNumber);
  }

  loadFromURL(url : any) : void {
    var self = this;
    var loadingTask = this.pdfjs.getDocument(url);
    loadingTask.promise.then(function (pdf) {
      self.pdf = pdf;
      self.setState({maxPage: self.pdf.numPages, pdfLoaded: true})
      self.setPage(self.state.page);
    }, function (reason) {
      alert(reason);
      console.error(reason);
    });
  }

  loadFromData(pdfData : any) : void {
    this.loadFromURL({ data: pdfData });
  }

  redraw() : void {
    var canvas = document.getElementById("pdf-canvas") as HTMLCanvasElement;
    var ctx = canvas.getContext('2d');
    if (this.state.pdfLoaded) {
      canvas.width = this.pdfBuffer.width;
      canvas.height = this.pdfBuffer.height;
  
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      // Draw the PDF
      ctx.drawImage(this.pdfBuffer, 0, 0);
  
      ctx.fillStyle = '#0000FF70';
      var sx = this.state.startPt.x;
      var sy = this.state.startPt.y;
      var w = this.state.endPt.x - sx
      var h = this.state.endPt.y - sy;
      ctx.fillRect(sx, sy, w, h);
    }
  }

  render() : JSX.Element {
    return (
      <div style={{overflow: 'hidden', width: "100%"}}>
        <div style={{width: '100%', paddingBottom: '5px', paddingTop: '5px', textAlign: 'center', backgroundColor: '#DDDDDD'}}>
          <div className='pack'>
            <label>Page: </label>
            <input type="number" id="pdf-page" name="pdf-page"
              value={this.state.page} min="1" max={this.state.maxPage} 
              onChange={(event) => this.onPageChanged(parseInt(event.target.value))}/> 
            <span> / {this.state.maxPage}</span>
          </div>
        </div>
        <div style={{position: "relative"}}>
          <canvas className="center" id='pdf-canvas' width='400px' height='500px'
            style={{border: this.state.isDraggingOver? '2px dashed blue' : '1px solid black'}}
            onDragOver={this.disableEvent.bind(this) as any}
            onDrop={this.onFileDropped.bind(this) as any}
            onMouseDown={this.onMouseDown.bind(this) as any}
            onMouseMove={this.onMouseMove.bind(this) as any}
            onMouseUp={this.onMouseUp.bind(this) as any}
            onMouseLeave={this.onMouseLeave.bind(this) as any}
          >
            Canvas not supported
          </canvas>
          {!this.state.pdfLoaded &&
          <div style={{pointerEvents: 'none', position: "absolute", left: "50%", top: "50%", transform:'translate(-50%, -50%)'}}>
            <i className="fa fa-upload" aria-hidden="true"></i> Drag and drop PDF file here
          </div>
          }
        </div>
      </div>
    )
  }

  componentDidUpdate() : void {
    this.redraw();
  }
}
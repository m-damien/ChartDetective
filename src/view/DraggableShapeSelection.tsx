import React from 'react';
import ShapeCommand from '../datastructure/ShapeCommand';
import ShapeSelection from '../datastructure/ShapeSelection';

interface Coordinate {
    x : number,
    y : number
}

interface DraggableShapeSelectionProps {
    state : any
    setState : any
}

export default class DraggableShapeSelection extends React.Component<DraggableShapeSelectionProps, any> {
    dragOffset : Coordinate;
    mouseIntialPos : Coordinate;
    scale : Coordinate;
    translate : Coordinate;
    globalMouseMoveListener : any;
    globalMouseUpListener : any;
    isVisible : boolean;

    constructor(props : DraggableShapeSelectionProps) {
        super(props);
        this.dragOffset = {x: 0, y: 0};
        this.mouseIntialPos = {x: 0, y: 0};

        this.scale = {x: 1, y: 1};
        this.translate = {x: 0, y: 0};

        this.isVisible = true;
    }

    onMouseDown(event : MouseEvent) : void {
        if (event.button === 0) {
            this.getSelection().isDragged = true;
            this.props.setState({shapeSelection: this.getSelection()});
            this.mouseIntialPos = {x: event.clientX, y: event.clientY};
            event.preventDefault();
        }
    }

    getX() : number {
        var selectionRect = this.getSelection().rect;
        if (selectionRect === null) {
            return 0;
        }
        return (selectionRect.x*this.scale.x+this.translate.x)-this.dragOffset.x;
    }

    getY() : number {
        var selectionRect = this.getSelection().rect;
        if (selectionRect === null) {
            return 0;
        }
        return (selectionRect.y*this.scale.y+this.translate.y)-this.dragOffset.y;
    }

    updateSelectionPosition() : void {
        var divSelection = document.getElementById("draggableSelection");
        if (divSelection !== null) {
            // Modify the DOM directly to make movement smoother
            divSelection.style.left = (this.getX()) + "px";
            divSelection.style.top = (this.getY()) + "px";
        }
    }

    onGlobalMouseMove(event : MouseEvent) : void {
        if (this.getSelection().isDragged) {
            this.dragOffset = {
                x: this.mouseIntialPos.x-event.clientX,
                y: this.mouseIntialPos.y-event.clientY
            }
            this.updateSelectionPosition();
            event.preventDefault();
        }
    }

    onGlobalMouseUp(event : MouseEvent) : void {
        if (event.button === 0) {
            // Move the rect back to its initial position
            this.dragOffset = {x: 0, y: 0};
            this.updateSelectionPosition();

            if (this.getSelection().isDragged) {
                this.getSelection().isDragged = false;
                this.props.setState({shapeSelection: this.getSelection()});
                this.forceUpdate();
                event.preventDefault();
            }
        }
    }

    getShapesBBox(shapesIdx : number[]) : any {        
        if (shapesIdx.length === 0) {
            return null;
        }
        var shapes = this.props.state.filteredShapes;
        var cmdRect = shapes[shapesIdx[0]].rect;
        var corners = {
            sx: cmdRect.x,
            sy: cmdRect.y,
            ex: cmdRect.x+cmdRect.width,
            ey: cmdRect.y+cmdRect.height
        };

        for (var i = 1; i < shapesIdx.length; ++i) {
            var cmd = shapes[shapesIdx[i]];
            corners.sx = Math.min(corners.sx, cmd.rect.x);
            corners.sy = Math.min(corners.sy, cmd.rect.y);
            corners.ex = Math.max(corners.ex, cmd.rect.x+cmd.rect.width);
            corners.ey = Math.max(corners.ey, cmd.rect.y+cmd.rect.height);
        }
        
        return {x: corners.sx, y: corners.sy, width: corners.ex-corners.sx, height: corners.ey-corners.sy};
    }

    getSelection() : ShapeSelection {
        return this.props.state.shapeSelection;
    }

    updateSelectionRect() {
        var rect = this.getShapesBBox(this.getSelection().shapesIdx);
        // Add some padding to the rect
        var pad = 2;
        rect = {x: rect.x-pad, y: rect.y-pad, 
            width: rect.width+pad*2, height: rect.height+pad*2};
            
        this.getSelection().rect = rect;
        this.props.setState({shapeSelection: this.getSelection()});
    }

    addShapesIdx(shapesIdx : number[], invertedSelection = false) : void {
        for (const shapeIdx of shapesIdx) {
            const index = this.getSelection().shapesIdx.indexOf(shapeIdx);
            if (index > -1) { // Shape already exists in selection
                if (invertedSelection) {
                    // Invert the selection, so we remove the shape
                    this.getSelection().shapesIdx.splice(index, 1);
                }
                // Do nothing if not inverted, the element is already included...
            } else {
                this.getSelection().shapesIdx.push(shapeIdx)
            }
        }
        this.updateSelectionRect();
    }

    hide() {
        var canvas = document.getElementById("draggableSelection") as HTMLCanvasElement;
        if (canvas !== null) {
            canvas.style.display = "none";
            this.isVisible = false;
        }
    }

    show() {
        var canvas = document.getElementById("draggableSelection") as HTMLCanvasElement;
        if (canvas !== null) {
            canvas.style.display = "block";
            this.isVisible = true;
        }
    }

    redraw() : void {
        var canvas = document.getElementById("draggableSelection") as HTMLCanvasElement;

        // Draw the shapes in the selection rect
        if (canvas !== null) {
            var ctx = canvas.getContext("2d");
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Only if the selection is being dragged, otherwise we'd rather see through it
            if (this.getSelection().isDragged) {
                var shapes = this.props.state.filteredShapes as ShapeCommand[];
                var rect = this.getSelection().rect;
                ctx.save();
                ctx.scale(this.scale.x, this.scale.y);
                ctx.translate(-rect.x, -rect.y);
                for (var i = 0; i < this.getSelection().shapesIdx.length; ++i) {
                    var cmd = shapes[this.getSelection().shapesIdx[i]];
                    const alpha = cmd.globalAlpha;
                    cmd.globalAlpha = 0.4;
                    cmd.draw(ctx);
                    cmd.globalAlpha = alpha;
                }
                ctx.restore();
            }
        }
    }

    clearShapes() : void {
        this.getSelection().clear();
        this.props.setState({shapeSelection: this.getSelection()});
    }

    componentDidMount() : void {
        this.globalMouseMoveListener = this.onGlobalMouseMove.bind(this);
        document.addEventListener('mousemove', this.globalMouseMoveListener);

        this.globalMouseUpListener = this.onGlobalMouseUp.bind(this);
        document.addEventListener('mouseup', this.globalMouseUpListener);
        this.redraw();
    }

    componentDidUpdate() : void{
        this.redraw();
    }

    render() : JSX.Element {
        var selectionRect = this.getSelection().rect;
        var selectionRectHTML = null;
        var isDragging = false;
        if (selectionRect !== null) {
            var cursor = 'grab';
            if (this.getSelection().isDragged) {
                cursor = 'grabbing';
                isDragging = true;
            }
            selectionRectHTML = (<canvas id="draggableSelection" 
            onMouseDown={this.onMouseDown.bind(this) as any}
            width={selectionRect.width*this.scale.x}
            height={selectionRect.height*this.scale.y}
            style={{position: 'absolute',
                    left: this.getX(), 
                    top: this.getY(),
                    display: this.isVisible ? "block" : "none",
                    border: '1px solid rgba(81, 131, 251)', 
                    backgroundColor: 'rgba(0, 0, 0, 0)',
                    pointerEvents: isDragging ? 'none' : 'all',
                    cursor: cursor
            }}
            ></canvas>);
        }

        return selectionRectHTML;
    }

    componentWillUnmount() : void {
        document.removeEventListener('mousemove', this.globalMouseMoveListener);
        document.removeEventListener('mouseup', this.globalMouseUpListener);
    }
}
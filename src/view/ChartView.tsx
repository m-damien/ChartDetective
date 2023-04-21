import React, { Fragment } from 'react';
import AxisCoordinate2D from '../datastructure/AxisCoordinate2D';
import { OverlayType } from '../datastructure/Overlay';
import ShapeCommand from '../datastructure/ShapeCommand';

interface Point {
    x: number;
    y: number;
}

interface CommandWithIdx {
    cmd : ShapeCommand;
    idx : number;
}

interface ChartViewProps {
    chart : any;
    getDraggableSelection : any;
    onMouseMoved : any;
    state : any;
    ghostShapes : any;
    setState : any;
}

interface ChartViewState {
    isPanning : boolean,
    isCentered : boolean
}

export default class ChartView extends React.Component<ChartViewProps, ChartViewState> {
    hoveredCmdsIdx : number[];
    startPt : Point;
    endPt : Point;
    isMouseDown : boolean;
    selectionColor : string;
    selectionRectOutlineColor : string;
    selectionRectColor : string;
    overlayColor : string;
    chartBuffer : HTMLCanvasElement;
    zbuffer : HTMLCanvasElement;
    zIncrement : number;
    offset : number;
    intervalId : number;
    globalMouseUpListener : any;

    previousWidth : number;
    previousHeight : number;
    previousShapeCount : number;
    previousGhostCount : number;

    // Transformations related
    bufferTransform : DOMMatrix; // Transformation applied to the buffer (high res), should be limited to scale. Needs call to #refreshBuffers
    viewTransform : DOMMatrix; // Transformation applied to the view, used for translation and "temporary" re-scaling (low res). Needs call to #redraw
    viewTransformedTime : number; // Timestamp of the last time the view was transformed (used to decide when to move a view transform to a buffer transform for higher res)
    viewTransformed : boolean; // True when the view was transformed (but the buffer was not)
    tmpPoint : DOMPoint; // A point stored to avoid re-allocating

    constructor(props : ChartViewProps) {
        super(props);
        this.state = {isPanning: false, isCentered: true};
        // Selection
        this.hoveredCmdsIdx = [];
        this.startPt = {x: 0, y:0};
        this.endPt = {x: 0, y: 0};
        this.isMouseDown = false;

        // Style 
        this.selectionColor = 'rgba(55, 133, 246, 255)';
        this.selectionRectOutlineColor = 'rgba(127, 127, 127)';
        this.selectionRectColor = 'rgba(81, 131, 251, 0)';
        this.overlayColor = 'rgba(55, 133, 246, 255)';

        // Double-buffering to avoid redrawing the chart
        this.chartBuffer = document.createElement('canvas');

        // Variables related to the Z-Buffer
        this.zbuffer = document.createElement('canvas');
        this.zIncrement = 0;

        // Offset to animate dashed lines
        this.offset = 0;

        // Used to avoid useless refreshes
        this.previousWidth = 0;
        this.previousHeight = 0;
        this.previousShapeCount = 0;
        this.previousGhostCount = 0;

        // Transformations applied to the chart (used for panning and zooming)
        this.viewTransform = new DOMMatrix();
        this.bufferTransform = new DOMMatrix();
        this.tmpPoint = new DOMPoint();
        this.viewTransformedTime = 0;
        this.viewTransformed = false;
    }

    transformPos(x : number, y : number, transformed = false, tmpTranformed = false) : Point {
        this.tmpPoint.x = x;
        this.tmpPoint.y = y;
        this.tmpPoint.w = 1;
        this.tmpPoint.z = 0;

        var transformedPt = this.tmpPoint;

        if (transformed && tmpTranformed) {
            transformedPt = this.viewTransform.multiply(this.bufferTransform).inverse().transformPoint(this.tmpPoint);
        } else {
            if (tmpTranformed) {
                transformedPt = this.viewTransform.inverse().transformPoint(this.tmpPoint);
            }
    
            if (transformed) {
                transformedPt = this.bufferTransform.inverse().transformPoint(this.tmpPoint);
            }
        }

        return { x: transformedPt.x, y: transformedPt.y };
    }

    eventToMousePos(event : MouseEvent|WheelEvent, transformed = false, tmpTranformed = false) : Point {
        var canvas = document.getElementById("chartview-canvas");
        var canvasRect = canvas.getBoundingClientRect();
        var x = (event.clientX - canvasRect.left);
        var y = (event.clientY - canvasRect.top);

        return this.transformPos(x, y, transformed, tmpTranformed);
    }

    getColorDistance(hexColorA : number, hexColorB : number) : number {
        var rA = (hexColorA >> 16) & 255;
        var gA = (hexColorA >> 8) & 255;
        var bA = hexColorA & 255;
        var rB = (hexColorB >> 16) & 255;
        var gB = (hexColorB >> 8) & 255;
        var bB = hexColorB & 255;

        return Math.abs(rA - rB) + Math.abs(gA - gB) + Math.abs(bA - bB);
    }

    rgbToZValue(r : number, g : number, b : number) : number{
        return ((r << 16) + (g << 8) + (b)) - 1; // Ignore alpha
    }

    zValueToCommand(zvalue : number) : CommandWithIdx {
        if (zvalue % this.zIncrement !== 0) {
            return null;
        }

        var shapes = this.props.chart.shapes;
        var idx = zvalue / this.zIncrement;

        if (idx < shapes.length) {
            return { cmd: shapes[idx], idx: idx };
        }
        return null;
    }

    getCommandAtPos(x : number, y : number) : CommandWithIdx {
        // Look at the depth value exactly at the location, and around it (in a 3x3 square)
        var zbufferData = this.zbuffer.getContext('2d').getImageData(x - 1, y - 1, 3, 3);
        var centralVal = this.rgbToZValue(zbufferData.data[16], zbufferData.data[17], zbufferData.data[18]);
        var selectedCmd = this.zValueToCommand(centralVal);

        if (selectedCmd === null) {
            // This can happen because of antialiasing on the zBuffer
            // Unfortunately, there is no way of disabling antialiasing in Javascript with a canvas
            // And re-writing all the drawing primitives to remove antialiasing would be too costly
            // So we are stuck with a zBuffer not as reliable as it shoud be.

            // This code tries to mitigate this issue by also looking at the surrounding pixels
            // That way, if the pixel targeted is an artefact resulting from antialiasing
            // this will be detected (because the pixel color is unknown) and we will look
            // at the pixels around it to find the closest in value that matches a known zValue

            // In the (very) rare occasions that antialiasing created a plausible color, well, there is not much we can do
            // and it will result in a random element being selected
            var colorDiff = 0;
            for (var i = 0; i < zbufferData.data.length; i += 4) {
                var val = this.rgbToZValue(zbufferData.data[i], zbufferData.data[i + 1], zbufferData.data[i + 2]);
                var cmd = this.zValueToCommand(val);

                if (cmd !== null) {
                    // We found a surrounding pixel that matches a known zValue!
                    // If there is multiple candidates, we pick the one with the closest color
                    var deltaColor = this.getColorDistance(centralVal, val);
                    if (deltaColor < colorDiff || selectedCmd === null) {
                        selectedCmd = cmd;
                        colorDiff = deltaColor;
                    }
                }
            }
        }

        return selectedCmd;
    }

    onGlobalMouseUp(event : MouseEvent) : void {
        if (event.button === 0) {
            this.isMouseDown = false;
        }
    }

    onMouseUp(event : MouseEvent) : void {
        if (event.button === 0) {
            // Only accept selections sarted in the canvas
            if (this.isMouseDown && !this.state.isPanning) {
                if (this.hoveredCmdsIdx.length > 0) {
                    // Shapes hovered are now selected
                    this.props.getDraggableSelection().addShapesIdx(this.hoveredCmdsIdx, event.shiftKey && this.hoveredCmdsIdx.length === 1); // We only invert the selection for single selection to make sure it was not a mistake
                } else if (!event.shiftKey) { // Do not clear the selection if using shift
                    this.props.getDraggableSelection().clearShapes();
                }
                this.redraw();
            }
            this.isMouseDown = false;
        }
    }

    onMouseDown(event : MouseEvent) : void {
        if (event.button === 0) {
            if (!this.state.isPanning && !event.shiftKey) { // Shift allows to select multiple elements
                // We are starting a new selection so we should reset the current one
                this.props.getDraggableSelection().clearShapes();
            }
            
            // Start a new selection
            const transform = !this.state.isPanning;
            var pos = this.eventToMousePos(event, transform, transform);
            this.startPt = pos;
            this.endPt = pos;
            this.isMouseDown = true;
        }
    }  

    onMouseMove(event : MouseEvent) : void {
        const transform = !this.state.isPanning;
        var pos = this.eventToMousePos(event, transform, transform);
        this.props.onMouseMoved({x: pos.x + this.props.chart.rect.x, y: pos.y + this.props.chart.rect.y});

        if (this.isMouseDown) {
            if (this.state.isPanning) { 
                const dx = this.endPt.x - pos.x;
                const dy = this.endPt.y - pos.y;
                const scale = this.getEffectiveScale(this.viewTransform);
                this.setTmpTransform(this.viewTransform.translate(-dx/scale.x, -dy/scale.y));
                this.startPt = pos;
                this.endPt = pos; 
                this.setState({isCentered: false}); // We modified the pos, we shouldn't autonatically resize anymore
            } else {
                // This is a dragging selection
                // We should select the shapes contained in the selection rectangle
                var shapes = this.props.chart.shapes;
                this.endPt = pos;
                // Get all the selected shapes
                var sx = Math.min(this.startPt.x, this.endPt.x);
                var sy = Math.min(this.startPt.y, this.endPt.y);
                var w = Math.abs(this.endPt.x - this.startPt.x);
                var h = Math.abs(this.endPt.y - this.startPt.y);

                if (w > 2 && h > 2) { // Give some loose so that one-click selection works even if there is small movements
                    var selectRect = { x: sx+this.props.chart.rect.x, y: sy+this.props.chart.rect.y, width: w, height: h };
                    this.hoveredCmdsIdx = [];
                    for (var i = 0; i < shapes.length; ++i) {
                        if (shapes[i].isContained(selectRect)) {
                            var isGhost = this.props.ghostShapes.includes(shapes[i]);
                            if (!isGhost) { // Only select if it is not a ghost
                                this.hoveredCmdsIdx.push(i);
                            }
                        }
                    }
                }
            }
            
            this.redraw();
        } else {
            var mousePos = this.eventToMousePos(event, false, true);
            var cmd = this.getCommandAtPos(mousePos.x, mousePos.y);

            if (cmd !== null) {
                if (this.hoveredCmdsIdx.length !== 1 || this.hoveredCmdsIdx[0] !== cmd.idx) {
                    this.hoveredCmdsIdx = [cmd.idx];
                    this.redraw();
                }
            } else if (this.hoveredCmdsIdx.length > 0) {
                this.hoveredCmdsIdx = [];
                this.redraw();
            }
        }
    }

    onMouseLeave(event : MouseEvent) : void {
        if (this.hoveredCmdsIdx.length > 0) {
            this.hoveredCmdsIdx = [];
            this.redraw();
        }
    }

    zoom(scaleFactor : number, cx = -1, cy = -1) : void {
        if (cx === -1 && cy === -1) {
            const pt = this.transformPos(this.previousWidth/2, this.previousHeight/2, false, true);
            cx = pt.x;
            cy = pt.y;
        }

        const transfo = this.viewTransform.translate(cx, cy);
        transfo.scaleSelf(scaleFactor+1, scaleFactor+1);
        transfo.translateSelf(-cx, -cy);
        this.setTmpTransform(transfo);
        this.setState({isCentered: false}); // We modified the zooming, we shouldn't autonatically resize anymore
    }

    onMouseWheel(event : WheelEvent) : void {
        var pos = this.eventToMousePos(event, false, true);
        const sign = event.deltaY < 0? 1 : -1;
        const scaleFactor = Math.min(Math.abs(event.deltaY) * 0.01, 0.4) * sign;

        this.zoom(scaleFactor, pos.x, pos.y);
    }

    getEffectiveScale(matrix : DOMMatrix = null) : Point {
        const m = matrix === null? this.viewTransform.multiply(this.bufferTransform) : matrix;
        var E = (m.a + m.d) / 2
        var F = (m.a - m.d) / 2
        var G = (m.c + m.b) / 2
        var H = (m.c - m.b) / 2

        var Q = Math.sqrt(E * E + H * H);
        var R = Math.sqrt(F * F + G * G);

        return {x: Q+R, y: Q-R};
    }

    /**
     * Merge the bounding box of all the shapes to get the bounding box
     * @param {Array} shapes 
     */
    getShapesRect(shapes : ShapeCommand[]) : any {
        var topLeft = { x: shapes[0].rect.x, y: shapes[0].rect.y };
        var botRight = { x: topLeft.x + shapes[0].rect.width, y: topLeft.y + shapes[0].rect.height };

        for (var i = 1; i < shapes.length; ++i) {
            var rect = shapes[i].rect;
            topLeft.x = Math.min(topLeft.x, rect.x);
            topLeft.y = Math.min(topLeft.y, rect.y);

            botRight.x = Math.max(botRight.x, rect.x + rect.width);
            botRight.y = Math.max(botRight.y, rect.y + rect.height);
        }

        return { x: topLeft.x, y: topLeft.y, width: botRight.x - topLeft.x, height: botRight.y - topLeft.y };
    }

    refreshBuffers() : void {
        var canvas = document.getElementById("chartview-canvas") as HTMLCanvasElement;

        if (canvas !== undefined) {
            const scale = this.getEffectiveScale(this.bufferTransform);

            // Resize the buffers accordingly
            this.zbuffer.width = this.props.chart.rect.width*scale.x;
            this.zbuffer.height = this.props.chart.rect.height*scale.y;

            this.chartBuffer.width = this.props.chart.rect.width*scale.x;
            this.chartBuffer.height = this.props.chart.rect.height*scale.y;

            var ctx = this.chartBuffer.getContext('2d');
            var zctx = this.zbuffer.getContext('2d');

            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, this.chartBuffer.width, this.chartBuffer.height);
            zctx.clearRect(0, 0, this.zbuffer.width, this.zbuffer.height);

            var shapes = this.props.chart.shapes;

            if (shapes.length > 0) {
                ctx.save();
                zctx.save();

                
                ctx.setTransform(this.bufferTransform);
                ctx.translate(-this.props.chart.rect.x, -this.props.chart.rect.y) // We want the chart to start at 0,0 to fit within the buffer
                zctx.setTransform(ctx.getTransform());
                

                this.zIncrement = Math.floor(((256 * 256 * 256) - 1) / shapes.length);

                for (var i = 0; i < shapes.length; ++i) {
                    var isGhost = this.props.ghostShapes.includes(shapes[i]);

                    // Save the shape's style
                    var cmdStyle = {};
                    ShapeCommand.copyStyle(cmdStyle, shapes[i]);

                    // Draw on the ChartBuffer
                    if (isGhost) {
                        // Ghosts are translucent
                        shapes[i].globalAlpha = 0.2;
                        shapes[i].globalCompositeOperation = 'source-over';
                    }
                    shapes[i].draw(ctx);

                    // Draw on the ZBuffer
                    if (!isGhost) { // Ghost shoud not be selectable
                        // Use a custom color to differentiate shapes on the ZBuffer
                        var colValue = (this.zIncrement * i + 1).toString(16);
                        var zColor = '#000000'.slice(0, -colValue.length) + colValue;
                        shapes[i].fillStyle = zColor;
                        shapes[i].strokeStyle = zColor;
                        shapes[i].globalAlpha = 1.0; // Force the shape to be opaque, otherwise it messes up the Z-buffer
                        shapes[i].draw(zctx);
                    }

                    // Restore the shape's original style
                    ShapeCommand.copyStyle(shapes[i], cmdStyle);
                }
                ctx.restore();
                zctx.restore();
            }
        }
    }

    drawOverlay(ctx : CanvasRenderingContext2D) : void {
        var overlay = this.props.state.overlay
        if (overlay.points.length > 0) {
            ctx.save();
            const scale = this.getEffectiveScale(this.bufferTransform);
            ctx.setTransform(ctx.getTransform().multiply(this.bufferTransform));
            ctx.translate(-this.props.chart.rect.x, -this.props.chart.rect.y) // We want the chart to start at 0,0 to fit within the buffer
            const markWidth = 10;
            const markHeight = 10
            const thickness = 1*1/scale.x; // Thickness should be proportional with zooming level

            ctx.strokeStyle = this.overlayColor;
            ctx.lineWidth = thickness;
            ctx.fillStyle = this.overlayColor;

            if (overlay.type === OverlayType.CONNECTED) {
                ctx.beginPath();
                ctx.moveTo(overlay.points[0].x.pixel, overlay.points[0].y.pixel);
                for (let i = 1; i < overlay.points.length; ++i) {
                    ctx.lineTo(overlay.points[i].x.pixel, overlay.points[i].y.pixel);
                }
                ctx.stroke();
            } else if (overlay.type === OverlayType.HORIZONTAL_GRIDLINE) {
                ctx.beginPath();
                for (let i = 0; i < overlay.points.length; ++i) {
                    ctx.moveTo(this.props.chart.rect.x, overlay.points[i].y.pixel);
                    ctx.lineTo(this.props.chart.rect.x+this.props.chart.rect.width, overlay.points[i].y.pixel);
                } 
                ctx.stroke();
            } else if (overlay.type === OverlayType.VERTICAL_GRIDLINE) {
                ctx.beginPath();
                for (let i = 0; i < overlay.points.length; ++i) {
                    ctx.moveTo(overlay.points[i].x.pixel, this.props.chart.rect.y);
                    ctx.lineTo(overlay.points[i].x.pixel, this.props.chart.rect.y+this.props.chart.rect.height);
                } 
                ctx.stroke();
            } else {
                for (let i = 0; i < overlay.points.length; ++i) {
                    var coord : AxisCoordinate2D = overlay.points[i];
                    ctx.fillRect(coord.x.pixel - markWidth/2, coord.y.pixel-thickness/2, markWidth, thickness);
                    ctx.fillRect(coord.x.pixel - thickness/2, coord.y.pixel-markHeight/2, thickness, markHeight);
                }
            }
            ctx.restore();
        }
    }

    redraw() : void {
        var canvas = document.getElementById("chartview-canvas") as HTMLCanvasElement;

        if (canvas !== null) {
            if (this.viewTransformed && Date.now() - this.viewTransformedTime > 1000) {
                const mRes = this.viewTransform.multiply(this.bufferTransform);
                let scale = this.getEffectiveScale(mRes).x;

                // Most browsers support canvas up to 268,435,456pixels. But it gets really slow + sometines disappears (?)
                // So we arbitrarily fix the limit to 7,000,000 pixels. Beyond this, the zoom gets partially handled by the viewTransform (hence, lower res)
                const maxScale = 7000000 / (canvas.width*canvas.height);
                scale = Math.min(scale, maxScale);

                // Buffer should contain all the scaling info
                this.bufferTransform = new DOMMatrix();
                this.bufferTransform.scaleSelf(scale, scale);

                this.viewTransform = mRes.multiply(this.bufferTransform.inverse());
                this.viewTransformed = false;
                this.refreshBuffers();
            }
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = "white";
            ctx.resetTransform();
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.setTransform(this.viewTransform);
            ctx.drawImage(this.chartBuffer, 0, 0);
            var shapes = this.props.chart.shapes;
            var scale = this.getEffectiveScale(); // Return the scale factor

            // Draw the overlay, which highlights specific coordinates on the chart (used when selecting cells in the datatable)
            this.drawOverlay(ctx);

            if (shapes !== undefined && shapes.length > 0) {
                // Draw the selection on top of the chart
                ctx.save();
                ctx.setTransform(ctx.getTransform().multiply(this.bufferTransform));

                ctx.save();
                ctx.translate(-this.props.chart.rect.x, -this.props.chart.rect.y) // We want the chart to start at 0,0, like the buffer

                var draggableSelection = this.props.state.shapeSelection;

                var cmdsToHighlight = [];
                cmdsToHighlight = cmdsToHighlight.concat(this.hoveredCmdsIdx);

                if (!draggableSelection.isDragged && !draggableSelection.isHidden()) {
                    // Also highlight shapes in the draggable selection
                    cmdsToHighlight = cmdsToHighlight.concat(draggableSelection.shapesIdx);
                }
                

                for (var i = 0; i < cmdsToHighlight.length; ++i) {
                    var cmd : ShapeCommand = shapes[cmdsToHighlight[i]];
                    var cmdStyle = {};
                    ShapeCommand.copyStyle(cmdStyle, cmd);
                    var prevFilled = cmd.isFilled;
                    cmd.strokeStyle = "white";
                    if (cmd.isFilled) {
                        cmd.isFilled = false;
                        cmd.lineWidth = 1;
                    }
                    cmd.isFilled = false;
                    cmd.globalAlpha = 0.8;
                    cmd.globalCompositeOperation = 'source-over';

                    cmd.draw(ctx);

                    // Also draw the hitbox, so that the selected shape is obvious
                    var rect = cmd.rect;
                    ctx.lineWidth = 1.0/scale.x; // Divide by scale to make it independent from zooms
                    ctx.lineJoin = 'round';
                    ctx.setLineDash([cmd.lineWidth*4, cmd.lineWidth*3]);
                    ctx.lineDashOffset = this.offset;
                    ctx.strokeStyle =  this.selectionColor;
                    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

                    // Restore the style of the command
                    ShapeCommand.copyStyle(cmd, cmdStyle);
                    cmd.isFilled = prevFilled;
                }

                // Draw the selection rect untransformed
                ctx.restore()

                // Draw selection rect
                if (this.isMouseDown) {
                    ctx.fillStyle = this.selectionRectColor;
                    ctx.strokeStyle = this.selectionRectOutlineColor;
                    ctx.lineWidth = 2.0/scale.x; // Divide by scale to make it independent from zooms
                    ctx.globalAlpha = 1.0;
                    ctx.lineDashOffset = 0;
                    ctx.setLineDash([ctx.lineWidth, ctx.lineWidth]);
                    ctx.globalCompositeOperation = 'source-over';
                    var sx = this.startPt.x;
                    var sy = this.startPt.y;
                    var w = this.endPt.x - sx
                    var h = this.endPt.y - sy;
                    ctx.fillRect(sx, sy, w, h);
                    ctx.strokeRect(sx, sy, w, h);
                    ctx.setLineDash([]);
                }

                ctx.restore();
            }
        }
    }

    isCentered() {
        return this.state.isCentered;
    }

    center() {
        this.previousWidth = -1;// A dirty hack to force a redraw (otherwise, the code is optimized to only redraw when absolutely necessary, e.g., size changed)
        this.setState({isCentered: true});
    }

    resize() : void {
        var canvas = document.getElementById("chartview-canvas") as HTMLCanvasElement;
        // Size to the parent element
        var parentNode = canvas.parentNode as any;
        var offsetTop = parentNode.offsetTop-parentNode.parentElement.offsetTop;
        canvas.width = parentNode.clientWidth;
        canvas.height = parentNode.clientHeight-offsetTop;
        var chart = this.props.chart;

        if (canvas.width === this.previousWidth && canvas.height === this.previousHeight &&
             this.props.chart.shapes.length === this.previousShapeCount && this.props.ghostShapes.length === this.previousGhostCount) {
            this.redraw();
            return; // Avoid refreshing if not absolutely necessary (e.g., the size of the canvas changed)
        }

        this.previousWidth = canvas.width;
        this.previousHeight = canvas.height
        this.previousShapeCount = this.props.chart.shapes.length;
        this.previousGhostCount = this.props.ghostShapes.length;
        
        if (chart.shapes !== undefined && chart.shapes.length > 0 && this.state.isCentered) {
            // Update transformation accordingly
            var shapesRect = chart.rect;
            var sx = canvas.width / shapesRect.width;
            var sy = canvas.height / shapesRect.height;
            var scale = Math.min(sx, sy);
            // We change the viewTransform while keeping the bufferTransform
            // 1) Compute the matrice that we would like at the end
            const res = new DOMMatrix();
            res.scaleSelf(scale, scale);
            var tx = ((canvas.width - shapesRect.width*scale) / 2) / scale;//-shapesRect.x + ((canvas.width - shapesRect.width * scale) / 2) / scale;
            var ty = ((canvas.height - shapesRect.height*scale) / 2) / scale;//-shapesRect.y + ((canvas.height - shapesRect.height * scale) / 2) / scale;
            res.translateSelf(tx, ty);

            // 2) Compute viewTransform so that viewTransfom*bufferTransform = res
            const newViewTransfo = res.multiply(this.bufferTransform.inverse());
            this.setTmpTransform(newViewTransfo);

            this.updateDraggableSelection();
        }

        this.refreshBuffers();
    }

    setTmpTransform(transform : DOMMatrix) : void {
        this.viewTransformedTime = Date.now() + (this.viewTransformedTime === 0 ? -1001 : 0); // Force the transfo to be done immediately if it is the first call
        this.viewTransformed = true;
        this.viewTransform = transform;
        this.updateDraggableSelection();
    }

    updateDraggableSelection() : void {
        
        var canvas = document.getElementById("chartview-canvas") as HTMLCanvasElement;
        // Size to the parent element
        var parentNode = canvas.parentNode as any;

        // Draggable selections should match with the ChartView and scale with it
        var draggableSelection = this.props.getDraggableSelection();
        if (draggableSelection !== undefined) {
            draggableSelection.scale = this.getEffectiveScale();
            // Translate should take into account the position of the div + position of chart in the div
            var parentRect = parentNode.getBoundingClientRect()
            this.tmpPoint.x = 0; 
            this.tmpPoint.y = 0;
            this.tmpPoint.w = 1;
            this.tmpPoint = this.viewTransform.multiply(this.bufferTransform).transformPoint(this.tmpPoint);

            draggableSelection.translate = {x:  parentRect.x + this.tmpPoint.x - this.props.chart.rect.x*draggableSelection.scale.x, y: parentRect.y + this.tmpPoint.y - this.props.chart.rect.y*draggableSelection.scale.y};
            draggableSelection.forceUpdate();
        }
    }

    componentDidMount() : void {
        this.globalMouseUpListener = this.onGlobalMouseUp.bind(this);
        document.addEventListener('mouseup', this.globalMouseUpListener);
        // Refresh every 250ms to allow animations
        this.intervalId = window.setInterval(() => { this.offset += 2; this.redraw() }, 250);
        this.resize();
        this.updateDraggableSelection();
    }

    componentDidUpdate() : void {
        this.resize();
        this.updateDraggableSelection();
    }

    componentWillUnmount() : void {
        window.clearInterval(this.intervalId);
        document.removeEventListener('mouseup', this.globalMouseUpListener);
    }

    enterPanMode() : void {
        if (!this.state.isPanning) {
            this.setState({isPanning: true});
        }
    }

    exitPanMode() : void {
        this.setState({isPanning: false});
    }  

    render() : JSX.Element {
        return (<Fragment>
        <div style={{textAlign: 'right', marginRight: '2px'}}>
            <button style={{margin: '2px'}} className="button gray small" onMouseDown={(e) => e.preventDefault()} onClick={(event)=> this.zoom(0.1)}>
                <i className="fa fa-search-plus" aria-hidden="true"></i>
            </button>
            <button style={{margin: '2px'}} className="button gray small" onMouseDown={(e) => e.preventDefault()} onClick={(event)=> this.zoom(-0.1)}>
                <i className="fa fa-search-minus" aria-hidden="true"></i>
            </button>

            <button style={{margin: '2px'}} className={"button small " + (this.isCentered() ? "gray disabled" : "")} onMouseDown={(e) => e.preventDefault()} onClick={(event)=> this.center()}>
                <i className="fa fa-arrows-alt" aria-hidden="true"></i> Center & Fit
            </button>
        </div> 
            <div className="noselect" style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
                <canvas style={{cursor: this.state.isPanning ? 'grab' : 'crosshair'}} id='chartview-canvas'
                    onMouseDown={this.onMouseDown.bind(this) as any}
                    onMouseMove={this.onMouseMove.bind(this) as any}
                    onMouseUp={this.onMouseUp.bind(this) as any}
                    onMouseLeave={this.onMouseLeave.bind(this) as any}
                    onWheel={this.onMouseWheel.bind(this) as any}
                >Canvas not supported</canvas>
            </div>
        </Fragment>
        );
    }
}

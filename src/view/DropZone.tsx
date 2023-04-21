import React from 'react';
import ShapeCommand from '../datastructure/ShapeCommand';
import { Snackbar } from '../utils/Snackbar';
import {ChartExtractorState} from './ChartExtractor';

interface DropZoneProps {
    state : ChartExtractorState;
    setState : any;
    onShapesDropped : any;
    style : React.CSSProperties;
    text : string;
    isSelectionAccepted? : (shapes: ShapeCommand[]) => boolean; /* Disable the dropzone depending on the selection */
    recommendedDropCount? : number /* Dropzone is recommended up until a limited number of drops */
}

export enum DropZoneState {
    RECOMMENDED, /* Dropzone is always highlighted (when drag n drop is happening) */
    NEUTRAL, /* Dropzone is only highlighted when hovered */
    DISABLED /* Dropzone cannot be used + blocked on hover */
}

export const AcceptFilter = {
    TextOnly: (shapes : ShapeCommand[]) => {return shapes.some((s) => s.unicode !== undefined);},
    TextOrShape: (shapes : ShapeCommand[]) => {return shapes.length > 0;},
    ShapeOnly: (shapes : ShapeCommand[]) => {return shapes.every((s) => s.unicode === undefined);}
}

export default class DropZone extends React.Component<DropZoneProps, any> {
    dropCount: number;

    constructor(props) {
        super(props)
        this.dropCount = 0;
    }

    getSelectedShapes() : ShapeCommand[] {
        var shapes  = [];
        var shapesIdx = this.props.state.shapeSelection.shapesIdx;

        for (var i = 0; i < shapesIdx.length; ++i) {
            shapes.push(this.props.state.filteredShapes[shapesIdx[i]]);
        }
        return shapes;
    }

    getDropZoneState(shapes = undefined) : DropZoneState {
        const _shapes = shapes === undefined? this.getSelectedShapes() : shapes;

        if (!this.isSelectionValid(shapes)) {
            return DropZoneState.DISABLED;
        }

        if (this.props.recommendedDropCount !== undefined && this.dropCount >= this.props.recommendedDropCount) {
            return DropZoneState.NEUTRAL;
        }

        return DropZoneState.RECOMMENDED;
    }

    onMouseUp(event : MouseEvent) : void {
        var shapeSelection = this.props.state.shapeSelection;
        if (shapeSelection.isDragged) {
            // DraggableShapeSelection dropped in the zone
            const shapes = this.getSelectedShapes();
            if (this.isSelectionValid(shapes)) {
                if (this.props.onShapesDropped(shapes)) {
                    // Processing is successful, we clear the selection
                    this.dropCount += 1;
                    shapeSelection.clear();
                    this.props.setState({shapeSelection: shapeSelection});
                } else {
                    Snackbar.addWarningMessage("The selection could not be processed.");
                }
            } else {
                // We should give a brief explanation of why was the selection considered as invalid
                Snackbar.addWarningMessage(this.getSelectionInvalidReason());
            }
        }
    }

    getSelectionInvalidReason() : string {
        if (this.props.isSelectionAccepted === AcceptFilter.ShapeOnly) {
            return "The selection contains textual elements. You cannot drop textual elements in this dropzone.";
        }
        if (this.props.isSelectionAccepted === AcceptFilter.TextOnly) {
            return "The selection does not contain any textual element. This dropzone only accepts textual elements.";
        }
        return "You cannot drop these elements in this dropzone."
    }

    isSelectionValid(shapes = undefined) {
        if (this.props.isSelectionAccepted === undefined) {
            return true; // Always valid if no selection filter
        }

        // Convert the ShapeSelection to the list of shapes so that the filter can make sense of it.
        return this.props.isSelectionAccepted(shapes === undefined ? this.getSelectedShapes() : shapes);
    }

    render() : JSX.Element {
        if (!this.props.state.shapeSelection.isDragged) {
            // We only show the drop zone while the selection is dragged, and the selection is valid
            return null;
        }

        var className = "dropZone";
        const dropZoneState = this.getDropZoneState();

        if (dropZoneState === DropZoneState.DISABLED) {
            className += " disabledDropZone"
        }

        if (dropZoneState === DropZoneState.NEUTRAL) {
            className += " neutralDropZone"
        }

        return (<div className={className}
        onMouseUp={this.onMouseUp.bind(this) as any}
        style={this.props.style}
        ><div className='dropZoneLabel'>{this.props.text}</div></div>);
    }
}
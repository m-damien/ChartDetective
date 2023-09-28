import React, { Fragment } from 'react';
import TableWidget from './TableWidget';
import DropZone, { AcceptFilter } from '../DropZone';
import AxisExtractor from '../../utils/extractors/AxisExtractor';
import TextMerger from '../../utils/TextMerger';
import ShapeCommand from '../../datastructure/ShapeCommand';
import AxisCoordinate2D from '../../datastructure/AxisCoordinate2D';
import AxisCoordinate1D from '../../datastructure/AxisCoordinate1D';
import { OverlayType } from '../../datastructure/Overlay';
import UndoManager from '../../utils/UndoManager';
import { Interpolation } from '../../datastructure/chartelements/Axis';

/**
 * A widget to show a table representing an axis
 * Shapes can be dropped in the table to fill it.
 */
export default class AxisWidget extends TableWidget {
    constructor(props) {
        super(props);

        this.cellSelectedListener = this.onCellSelectedCallback.bind(this);
        this.cellEditedListener = this.onCellEditedCallback.bind(this);
    }

    getData() : string[][] {
        var data = [["Value"], ["Pixel"]];

        for (var i = 0; i < this.props.axis.ticks.length; ++i) {
            var tick = this.props.axis.ticks[i];
            data[1].push(tick.pixel);
            data[0].push(tick.value);
        }

        // Add at least two column so that the table doesn't look too small
        while (data[0].length <= 2) {
            data[0].push("");
            data[1].push("");
        }

        return data;
    }

    isCellSelectable(col : number, row : number) : boolean {
        return col > 0; // Cells on the first column cannot be edited because they are labels
    }

    isCellEditable(col : number, row : number) : boolean {
        return col > 0; // Cells on the first column cannot be edited because they are labels
    }

    getHeaders() : string[] {
        // No headers
        return null;
    }

    getFloatingHeader() : string {
        return this.props.axis.name;
    }


    onShapesDroppedOnTicks(shapes : ShapeCommand[]) : boolean {
        var extractor = new AxisExtractor(this.props.axis);
        UndoManager.get().addUndoRestorePoint();
        extractor.onShapesSelected(shapes, this.props.shapes, () => {this.cachedTable = null; this.updateDatatable();});
        return true;
    }

    updateDatatable() : void {
        this.props.setState({dataTable: this.props.state.dataTable});
    }

    onShapesDroppedOnTitle(shapes : ShapeCommand[]) : boolean {
        TextMerger.getTextFromShapes(shapes).then(value => {
            if (value === null) {
                alert("No text found in selection");
            }
            UndoManager.get().addUndoRestorePoint();
            this.props.axis.name = value;
            this.updateDatatable();
        });
        return true;
    }

    onClearButton(event : any) : void {
        UndoManager.get().addUndoRestorePoint();
        this.props.axis.clear();
        this.cachedTable = null;
        this.updateDatatable();
    }

    onInterpolationButton(event : any) : void {
        UndoManager.get().addUndoRestorePoint();
        this.props.axis._interpolation = this.props.axis.isCategorical() ? Interpolation.LINEAR : Interpolation.CATEGORICAL;
        this.updateDatatable();
    }

    getFloatingHeaderHTML() : JSX.Element {
        return(<div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div style={{left: '0%', width: '90%', top: '50%', transform: 'translate(0%, -50%)', position: 'absolute'}}>
                {this.getFloatingHeader()}
            </div>
            <div style={{right: 1, top: '50%', transform: 'translate(0%, -50%)', position: 'absolute'}}>
                <button style={{marginRight:3}} className="button small gray tooltip" onClick={this.onInterpolationButton.bind(this)}>{this.props.axis.getInterpolationName()}</button>
                <button className="button small gray tooltip" onClick={this.onClearButton.bind(this)}><i className="fa fa-trash" aria-hidden="true"></i></button>
            </div>
            <DropZone
                isSelectionAccepted={AcceptFilter.TextOnly}
                recommendedDropCount={1}
                state={this.props.state}
                setState={this.props.setState}
                style={{width: '100%', height: '100%', position: 'absolute', top: 0, left: 0}}
                text=""
                onShapesDropped={this.onShapesDroppedOnTitle.bind(this)}
            />
        </div>)
    }

    onCellSelectedCallback(col : number, row : number) : void {
        // Update the overlay
        this.props.state.overlay.clear();
        this.props.state.overlay.type = OverlayType.VERTICAL_GRIDLINE;
        if (col >= 1 && col-1 < this.props.axis.ticks.length) { // Row titles cannot be edited
            var tick = this.props.axis.ticks[col-1];
            const coordFix = new AxisCoordinate1D(tick.pixel, this.props.axis);
            const coordA = new AxisCoordinate1D(0, this.props.axis);

            if (this.props.axis.isHorizontal()) {
                this.props.state.overlay.points.push(new AxisCoordinate2D(coordFix, coordA));
            } else {
                this.props.state.overlay.type = OverlayType.HORIZONTAL_GRIDLINE;
                this.props.state.overlay.points.push(new AxisCoordinate2D(coordA, coordFix));
            }
        }
        
        this.updateDatatable();
    }

    onCellEditedCallback(col : number, row : number, newVal : string) : void {
        if (col >= 1) { // Row titles cannot be edited
            UndoManager.get().addUndoRestorePoint();
            if (col > this.props.axis.ticks.length) {
                // If the tick does not exist, we add one
                this.props.axis.addTickValue(newVal, parseFloat(newVal));
            } else {
                var tick = this.props.axis.ticks[col-1];
                if (row == 0) {
                    tick.value = newVal;
                } else {
                    tick.pixel = parseFloat(newVal)
                }
            }
        }
    }

    getCellStyle(col : number, row : number) {
        if (col === 0) {
            return {backgroundColor: "#f0f0f0", textAlign: "center"};
        }
        return super.getCellStyle(col, row);
    }

    getGridOverlay(): JSX.Element {
        // We modify the table to also add dropzones
        this.cachedTable = null;
        return (<Fragment>
            {super.getGridOverlay()}
            {/* Dropzone for the data */}
            <DropZone
                recommendedDropCount={1}
                isSelectionAccepted={AcceptFilter.TextOrShape} // Could use OCR if necessary
                state={this.props.state}
                setState={this.props.setState}
                style={{width: this.getWidth()-2, height: 42, position: 'absolute', top: 0, left: 0}}
                text=""
                onShapesDropped={this.onShapesDroppedOnTicks.bind(this)}
            /></Fragment>);
    }

}
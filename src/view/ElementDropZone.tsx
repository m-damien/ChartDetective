import React, { MouseEvent } from 'react';
import ChartElement, { ChartElementType } from '../datastructure/chartelements/ChartElement';
import ShapeCommand from '../datastructure/ShapeCommand';
import { ExtractorUtils } from '../utils/extractors/ExtractorUtils';
import { Snackbar } from '../utils/Snackbar';
import UndoManager from '../utils/UndoManager';
import {ChartExtractorState} from './ChartExtractor';
import DropZone, { AcceptFilter } from './DropZone';

interface ElementDropZoneProps {
    color : string;
    imgFile : string;
    state : ChartExtractorState;
    setState : any;
    type : ChartElementType
    shapes : ShapeCommand[];
}


export default class ElementDropZone extends React.Component<ElementDropZoneProps, any> {
    constructor(props) {
        super(props)
    }

    onShapesDroppedOnNewSerie(type : ChartElementType, shapes : ShapeCommand) : boolean {
        const name = ExtractorUtils.chartTypeToString(type) + " " + (this.props.state.dataTable.series.length+1);

        // Create a new serie with the shapes
        var element = new ChartElement(type, name);

        // Use the right extractor to extract the data from the shape
        var extractor = ExtractorUtils.getSerieExtractor(element, this.props.state.dataTable);
        if (extractor !== null) {
            UndoManager.get().addUndoRestorePoint();
            this.props.state.dataTable.series.push(element);
            extractor.onShapesSelected(shapes, this.props.shapes);
            this.props.setState({dataTable: this.props.state.dataTable}); // Force refresh
            return true;
        }


        return false;
    }

    onMouseClick(event : MouseEvent) : void {
        Snackbar.addInfoMessage("Drag chart elements (lines, bars...) and drop them in the appropriate drop zone.", "animations/element_dragndrop.gif");
    }

    render() : JSX.Element {
        const text = ExtractorUtils.chartTypeToString(this.props.type);
        return (
        <div className="chartElementBtn" style={{textAlign: 'center'}} onClick={this.onMouseClick.bind(this)}>
            <div style={{position: 'relative'}}>
                <div className="coloredRect" style={{margin: 'auto', width: 65, position: 'relative', backgroundColor: this.props.color, 
                        borderRadius: 5, border: '2px solid '+this.props.color, boxSizing: 'border-box'}}>
                    <img alt={text} src={this.props.imgFile}/><br/>
                </div>

                <DropZone
                    isSelectionAccepted={AcceptFilter.ShapeOnly}
                    state={this.props.state}
                    setState={this.props.setState}
                    style={{ width: '100%', height: "100%", position: 'absolute', top: 0, left: 0 }}
                    text=""
                    onShapesDropped={(shapes) => {return this.onShapesDroppedOnNewSerie(this.props.type, shapes)}}
                    key={text}
                />
            </div>
            <span>{text}</span>
        </div>);
    }
}
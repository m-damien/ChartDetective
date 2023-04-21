import Axis from "../../datastructure/chartelements/Axis";
import ShapeCommand from "../../datastructure/ShapeCommand";
import { Snackbar } from "../Snackbar";
import TextMerger from "../TextMerger";
import { TextChunk } from "../TextMerger";
import ShapeUtils from "../ShapeUtils";

export default class AxisExtractor {
    axis: Axis;

    constructor(axis : Axis) {
        this.axis = axis;
    }

    getAccurateTickPos(labelShape : TextChunk, shapes : ShapeCommand[]) : number {
        // The selection might contain tick marks / gridlines (i.e., a line that helps see were the label is postionned)
        // We try to extract these marks because they are often the most accurate depiction of the position
        for (const mainShape of shapes) {
            const subShapes = ShapeUtils.splitIntoSubShapes(mainShape); // Sometimes, the gridlines are grouped (e.g., excel)
            for (const shape of subShapes) {
                if (shape.text === undefined && shape.path.length <= 3) { // Only consider shapes that are lines and not words
                    let distFromLabel =  labelShape.rect.y - (shape.rect.y + shape.rect.height);
                    if (this.axis.isVertical()) {
                        distFromLabel = shape.rect.x - (labelShape.rect.x+labelShape.rect.width);
                    }
                    
                    // The mark has to start AFTER the label (ideally, immediately after)
                    if (distFromLabel < 0 || distFromLabel > labelShape.rect.width*4) { // We use the label width to have a value that is proportional to the chart 
                        continue;
                    }
    
                    let labelLowerBound = labelShape.rect.x
                    let labelUpperBound = labelShape.rect.x + labelShape.rect.width;
                    let shapeLowerBound = shape.rect.x
                    let shapeUpperBound = shape.rect.x + shape.rect.width;
    
                    if (this.axis.isVertical()) {
                        labelLowerBound = labelShape.rect.y
                        labelUpperBound = labelShape.rect.y + labelShape.rect.height;
                        shapeLowerBound = shape.rect.y
                        shapeUpperBound = shape.rect.y + shape.rect.height;
                    }

                    const pos = shapeLowerBound + (shapeUpperBound-shapeLowerBound)/2.0;
                    if (pos > labelLowerBound && pos < labelUpperBound) {
                        return pos;
                    }
                }
            }
        }

        // If we cannot find any marks or gridlines, we just use the middle of the label
        return this.axis.isVertical() ? labelShape.rect.y + labelShape.rect.height/2 :  labelShape.rect.x + labelShape.rect.width/2;
    }

    /**
     * Clean-up the tick label to make sure it will be properly understood as a number
     * @param tickLabel 
     */
    cleanTickLabel(tickLabel : string) : string {
        return tickLabel.replace("−", "-"); // This is a different character and javascript does not see it as a valid minus symbol
    }

    isNumber(tickLabel : string) : boolean {
        return !isNaN(tickLabel as any);
    }

    onShapesSelected(selectedShapes : ShapeCommand[], allShapes : ShapeCommand[] = []) : void {
        TextMerger.getTextsFromShapes(selectedShapes).then (texts => {
            if (texts === null) {
                alert("No text found in selection");
                return;
            }
    
            // We look for axis labels
            const numberedTicks = [];
            const stringTicks = [];
            for (var lineId = 0; lineId < texts.length; ++lineId) {
                for (var wordId = 0; wordId < texts[lineId].length; ++wordId) {
                    var word = texts[lineId][wordId];
    
                    const position = this.getAccurateTickPos(word, allShapes);
                    const label = this.cleanTickLabel(word.text);
    
                    if (label.trim().length > 0) {
                        if (this.isNumber(label)) {
                            numberedTicks.push({label: label, position: position});
                        } else {
                            stringTicks.push({label: label, position: position});
                        }
                    }
                }
            }
            let ticks = [];
            // If more than half the ticks are numbered, then we assume the rest was a mistake and do not include them
            if (stringTicks.length > 0 && numberedTicks.length / (numberedTicks.length + stringTicks.length) > 0.5) {
                ticks = ticks.concat(numberedTicks);
                Snackbar.addWarningMessage("Tick(s) '" + stringTicks.map((e) => {return e.label}).join(", ") + 
                        "' could not be parsed as numbers and were excluded from the selection.")
            } else {
                // All ticks are of mostly the same type, no conflict
                ticks = ticks.concat(numberedTicks);
                ticks = ticks.concat(stringTicks);
            }
    
            for (const tick of ticks) {
                this.axis.addTickValue(tick.label, tick.position);
            }
            
    
            // Link the axis with the shapes
            // TODO: Remove unused shapes
            this.axis.shapes = this.axis.shapes.concat(selectedShapes);
        });
    }

    get element() : Axis {
        return this.axis;
    }
}

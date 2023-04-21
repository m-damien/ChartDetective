import ChartElement from "../../datastructure/chartelements/ChartElement";
import ShapeCommand from "../../datastructure/ShapeCommand";
import TextMerger from "../TextMerger";

export default class LegendExtractor {
    element: ChartElement;

    constructor(element : ChartElement) {
        this.element = element;
    }

    onShapesSelected(shapes : ShapeCommand[]) : void {
        // Algorithm to figure out the name of the legend associated with an element
        // The algorithm looks for elements that match the series' characteristic (either color or shape)
        // And then reads the text on its right. Should work in most cases.

        // First, we get all the texts in the image
        const textShapes : ShapeCommand[] = []
        for (var i = 0; i < shapes.length; ++i) {
            if (shapes[i].text !== undefined) {
                var shape = shapes[i];
                textShapes.push(shape);
            }
        }

        // Second, find a line with the same color and extract the text at its right
        const mainColor = this.element.getMainColor();
        let candidateLegendShape = null;
        let candidateLegend = [];
        for (const shape of shapes) {
            // TODO: Implement shape matching too
            if (!this.element.shapes.includes(shape) && shape.strokeStyle === mainColor && shape.text === undefined) {
                if (candidateLegendShape !== null && shape.rect.width*shape.rect.height > candidateLegendShape.rect.width*candidateLegendShape.rect.height) {
                    continue; // If we already have a candidate legend, we only consider new legends if they are smaller
                }
                // We found a line with the same characteristics, let's look for text on its right
                const candidateTextShapes = [];
                for (const textShape of textShapes) {
                    const dy = Math.abs((shape.rect.y+shape.rect.height/2)-(textShape.rect.y+textShape.rect.height/2));
                    if (textShape.rect.x > shape.rect.x + shape.rect.width && dy < textShape.rect.height) {
                        candidateTextShapes.push(textShape);
                    }
                }

                if (candidateTextShapes.length > 0) {
                    const text = TextMerger.getTextsFromTextShapes(candidateTextShapes)
                    for (const line of text) {
                        let startX = shape.rect.x + shape.rect.width;
                        for (const word of line) {
                            const dx = (word.rect.x - startX);
                            if (dx < (word.rect.width/word.text.length)*2) {
                                if (candidateLegendShape !== shape) {
                                    candidateLegendShape = shape;
                                    candidateLegend = [];
                                }
                                candidateLegend.push(word.text);
                                startX = word.rect.x + word.rect.width;
                            }
                        }
                    }
                }
            }
        }

        if (candidateLegend.length > 0) {
            // We found the legend! We can rename the element
            this.element.name = candidateLegend.join(" ");
        }
    }
}

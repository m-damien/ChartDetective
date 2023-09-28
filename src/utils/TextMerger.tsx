import Rectangle from "../datastructure/Rectangle";
import ShapeCommand from "../datastructure/ShapeCommand";
import Tesseract from 'tesseract.js';

/**
 * A utility class that takes shapes and convert them to text, forming words (given that the selection include some 'Character' shapes).
 * Words are formed based on the positon and angle of the letters.
 * This class is still relatively basic, if needed, future improvements could include:
 * - Exploiting the already formed "chunks" of letters in the PDF (right now, letters are considered individually).
 * - Properly handling selections with letters using different angles (not sure what 'properly' would mean here).
 */
export default class TextMerger {
    /**
     * Make sense of shapes and try to form lines and words
     * Also works for text that is rendered
     * @param {[ShapeCommand]} shapes 
     */
    static getTextsFromShapes(shapes : ShapeCommand[], tryOCR = true) : Promise<TextChunk[][]> {
        return new Promise((resolve, reject) => {
            const result = TextMerger.getTextsFromTextShapes(shapes)

            if (result === null && tryOCR) {
                // No letters found, we try parsing the text instead
                TextMerger.parseRenderedText(shapes).then((chunks) => {
                    if (chunks.length > 0) resolve(TextMerger._chunksToLines(chunks));
                })
            } else {
                resolve(result)
            }
        });
    }

    /**
     * Make sense of "text" shapes and try to form lines and words
     * @param shapes 
     * @returns 
     */
    static getTextsFromTextShapes(shapes : ShapeCommand[]) : TextChunk[][] {
        // First, we filter everything that is not text
        var letterShapes : TextChunk[] = [];

        for (var i = 0; i < shapes.length; ++i) {
            if (shapes[i].text !== undefined) {
                var shape = shapes[i];
                letterShapes.push(new TextChunk(shape));
            }
        }

        if (letterShapes.length === 0) {
            return null;
        }

        return TextMerger._chunksToLines(letterShapes)
    }

    /**
     * Form a 2D list of text chunks based on the spacings between letters
     * @param letterShapes 
     * @returns 
     */
    static _chunksToLines(letterShapes : TextChunk[]) : TextChunk[][] {
        // Second, we sort the letters based on their position (using their aligned bounding boxes)
        letterShapes = letterShapes.sort(function(a, b) {
            return a.alignedRect.x - b.alignedRect.x;
        });

        // Third, we seperate the text into lines (if the text is on different lines)
        var lines = [new TextLine(letterShapes[0])]; // Always at least one line
        for (let i = 1; i < letterShapes.length; ++i) {
            var chunk = letterShapes[i];
            // Test if the chunk belongs to any existing line
            var line : TextLine = null;
            for (var j = 0; j < lines.length; ++j) {
                if (lines[j].isOnLine(chunk)) {
                    line = lines[j];
                    break;
                }
            }
            
            if (line === null) {
                // If not, this chunk is forming a new line
                line = new TextLine(chunk);
                lines.push(line);
            } else {
                line.addTextChunk(chunk);
            }
        }

        // Fourth, sort the lines by their y position
        lines = lines.sort(function(a, b) {
            return a.alignedRect.y - b.alignedRect.y;
        });

        // Fourth, form the 2D table of line/words
        var text = [];
        lines.forEach(l => {
            text.push(l.getWords());
        })

        return text;
    }

    /**
     * Parse text using OCR. Only for rendered text.
     */
    static parseRenderedText(shapes : ShapeCommand[]) : Promise<TextChunk[]> {

        if (shapes.length > 0) {
            const rect = new Rectangle(shapes[0].rect.x, shapes[0].rect.y, shapes[0].rect.width, shapes[0].rect.height);

            for (const shape of shapes) {
                rect.add(new Rectangle(shape.rect.x, shape.rect.y, shape.rect.width, shape.rect.height))
            }

            var tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = rect.width;
            tmpCanvas.height = rect.height;

            var ctx = tmpCanvas.getContext('2d');
            ctx.translate(-rect.x, -rect.y)
            for (const shape of shapes) {
                shape.draw(ctx);
            }
            ctx.translate(rect.x, rect.y)
            
            return new Promise((resolve, reject) => {
                Tesseract.recognize(tmpCanvas, 'eng', { /*logger: m => console.log(m)*/ }).then((text) => {
                    const chunks : TextChunk[] = [];
                    for (const symbol of text.data.symbols) {
                        const textChunk = new TextChunk(null, symbol.text, new Rectangle(symbol.bbox.x0+rect.x,
                             symbol.bbox.y0+rect.y, 
                             symbol.bbox.x1-symbol.bbox.x0, 
                             symbol.bbox.y1-symbol.bbox.y0
                            ))
                        chunks.push(textChunk)
                    }
    
                    resolve(chunks)
                })
            });
        }
    }

    /**
     * Make sense of shapes and returns a single string (with spaces between words, and \n between lines)
     * @param shapes 
     */
    static getTextFromShapes(shapes : ShapeCommand[], wordSeparator=" ", lineSeparator="\n") : Promise<string> {
        return new Promise((resolve, reject) => {
            TextMerger.getTextsFromShapes(shapes).then((texts) => {
                resolve(texts.map(line => {
                    return line.map(chunk => chunk.text).join(wordSeparator)
                }).join(lineSeparator));
            });
        });
    }
}

export class TextChunk {
    text : string;
    rect : Rectangle;
    alignedRect : Rectangle;

    constructor(shape : ShapeCommand, unicode : string = null, rect : Rectangle = null) {
        if (shape) {
            this.text = shape.unicode;
            this.rect = new Rectangle(shape.rect.x, shape.rect.y, shape.rect.width, shape.rect.height);
            this.alignedRect = this.getAlignedBounds(shape);
        } else {
            this.text = unicode;
            this.alignedRect = this.rect = rect;
        }
    }

    /**
     * 
     * @returns The average width of the letter composing the chunk
     */
    getLetterWidth() {
        return this.alignedRect.width / this.text.length;
    }

    /**
     * Exracts the rotation angle from a shape
     * @param {ShapeCommand} shape 
     * @returns {Number} the angle in radians
     */
    extractAngle(shape : ShapeCommand) : number {
        // We apply the transform and then measure the angle
        var p0 = shape.transformPos(0, 0);
        var p1 = shape.transformPos(1, 0);
        var dx = p1.x - p0.x;
        var dy = p1.y - p0.y;
        return Math.atan2(dy, dx);
    }
    
    /**
     * Compute the aligned bouding box (i.e. not oriented)
     * @param {ShapeCommand} shape 
     * @returns {Rectangle} 
     */
    getAlignedBounds(shape : ShapeCommand) : Rectangle {
        var bounds = shape.rect;
        var angle = this.extractAngle(shape);
        
		if (angle === 0) {
			return new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
        }
        
        var transfo = new DOMMatrix();
        transfo = transfo.rotateSelf(-angle * (180/Math.PI)); // rotateSelf takes degrees
        
		var ptA = new DOMPoint(bounds.x, bounds.y);
		var ptB = new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height);
		
		var ptDestA = ptA.matrixTransform(transfo);
        var ptDestB = ptB.matrixTransform(transfo);
        
		var ox = Math.min(ptDestA.x, ptDestB.x);
		var oy = Math.min(ptDestA.y, ptDestB.y);
		var width = Math.abs(ptDestA.x - ptDestB.x);
		var height = Math.abs(ptDestA.y - ptDestB.y);
		
		return new Rectangle(ox, oy, width, height);
    }

    add(chunk : TextChunk) : void {
        this.text += chunk.text;
        this.alignedRect.add(chunk.alignedRect);
        this.rect.add(chunk.rect);
    }
}

class TextLine {
    textChunks : TextChunk[];
    alignedRect : Rectangle;
    _totalAvgLetterWidth : number;

    constructor(initialChunk : TextChunk) {
        this.textChunks = [initialChunk];
        this.alignedRect = initialChunk.alignedRect.clone();
        this._totalAvgLetterWidth = initialChunk.getLetterWidth();
    }

    addTextChunk(chunk : TextChunk) : void {
        this.textChunks.push(chunk);
        this.alignedRect.add(chunk.alignedRect);
        this._totalAvgLetterWidth += chunk.getLetterWidth();
    }

    /**
     * Test if a TextChunk is on this line
     * @param chunk the chunk that is being tested
     * @returns True if the TextChunk belongs to the line
     */
    isOnLine(chunk : TextChunk) : boolean {
        // Belongs to the line if there is a height overlap
        var a = chunk.alignedRect.sy;
        var b = chunk.alignedRect.ey;
        var c = this.alignedRect.sy;
        var d = this.alignedRect.ey;
        return  Math.max(0, Math.min(b, d) - Math.max(a, c)) !== 0;
    }

    getWords() {
        var avgLetterWidth = this._totalAvgLetterWidth / this.textChunks.length;

        // We split everytime the space between two letter is more than the width of an average letter
        var words = [this.textChunks[0]];

        for (var i = 1; i < this.textChunks.length; ++i) {
            var chunk = this.textChunks[i];
            var lastChunk = words[words.length-1];
            var space = chunk.alignedRect.sx - lastChunk.alignedRect.ex;
            if (space >= avgLetterWidth) {
                words.push(chunk);
            } else {
                lastChunk.add(chunk);
            }
        }

        return words;
    }
}
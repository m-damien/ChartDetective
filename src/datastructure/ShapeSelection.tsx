export default class ShapeSelection {
    rect : any;
    shapesIdx : number[];
    isDragged : boolean;

    constructor() {
        this.rect = null;
        this.shapesIdx = [];
        this.isDragged = false;
    }

    clone() : ShapeSelection {
        var copy = new ShapeSelection();
        copy.rect = {x: this.rect.x, y: this.rect.y, width: this.rect.width, height: this.rect.height};
        copy.shapesIdx = [].concat(this.shapesIdx);

        return copy;
    }

    isHidden() : boolean {
        return this.rect === null;
    }

    clear() : void {
        this.rect = null;
        this.isDragged = false;
        this.shapesIdx = [];
    }
}
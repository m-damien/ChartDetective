export default class Rectangle {
    sx : number;
    sy : number;
    ex : number;
    ey : number;

    constructor(x : number, y : number, width : number, height : number) {
        this.sx = x;
        this.sy = y;
        this.ex = x + width;
        this.ey = y + height;
    }

    get x() : number {
        return this.sx;
    }

    set x(v : number) {
        var width = this.width;
        this.sx = v;
        this.ex = v+width;
    }

    get y() : number {
        return this.sy;
    }

    set y(v : number) {
        var height = this.height;
        this.sy = v;
        this.ey = v+height;
    }

    get width() : number {
        return this.ex - this.sx;
    }

    get height() : number {
        return this.ey - this.sy;
    }

    add(rect : Rectangle) : void {
        this.sx = Math.min(this.sx, rect.sx);
        this.sy = Math.min(this.sy, rect.sy);
        this.ex = Math.max(this.ex, rect.ex);
        this.ey = Math.max(this.ey, rect.ey);
    }

    clone() : Rectangle {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }
}
import AxisCoordinate2D from "./AxisCoordinate2D";

export enum OverlayType {
    MARKS,
    CONNECTED,
    HORIZONTAL_GRIDLINE,
    VERTICAL_GRIDLINE
}

export default class Overlay {
    points : AxisCoordinate2D[];
    type : OverlayType;

    constructor() {
        this.points = []
        this.type = OverlayType.MARKS;
    }

    clone() : Overlay {
        var copy = new Overlay();
        copy.type = this.type;
        copy.points = [].concat(this.points);

        return copy;
    }

    clear() : void {
        this.type = OverlayType.MARKS;
        this.points = [];
    }
}
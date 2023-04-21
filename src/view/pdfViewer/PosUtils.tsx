import Rectangle from "../../datastructure/Rectangle";

/**
 * Class utils to convert a set of coordinates from one space to another.
 * 
 * Different spaces:
 * - Shape coordinates: coordinates of the ShapeCommand
 * - Viewer coordinates: coordinates of the dom element in the viewer
 */
class _PosUtils {
    getDPI() {
        if (window.devicePixelRatio) {
            return window.devicePixelRatio
        }
        return 1;
    }

    getPageViewerRect(page : number) : Rectangle {
        const PDFViewerApplication = window['PDFViewerApplication'];
        const pageView = PDFViewerApplication.pdfViewer.getPageView(page);
        if (pageView) {
            const pageDiv = PDFViewerApplication.pdfViewer.getPageView(page).div;
            const margin = 9; // Page divs have a 9 pixel margin (see css)
    
            return new Rectangle(pageDiv.offsetLeft+margin, pageDiv.offsetTop+margin, pageDiv.offsetWidth, pageDiv.offsetHeight)
        }
        return new Rectangle(0, 0, 0, 0);
    }

    shapeToViewerCoord(page : number, x : number, y : number, width : number, height : number, pageRect : Rectangle = undefined) : Rectangle {
        const _pageRect = pageRect? pageRect : this.getPageViewerRect(page);
        return new Rectangle(x/PosUtils.getDPI()+_pageRect.x, y/PosUtils.getDPI()+_pageRect.y, width/PosUtils.getDPI(), height/PosUtils.getDPI()); // For some reason (rendering quality?) the canvas is always twice as big as the div
    }

    viewerToShapeCoord(page : number, x : number, y : number, width : number, height : number) : Rectangle {
        const pageRect = this.getPageViewerRect(page);
        return new Rectangle((x-pageRect.x)*PosUtils.getDPI(), (y-pageRect.y)*PosUtils.getDPI(), width*PosUtils.getDPI(), height*PosUtils.getDPI());
    }
}


export const PosUtils = new _PosUtils();
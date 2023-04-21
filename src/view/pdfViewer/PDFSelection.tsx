import React, { useState } from 'react';

import Rectangle from '../../datastructure/Rectangle';
import ShapeCommand from '../../datastructure/ShapeCommand';
import { PosUtils } from './PosUtils';

export const PDFSelection = ({children, onShapesSelected}) => {
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0, page: 0, onText: false});
  const [endPos, setEndPos] = useState({ x: 0, y: 0 });


  function getPageFromMouseEvent(mouseEvent) {
    let pageDiv = mouseEvent.target;
    while (pageDiv !== null) {
      if (pageDiv.className === "page") {
        return pageDiv;
      }

      pageDiv = pageDiv.parentElement;
    }

    return null;
  }

  function onMouseDownPage(event) {
    if (event.target.tagName === "BUTTON") {
      // Those should not be considered as to not break exisiting mechanisms
      return;
    }
    if (event.buttons === 1) { // Click on the page
      const pageDiv = getPageFromMouseEvent(event);
      if (pageDiv !== null) {
        setIsSelecting(true);
        const pageRect = PosUtils.getPageViewerRect(pageDiv.dataset.pageNumber-1);
        const vy = event.clientY - pageDiv.getBoundingClientRect().top-9+pageRect.y;
        const vx = event.clientX - pageDiv.getBoundingClientRect().left-9+pageRect.x;
        const startPos = { x: vx, y: vy, page: pageDiv.dataset.pageNumber-1, onText: event.target.tagName === "SPAN" };
        const endPos = { x: vx, y: vy}
        setEndPos(endPos);
        setStartPos(startPos);
      }
    }
  }

  function onMouseMovePage(event) {
    const pageDiv = getPageFromMouseEvent(event);
    if (event.buttons === 1 && isSelecting) {
      const pageRect = PosUtils.getPageViewerRect(startPos.page);
      const PDFViewerApplication = window['PDFViewerApplication'];
      const pageDiv = PDFViewerApplication.pdfViewer.getPageView(startPos.page).div

      const vy = event.clientY - pageDiv.getBoundingClientRect().top-9+pageRect.y;
      const vx = event.clientX - pageDiv.getBoundingClientRect().left-9+pageRect.x;
      const endPos = { x: vx, y: vy};
      setEndPos(endPos);
    }
  }

  //let lastSelection = null;
  function onMouseUpPage(event) {
    if (event.button === 0) {
      setIsSelecting(false);
      const selection = getSelection();
      onShapesSelected(selection.shapes, selection.rect);
    }
  }

  /**
   * Retrieve the shapes included within the selection
   */
  function getSelection() : {shapes: ShapeCommand[], rect: Rectangle} {
    const pageIdx = startPos.page;
    const selectionRectangle = new Rectangle(Math.min(startPos.x, endPos.x), Math.min(startPos.y, endPos.y), Math.abs(endPos.x - startPos.x), Math.abs(endPos.y - startPos.y));
    const selectRect = PosUtils.viewerToShapeCoord(pageIdx, Math.min(startPos.x, endPos.x), Math.min(startPos.y, endPos.y), Math.abs(endPos.x - startPos.x), Math.abs(endPos.y - startPos.y));
    
    var selectedShapes : ShapeCommand[] = [];
    // Only can select if the shapes were properly extracted from the page
    if (window['PDFViewerApplication'].pageShapeCommands && window['PDFViewerApplication'].pageShapeCommands[pageIdx]) {
        const commands = window['PDFViewerApplication'].pageShapeCommands[pageIdx];

        for (let i = 0; i < commands.length; ++i) {
          if (commands[i].isContained(selectRect)) {
            const cmd = commands[i];
            /*if (cmd.text === undefined) {
              selectedShapes = selectedShapes.concat(ShapeUtils.splitIntoSubShapes(cmd));
            } else {*/
              selectedShapes.push(cmd);
            //}
            
          }
        }
    }

    return {shapes: selectedShapes, rect : selectRect};
  }


  return (<>
  <div onMouseDown={onMouseDownPage} onMouseUp={onMouseUpPage} onMouseMove={onMouseMovePage}>
    { isSelecting && <div id="rectangularSelection" 
      style={{ pointerEvents: 'none',
      background: "#D7E1EC50",
      left: Math.min(startPos.x, endPos.x), top: Math.min(startPos.y, endPos.y), border: 'dashed 2px #8E959C', width: Math.abs(startPos.x-endPos.x), height: Math.abs(startPos.y-endPos.y), 
      position: 'absolute', zIndex: 9999 }} />}
    {children}
  </div></>);
}
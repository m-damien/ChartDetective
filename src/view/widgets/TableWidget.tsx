import React, { Fragment } from 'react';
import ReactDOM from 'react-dom';
import Rectangle from '../../datastructure/Rectangle';
import { VariableSizeGrid as Grid } from 'react-window';

/**
 * A simple widget to show a table as a spreadsheet
 */

interface TableSelection {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
}

interface TableWidgetState {
    selection: TableSelection,
    editedCell: TableSelection,
    gridWidth : number,
    gridHeight : number
}

var lastTableId = 0;
export default class TableWidget extends React.PureComponent<any, TableWidgetState> {
    data: string[][];
    title: string;
    id: string;
    floatingHeader: string;
    floatingFooter: string;
    colWidths: number[];
    maxHeight: number;
    maxWidth: number;
    minWidth: number;
    columnWidth: 50;
    rowHeight: 22;
    cellSelectedListener: any;
    cellEditedListener: any;
    cachedTable: JSX.Element;
    lastRowCount: number;
    lastColCount: number;
    stickyGrid : any;
    mainGrid : any;
    hasHorizontalScrollbar : boolean;
    hasVerticalScrollbar : boolean;


    constructor(props: any) {
        super(props);
        this.data = [];
        this.title = null;
        this.id = "table" + (lastTableId++);
        this.floatingHeader = null;
        this.floatingFooter = null;
        this.colWidths = [];

        this.columnWidth = 50;
        this.rowHeight = 22;

        this.maxHeight = this.rowHeight * 6 + 1; // By default, we only show 5 rows
        this.maxWidth = -1; // No max width by default
        this.minWidth = 50;

        this.cellSelectedListener = null;
        this.cellEditedListener = null;

        this.cachedTable = null;
        this.lastRowCount = 0;
        this.lastColCount = 0;

        this.stickyGrid = React.createRef();
        this.mainGrid = React.createRef();
        this.hasHorizontalScrollbar = false;
        this.hasVerticalScrollbar = false;

        this.state = {
            selection: null,
            editedCell: null,
            gridWidth: 200,
            gridHeight : this.rowHeight
        }
    }

    getData(): string[][] {
        return this.data;
    }

    getTitle(): string {
        return this.title;
    }

    getFloatingFooter(): string {
        return this.floatingFooter;
    }

    getFloatingHeader(): string {
        return this.floatingHeader;
    }

    updateDataTableSize(): void {
        var dataTable = document.getElementById(this.id);
        if (dataTable !== null) {
            var scrollBarWidth = 0;
            var scrollBarHeight = 0;

            if (this.mainGrid.current !== null) {
                const gridDiv = this.mainGrid.current._outerRef; // This should point directly to the grid's div
                scrollBarWidth = gridDiv.offsetWidth - gridDiv.clientWidth;
                scrollBarHeight = gridDiv.offsetHeight - gridDiv.clientHeight;
            }

            this.hasHorizontalScrollbar = scrollBarHeight > 0;
            this.hasVerticalScrollbar = scrollBarWidth > 0;

            this.setState({
                gridWidth: dataTable.clientWidth,
                gridHeight: Math.min(this.getHeight() + scrollBarHeight, this.maxHeight)
            });
        }
    }

    componentDidUpdate(): void {
        this.updateDataTableSize();
    }

    componentDidMount(): void {
        this.updateDataTableSize();
    }

    getColWidth(columnId: number): number {
        if (columnId < this.colWidths.length) {
            return this.colWidths[columnId];
        }
        return this.columnWidth;
    }

    /**
        Returns the rectangle (i.e. coordinates and size) of a specific cell
     */
    getCellRect(colId: number, rowId: number): Rectangle {
        var rowHeight = this.rowHeight;
        var y = rowHeight * rowId;

        // We take into account that columns' width can vary
        var x = 0;
        for (var i = 0; i < colId; ++i) {
            x += this.getColWidth(i);
        }

        return new Rectangle(x, y, this.getColWidth(colId), rowHeight);
    }

    isCellSelectable(col: number, row: number): boolean {
        return true;
    }

    isCellEditable(col: number, row: number): boolean {
        return true;
    }

    onCellClicked(event: React.MouseEvent<Element, MouseEvent>, col: number, row: number): void {
        if (this.state.editedCell !== null) {
            // This might happen if we click out of the editing by clicking another cell
            this.onEditingComplete();
        }
        event.stopPropagation();
        event.preventDefault();

        if (this.isCellEditable(col, row)) {
            var editionCell = document.getElementById(this.id + "_editionCell") as HTMLInputElement;
            if (editionCell !== null) {
                let data = "";
                const rawData = this.getData();
                if (row < rawData.length && col < rawData[row].length) {
                    data = rawData[row][col];
                }
                editionCell.value = data;
                editionCell.focus();
            }
            this.setState({ editedCell: { startRow: row, startCol: col, endRow: row, endCol: col } });
        }
    }

    onEditingComplete(cancel = false): void {
        if (!cancel && this.state.editedCell !== null) {
            this.cachedTable = null; // Value might have been modified, just in case, we force a table to be re-generated
            var editionCell = document.getElementById(this.id + "_editionCell") as HTMLInputElement;
            if (this.cellEditedListener !== null) {
                this.cellEditedListener.call(this, this.state.editedCell.startCol, this.state.editedCell.startRow, editionCell.value);
            }
        }
        this.setState({ editedCell: null });
    }

    onCellHovered(event: React.MouseEvent<Element, MouseEvent>, col: number, row: number): void {
        if (this.isCellSelectable(col, row) && !this.props.state.shapeSelection.isDragged) {
            if (this.state.selection === null || col != this.state.selection.startCol || row != this.state.selection.startRow) {
                this.setState({ selection: {
                    startRow: row, startCol: col, endRow: row, endCol: col
                }});
    
                if (this.cellSelectedListener !== null) {
                    this.cellSelectedListener.call(this, col, row);
                }
            }
        } else {
            this.onCellUnhovered();
        }
    }

    onCellUnhovered(): void {
        this.setState({ selection: null });
        if (this.cellSelectedListener !== null) {
            this.cellSelectedListener.call(this, -1, -1);
        }
    }


    /**
     * Get the number of columns of the table
     */
    getColCount(): number {
        var count = 0;
        if (this.getData().length > 0) {
            // Assume that all rows have the same length
            count = this.getData()[0].length;
        }

        return count;
    }

    /**
     * Get the number of rows of the table
     */
    getRowCount(): number {
        return this.getData().length;
    }

    getWidth(): number {
        var width = 0;
        var colCount = this.getColCount();
        for (var i = 0; i < colCount; ++i) {
            width += this.getColWidth(i);
        }
        return Math.max(this.minWidth, Math.min(width + 1, this.maxWidth <= 0 ? 99999999 : this.maxWidth));
    }

    getHeight(): number {
        var nbRow = this.getRowCount();

        return Math.min(this.rowHeight * nbRow + 1, this.maxHeight);
    }

    getFloatingHeaderHTML(): JSX.Element {
        return (
            <div style={{ left: '50%', width: '100%', top: '50%', transform: 'translate(-50%, -50%)', position: 'absolute' }}>
                {this.getFloatingHeader()}
            </div>
        );
    }

    getFloatingFooterHTML(): JSX.Element {
        return (
            <div style={{ left: '50%', width: '100%', top: '50%', transform: 'translate(-50%, -50%)', position: 'absolute' }}>
                {this.getFloatingFooter()}
            </div>
        );
    }

    onMainGridScrolled(scroll, scrollUpdateWasRequested) {
        if (this.stickyGrid.current !== null && !scrollUpdateWasRequested) {
            this.stickyGrid.current.scrollTo({scrollLeft: scroll.scrollLeft, scrollTop:scroll.scrollTop});
        }
    }

    scrollToRow(rowId : number) {
        if (this.mainGrid.current !== null && this.hasVerticalScrollbar) {
            this.mainGrid.current.scrollToItem({align: "end", rowIndex: rowId});
        }
    }

    getCellStyle(col : number, row : number) {
        return {backgroundColor: "#ffffff"}
    }

    getColumnStickyCount() {
        return 0;
    }

    getColumnStickyWidth() {
        return 0;
    }

    getColumnStickyHTML() {
        return null;
    }

    /**
     * This content is placed inside the grid's div. Useful to make overlays.
     */
    getGridOverlay() {
        var selectionRect = null;
        if (this.state !== null && this.state.selection !== null) {
            var selection: TableSelection = this.state.selection;
            selectionRect = this.getCellRect(selection.startCol, selection.startRow);
            selectionRect.add(this.getCellRect(selection.endCol, selection.endRow));
        }

        var editionRect = { x: -200, y: -200, width: 0, height: 0 };
        if (this.state !== null && this.state.editedCell !== null) {
            // Only support edition of a single cell
            editionRect = this.getCellRect(this.state.editedCell.startCol, this.state.editedCell.startRow);
        }

        return <Fragment>{selectionRect !== null &&
            <div style={{  position: 'absolute', top: selectionRect.y + 1, left: selectionRect.x + 1, width: selectionRect.width - 1, height: selectionRect.height - 1, border: "2px solid rgb(79, 140, 252)", boxSizing: 'border-box' , pointerEvents: 'none'}}>
            </div>
        }
        <input type="text" id={this.id + "_editionCell"}
            onBlur={e => this.onEditingComplete()}
            onKeyDown={e => {
                if (e.key === 'Enter') { this.onEditingComplete() }
                if (e.key === 'Escape') { this.onEditingComplete(true) }
            }}
            style={{
                position: 'absolute',
                top: editionRect.y + 1, left: editionRect.x + 1, width: editionRect.width - 1, height: editionRect.height - 1,
                border: "2px solid rgb(79, 140, 252)", boxSizing: 'border-box'
            }}
        />
        </Fragment>
    }

    getTableHTML() {
        var height = this.getHeight();
        const self = this;
        const Cell = ({ columnIndex, rowIndex, style }) => (
            <div className={"tableCell " + 
                            (columnIndex % 2 === 0 ? "evenCol " : "oddCol ") +
                            (rowIndex % 2 === 0 ? "evenRow " : "oddRow ") +
                            (rowIndex === 0 ? "firstRow " : "") + 
                            (columnIndex === 0 ? "firstCol " : "") + 
                            (rowIndex === this.getRowCount()-1 ? "lastRow " : "") + 
                            (columnIndex === this.getColCount()-1 ? "lastCol " : "")
                        }
                style={{...style, ...this.getCellStyle(columnIndex, rowIndex), width: this.getColWidth(columnIndex), pointerEvents: 'auto', cursor: "default"}}

                onMouseOver={this.props.state.shapeSelection.isDragged ? null : (e => this.onCellHovered(e, columnIndex, rowIndex))}
                onMouseDown={e => this.onCellClicked(e, columnIndex, rowIndex)}>
                {self.data[rowIndex][columnIndex]}
            </div>
        );

        return <div id={this.id} style={{ position: 'relative', display: 'flex', flexDirection: 'row', width: '100%'}} onMouseLeave={e => this.onCellUnhovered()}>
        {this.getColumnStickyCount() > 0 &&
            <Grid
                ref={this.stickyGrid}
                style={{ overflowX: this.hasHorizontalScrollbar ? "scroll" : "hidden", overflowY: "hidden", minWidth: this.getColumnStickyWidth() }}
                columnCount={this.getColumnStickyCount()}
                columnWidth={index => this.getColumnStickyWidth() / this.getColumnStickyCount()}
                height={this.state.gridHeight}
                rowCount={this.getRowCount()}
                rowHeight={_ => this.rowHeight}
                width={this.getColumnStickyWidth()}
            >
                {this.getColumnStickyHTML()}
            </Grid>
        }
        <Grid
            onScroll={this.onMainGridScrolled.bind(this)}
            style={{ }}
            ref={this.mainGrid}
            columnCount={this.getColCount()}
            columnWidth={index => self.getColWidth(index)}
            height={this.state.gridHeight}
            rowCount={this.getRowCount()}
            rowHeight={_ => this.rowHeight}
            width={this.state.gridWidth}
        >
            {Cell}
        </Grid>
    </div>
    }

    render(): JSX.Element {
        var width = this.getWidth();
        this.data = this.getData();

        var res = (
            <div style={{position: "relative"}}>
                {this.getFloatingHeader() !== null &&
                    <div className="tableFloatingHeader" style={{width: "100%", height: this.rowHeight + 1 }}>
                        {this.getFloatingHeaderHTML()}
                    </div>
                }

                {this.getTableHTML()}

                {this.mainGrid.current !== null && ReactDOM.createPortal(
                        this.getGridOverlay(),
                        this.mainGrid.current._outerRef
                    )}

                {this.getFloatingFooter() !== null &&
                    <div className="tableFloatingFooter" id={this.id + "_footer"} style={{width: width - 2, height: this.rowHeight }}>
                        {this.getFloatingFooterHTML()}
                    </div>
                }

                {this.props.children}
            </div>);
        return res;
    }
}
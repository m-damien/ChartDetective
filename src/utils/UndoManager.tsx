import DataTable from "../datastructure/DataTable";
import { Snackbar } from "./Snackbar";

export default class UndoManager {
    undoHistory : DataTable[];
    redoHistory : DataTable[];
    dataTable : DataTable;

    static _instance : UndoManager = null;

    constructor() {
        this.undoHistory = [];
        this.redoHistory = [];
    }

    static get() : UndoManager {
        if (UndoManager._instance === null) {
            UndoManager._instance = new UndoManager();
        }

        return UndoManager._instance;
    }

    clearMemory() : void {
        this.undoHistory = [];
        this.redoHistory = [];
    }

    canUndo() : boolean {
        return this.undoHistory.length > 0;
    }

    undo() : DataTable {
        if (this.canUndo()) {
            Snackbar.addInfoMessage("Undo");
            var state = this.undoHistory.pop()
            this.redoHistory.push(this.cloneState());
            return state;
        }
    }

    canRedo() : boolean {
        return this.redoHistory.length > 0;
    }

    redo() : DataTable {
        if (this.canRedo()) {
            Snackbar.addInfoMessage("Redo");
            var state = this.redoHistory.pop()
            this.undoHistory.push(this.cloneState());
            return state;
        }
    }

    addUndoRestorePoint() : void {
        this.undoHistory.push(this.cloneState());
        // Redo history is not compatible anymore, we clear it
        this.redoHistory = [];
    }

    /**
     * Clone the necessary variables to restore the state usig #restoreState
     * Used for Undo/Redo. 
     * This does not save the chart itself, therefore, restoring a state using a different
     * chart will result in undefined behaviors.
     */
    cloneState() : DataTable {
        return this.dataTable.clone();
    }
}
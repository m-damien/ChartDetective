import React from 'react';
import ShapeCommand from '../../datastructure/ShapeCommand';

interface FilterPanelState {
  switches : any[];
}

interface FilterPanelProps {
  shapes : ShapeCommand[];
  onFilterChanged : any;
  filter : any;
}

export default class FilterPanel extends React.Component<FilterPanelProps, FilterPanelState> {

  constructor(props : FilterPanelProps) {
    super(props);

    this.state = {
        switches: this.getGeneratedFilters()
    };
  }

  getGeneratedFilters(): any[] {
    var shapes = this.props.shapes;
    var counter = {};
    var hashToValue = {};
    var i = 0;
    for (i = 0; i < shapes.length; ++i) {
        var shape = shapes[i];
        var value = this.props.filter.getValue(shape);
        if (counter[value.hash] === undefined) {
            counter[value.hash] = 0;
            hashToValue[value.hash] = value;
        }
        hashToValue[value.hash].updateShape(shape);
        counter[value.hash] += 1;
    }

    var sortedHashes = Object.keys(counter);
    sortedHashes.sort(function(a, b) {
        return counter[b] - counter[a];
    });

    var switches = [];

    for (i = 0; i < sortedHashes.length; ++i) {
        var id = this.getUniqueId(i);
        var value = hashToValue[sortedHashes[i]];
        if (counter[sortedHashes[i]] > this.props.filter.minNumberElements() && i < 25) { // We fix a maximum of 25 filters
          switches.push({value: hashToValue[sortedHashes[i]], canvasId: id+"Canvas", checkboxId: id+"Checkbox"});
        } else {
          // Add a "Misc" button for all other filters that did not make the cut
          switches.push({value: {hash: "misc"}, canvasId: id+"Canvas", checkboxId: id+"Checkbox"});
          break;
        }
    }

    return switches;
  }

  getAllowedHashes() : any {
    var allowedHashes = [];
    var forbiddenHashes = [];
    for (var i = 0; i < this.state.switches.length; ++i) {
      var s = this.state.switches[i];
      var checkbox : any = document.getElementById(s.checkboxId);

      (checkbox.checked ? allowedHashes : forbiddenHashes).push(s.value.hash);
    }

    return {allowed: allowedHashes, forbidden: forbiddenHashes};
  }

  apply(shapes : ShapeCommand[]) : ShapeCommand[] {
    var result = [];
    var hashes = this.getAllowedHashes();
    var allowMisc = hashes.allowed.includes("misc");

    for (var i = 0; i < shapes.length; ++i) {
      const hash = this.props.filter.getValue(shapes[i]).hash

      if (hashes.allowed.includes(hash) || (allowMisc && !hashes.forbidden.includes(hash))) {
        result.push(shapes[i]);
      }
    }

    return result;
  }
  
  /**
   * Check or uncheck all the filters
   */
  setAllChecked(checked = true, warnListeners = true) : void {
    for (var i = 0; i < this.state.switches.length; ++i) {
      var s = this.state.switches[i];
      var checkbox : any = document.getElementById(s.checkboxId);

      checkbox.checked = checked;
    }
    if (warnListeners) {
      this.props.onFilterChanged();
    }
  }

  setChecked(hashes : string[], warnListeners = true) : void {
    for (var i = 0; i < this.state.switches.length; ++i) {
      var s = this.state.switches[i];
      var checkbox : any = document.getElementById(s.checkboxId);
      checkbox.checked = hashes.includes(s.value.hash);
    }
    if (warnListeners) {
      this.props.onFilterChanged();
    }
  }

  onDoubleClick(s : any) : void {
    var checkbox : any = document.getElementById(s.checkboxId);
    this.setAllChecked(false, false);
    checkbox.checked = true;
    this.props.onFilterChanged();
  }


  onChange() : void {
    this.props.onFilterChanged();
  }

  repaintSwitches() : void {
    for (var i = 0; i < this.state.switches.length; ++i) {
      var s = this.state.switches[i];
      var canvas : any = document.getElementById(s.canvasId);
      var ctx = canvas.getContext('2d');

      this.props.filter.paint(ctx, s.value, canvas.width, canvas.height);
    }
  }

  componentDidMount() : void {
    this.repaintSwitches();
  }

  componentDidUpdate() : void {
    this.repaintSwitches();
  }

  getUniqueId(idx : number) : string {
    return this.props.filter.getName().replace(/ /g, "") + idx.toString();
  }

  render() : JSX.Element {
    var htmlSwitches = [];
    for (var i = 0; i < this.state.switches.length; ++i) {
        const s = this.state.switches[i];
        htmlSwitches.push(
        <label onDoubleClick={(event) => this.onDoubleClick(s)} key={i.toString()} className="switch tooltip">
            <input id={s.checkboxId} type="checkbox" 
            onChange={(event) => this.onChange()}
            defaultChecked />
            <span className="switch-rect"></span>
            <canvas id={s.canvasId} width={100} height={100} className="switch-inside"></canvas>
            <span className='tooltiptext tooltip-bottom'>Double click to select only this.</span>
        </label>);
    }

    return (
      <div style={{textAlign: 'left', verticalAlign: 'middle', marginLeft: 10, overflowX: 'hidden', overflowY: 'hidden', whiteSpace: 'nowrap'}}>
          <span style={{width: '90px', display: "inline-block", fontWeight: 800, fontSize: '14px'}}>{this.props.filter.getName()}: </span>
          <button className="button" onMouseDown={(e) => e.preventDefault()} onClick={(event)=> this.setAllChecked(true)}>All</button>
          <button className="button gray" onMouseDown={(e) => e.preventDefault()} onClick={(event)=> this.setAllChecked(false)}>None</button>
          {htmlSwitches}
      </div>
    );
  }
}

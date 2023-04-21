import ShapeCommand from '../datastructure/ShapeCommand';


/**
 * PDFjs uses a bunch of canvas to render the PDF. The CanvasFactory is the class handling the creation of canvases.
 * For this project, we need to access the list of shapes drawn on the Canvas representing the PDF. We cannot get this information easily with PDFjs
 * but luckily, we can pass a custom CanvasFactory. The idea is then to return "hooked" canvases, i.e., every method called on the canvas is logged and creates shapes.
 * This way, all canvases contain the list of shapes used.
 */
// Based on BaseCanvasFactory (https://github.com/mozilla/pdf.js/blob/c7c59feeaf46a2c97abb9d936b083a3a8f82787d/src/display/base_factory.js)
// and DOMCanvasFactory (https://github.com/mozilla/pdf.js/blob/7beb67af7b2a0766785654b5f04855cf8c931f92/src/display/display_utils.js)
export default class HookedCanvasFactory {

  hookedCtx : CanvasRenderingContext2D;
  hookedCtxs : CanvasRenderingContext2D[];
  origGetContext : any;

  constructor(context) {
      this.hookedCtxs = [];
      this.hookedCtx = context;
      this.hookCtx(context);
  }

  _createCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  create(width, height) {
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid canvas size");
    }
    const canvas = this._createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    // We hook every single canvas being created to render the PDF
    this.hookCtx(ctx);

    return {
      canvas,
      context: ctx
    };
  }

  reset(canvasAndContext, width, height) {
    if (!canvasAndContext.canvas) {
      throw new Error("Canvas is not specified");
    }
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid canvas size");
    }
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
    // We hook the canvas in case it was not already hooked
    // + the canvas has been reset, so we should clear the commands
    const ctx = canvasAndContext.context;
    if (ctx.isHooked !== undefined) {
      ctx.commands = [];
    }
  }

  destroy(canvasAndContext) {
    if (!canvasAndContext.canvas) {
      throw new Error("Canvas is not specified");
    }
    this.unhookCtx(canvasAndContext.context);

    // Zeroing the width and height cause Firefox to release graphics
    // resources immediately, which can greatly reduce memory consumption.
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }

  getCommands() {
      return (this.hookedCtx as any).commands;
  }

  getCurrentCmd(ctx) {
      if (ctx.currentCommand == null) {
          ctx.currentCommand = new ShapeCommand();
          // Make sure the new command has the current style
          ctx.currentCommand.saveStyle(ctx);
      }
      return ctx.currentCommand;
  }

  addCommand(ctx, cmd) {
      cmd.saveStyle(ctx);
      cmd.computeBBox(ctx);
      ctx.commands.push(cmd);
  }

  /* Drawing rectangles */
  // Not supported - not used in PDFjs
  clearRect(ctx, x, y, width, height) {
      console.log("clearRect not supported");
  }

  fillRect(ctx, x, y, width, height) {
      //console.log("fillRect not supported");
  }

  strokeRect(ctx, x, y, width, height) {
      console.log("strokeRect not supported");
  }

  /* Drawing text */
  // This function is only available because we use a modified pdfjs
  glyphFillText(ctx, text, x, y, glyphs, glyphIdx) {
      var textCommand = new ShapeCommand();
      textCommand.text = text;
      textCommand.textX = x;
      textCommand.textY = y;
      textCommand.isFilled = true;
      if (glyphs !== undefined && glyphIdx !== undefined) {
          textCommand.unicode = glyphs[glyphIdx].unicode;
      }
      this.addCommand(ctx, textCommand);
  }

  strokeText(ctx, text, x, y, maxWidth = undefined) {
    var textCommand = new ShapeCommand();
    textCommand.unicode = textCommand.text = text;
    textCommand.textX = x;
    textCommand.textY = y;
    textCommand.isFilled = true;
    this.addCommand(ctx, textCommand);
  }

  /* Paths */
  beginPath(ctx) {
      ctx.currentCommand = new ShapeCommand();
      this.getCurrentCmd(ctx).addCmd(ShapeCommand.types.BEGIN);
  }

  closePath(ctx) {
      this.getCurrentCmd(ctx).addCmd(ShapeCommand.types.CLOSE);
  }

  moveTo(ctx, ...args) {
      this.getCurrentCmd(ctx).addCmd(ShapeCommand.types.MOVETO, args);
  }

  lineTo(ctx, ...args) {
      this.getCurrentCmd(ctx).addCmd(ShapeCommand.types.LINETO, args);
  }

  bezierCurveTo(ctx, ...args) {
      this.getCurrentCmd(ctx).addCmd(ShapeCommand.types.CURVETO, args);
  }

  quadraticCurveTo(ctx, cpx, cpy, x, y) {
      // PDFjs relies solely on bezierCurveTo
      console.log("quadraticCurveTo not supported")
  }

  arc(ctx, x, y, radius, startAngle, endAngle, anticlockwise=false) {
      console.log("arc not supported");
  }

  arcTo(ctx, x1, y1, x2, y2, radius) {
      console.log("arcTo not supported");
  }

  clip(ctx, path, fillRule) {
      if (!ctx['clipPaths']) {
        ctx['clipPaths'] = [];
      }

      ctx['clipPaths'].push({path: this.getCurrentCmd(ctx).path, transform: DOMMatrix.fromMatrix(ctx.getTransform())});
  }

  ellipse(ctx, x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise=false) {
      console.log("ellipse not supported");
  }

  rect(ctx, x, y, width, height) {
      ctx.currentCommand = new ShapeCommand();
      this.getCurrentCmd(ctx).addCmd(ShapeCommand.types.BEGIN);
      this.getCurrentCmd(ctx).addCmd(ShapeCommand.types.MOVETO, [x, y]);
      this.getCurrentCmd(ctx).addCmd(ShapeCommand.types.LINETO, [x, y+height]);
      this.getCurrentCmd(ctx).addCmd(ShapeCommand.types.LINETO, [x+width, y+height]);
      this.getCurrentCmd(ctx).addCmd(ShapeCommand.types.LINETO, [x+width, y]);
      this.getCurrentCmd(ctx).addCmd(ShapeCommand.types.CLOSE);
  }

  fill(ctx, path=undefined) {
      this.getCurrentCmd(ctx).isFilled = true;
      this.addCommand(ctx, this.getCurrentCmd(ctx));

      // Fill or stroke could be used again, so we need to clone the current command
      ctx.currentCommand = ctx.currentCommand.clone();
  }

  save(ctx) {
      if (!ctx["savedClippingPaths"]) {
        ctx["savedClippingPaths"] = [];
      }

      ctx["savedClippingPaths"].push([].concat(ctx['clipPaths']))
  }

  restore(ctx) {
    if (ctx["savedClippingPaths"]) {
      ctx['clipPaths'] = ctx["savedClippingPaths"].pop();
    }
  }

  stroke(ctx, path=undefined) {
      this.getCurrentCmd(ctx).isFilled = false;
      this.addCommand(ctx, this.getCurrentCmd(ctx));
      // Fill or stroke could be used again, so we need to clone the current command
      ctx.currentCommand = ctx.currentCommand.clone();
  }

  drawImage(ctx, image) {
      try {
          if (image.getContext !== undefined) {
              let x = arguments[2];
              let y = arguments[3];
              if (arguments.length > 4) {
                  // a clipping rectangle is defined
                  x = arguments[6];
                  y = arguments[7];
                  console.log("drawImage with clipping rect not supported");
              }
              const imgCtx = image.getContext("2d");
              const commands = imgCtx.commands;
              image.hooked = true;
              // We are drawing the image, so all the commands should be transferred to the canvas being drawn on
              for (const cmd of commands) {
                  var clonedCmd = cmd.clone();
                  //TODO: Clone cmd
                  if (clonedCmd.transform !== null) {
                      clonedCmd.transform = ctx.getTransform().multiply(clonedCmd.transform);
                      //cmd.transform = cmd.transform.multiply(ctx.getTransform());
                  } else {
                      clonedCmd.transform = DOMMatrix.fromMatrix(ctx.getTransform());
                  }
                  clonedCmd.globalAlpha *= ctx.globalAlpha;
                  clonedCmd.computeBBox(ctx);

                  ctx.commands.push(clonedCmd);
              }
          }
      } catch(err) {
          console.log(err);
      }

  }

  hookCtx(ctx) {
    if (ctx.isHooked !== undefined && ctx.isHooked) {
      // The context has already been hooked, this can happen when flipping pages really quickly
      // In that case, we undo the hook, and then redo it starting from a clean state
      this.unhookCtx(ctx);
    }

    this.hookedCtxs.push(ctx);
    ctx.isHooked = true;
    ctx.hookId = this.hookedCtxs.length;
    ctx.origFunctions = {};
    ctx.commands = [];
    ctx.currentCommand = null;
    ctx.lastWidth = ctx.canvas.width;
    ctx.lastHeight = ctx.canvas.height;
    this.hookMethod(ctx, 'clearRect', this.clearRect);
    this.hookMethod(ctx, 'fillRect', this.fillRect);
    this.hookMethod(ctx, 'strokeRect', this.strokeRect);
    //this.hookMethod(ctx, 'fillText', this.fillText);
    this.hookMethod(ctx, 'strokeText', this.strokeText);
    this.hookMethod(ctx, 'beginPath', this.beginPath);
    this.hookMethod(ctx, 'closePath', this.closePath);
    this.hookMethod(ctx, 'moveTo', this.moveTo);
    this.hookMethod(ctx, 'lineTo', this.lineTo);
    this.hookMethod(ctx, 'bezierCurveTo', this.bezierCurveTo);
    this.hookMethod(ctx, 'quadraticCurveTo', this.quadraticCurveTo);
    this.hookMethod(ctx, 'arc', this.arc);
    this.hookMethod(ctx, 'arcTo', this.arcTo);
    this.hookMethod(ctx, 'ellipse', this.ellipse);
    this.hookMethod(ctx, 'rect', this.rect);
    this.hookMethod(ctx, 'fill', this.fill);
    this.hookMethod(ctx, 'stroke', this.stroke);
    // Uncomment to support clipping (still experimental and might mess up some charts)
    //this.hookMethod(ctx, 'clip', this.clip);
    //this.hookMethod(ctx, 'save', this.save);
    //this.hookMethod(ctx, 'restore', this.restore);

    this.hookMethod(ctx, 'drawImage', this.drawImage);

    ctx.glyphFillText = (text, x, y, glyphs, glyphIdx) => {this.glyphFillText(ctx, text, x, y, glyphs, glyphIdx)};
  }

  unhookCtx(ctx) {
      for (var key in ctx.origFunctions) {
          ctx.isHooked = undefined;
          if (ctx.origFunctions.hasOwnProperty(key)) {
              ctx[key] = ctx.origFunctions[key];
          }
      }

      ctx.commands = undefined;
  }

  /**
   * Hook a specific method of an object
   * The callback will be called everytime the hooked function is called
   * @param {Object} object Object to hook 
   * @param {String} method  Name of the method to hook
   * @param {Function} callback Callback called when the hooked function is called
   */
  hookMethod(object, method, callback, block=false) {
      var self = this;
      object.origFunctions[method] = object[method];

      object[method] = function () {
          callback.apply(self, [object, ...arguments as any]);
          if (!block) {
              object.origFunctions[method].apply(object, arguments);
          }
      }
  }

  uninstallHook() {
      for (var ctx of this.hookedCtxs) {
          this.unhookCtx(ctx);
      }
  }
}
# Faster HTML Canvas

This canvas is designed to be panned and zoomed with minimal performance impact. A shadow canvas is running behind the scenes to hold off-canvas data. Thanks to that, panning only needs minimal drawing. For zooming, a half zoom mechanism implemented. Zooming is debounced and a less sharp image is drawn to main canvas during debounce. Panning during halfzoom is also optimized.
[Here is a website using this canvas](https://remziatay.github.io/solverr/). Go check it, pan it, zoom it, make some drawings and decide if it's fast enough.

### Usage

First of all, you need a canvas element on DOM. Then decide what sizes the shadow canvas will be. It is recommended to have at least 3 times bigger than your canvas.

#### Creating instance

Constructor arguments are respectively the canvas, shadowCanvas width and height. If canvas will be resized on window resize event or such, `PZCanvas.prototype.resize()` must be called right after.

```js
const myCanvas = document.getElementById("my-canvas");
const pzCanvas = new PZcanvas(myCanvas, 4800, 3600);
// Fix blur on mobile and retina screens (This is mandatory)
const rect = canvas.getBoundingClientRect();
myCanvas.width = rect.width * window.devicePixelRatio;
myCanvas.height = rect.height * window.devicePixelRatio;
pzCanvas.resize();
```

#### Panning and Zooming

Panning and zooming with events such as dragging, scrolling or touch gestures:

```js
pzCanvas.pan(dx, dy); // dx & dy are amount of dragging
pzCanvas.zoom(zoomAmount, x, y); // (x, y) is the zooming center
```

Panning and zooming with exact amounts (not dependant on device dpi):

```js
pzCanvas.pan(panX, panY, false);
pzCanvas.zoom(zoomAmount, x, y, false);
```

#### Drawing on Canvas

This is the template for drawing on the canvas. This function draws a line on the canvas. If it is desired to draw on-screen canvas, temp argument must be true.

```js
function draw(x1, x2, x3, x4, lineWidth, temp = false) {
  [x1, y1, x2, y2] = [x1, y1, x2, y2].map(p => p * window.devicePixelRatio);
  const ctx = temp ? this.pzCanvas.ctx : this.pzCanvas.shadowCtx;
  if (!temp) {
    // Points must be converted to shadow canvas world
    ({ x1, y1 } = pzCanvas.convertPoint(x1, y1));
    ({ x2, y2 } = pzCanvas.convertPoint(x2, y2));
  }
  ctx.save();
  ctx.lineWidth = lineWidth * (temp ? pzCanvas.scale : 1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}
```

To add a drawing to canvas permanently, the function must be added to pzCanvas drawings. When adding the drawing, temp argument must always be false!

```js
pzCanvas.addNewDrawing(() => this.draw(0, 0, 20, 30, 8));
```

### Suggestions

- Avoid using `PZCanvas.prototype.update()` function manually. It is very expensive.
- Always check if canvas is available using `PZCanvas.prototype.isReady()` function before drawing on canvas. This will avoid drawing on canvas during half zoom.
- For temporary drawings, it is very efficient to use `PZCanvas.prototype.refresh(); draw(..., temp = true)`
- Use `draw(..., temp = false)` instead of `PZCanvas.prototype.update()` after adding a new drawing with `PZCanvas.prototype.addNewDrawing()`
- Don't forget to convert points when drawing on shadow canvas or adding a new drawing.
- It is not suggested to use `transform()`, `scale()` or **especially** `rotate()` on canvas rendering contexts.

---

## License

MIT

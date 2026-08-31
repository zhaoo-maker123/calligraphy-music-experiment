export class CanvasTracer {
  constructor({ canvas, image, onTraceChange }) {
    this.canvas = canvas;
    this.image = image;
    this.context = canvas.getContext("2d");
    this.onTraceChange = onTraceChange;
    this.drawing = false;
    this.enabled = false;
    this.points = [];

    this.resize = this.resize.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerEnd = this.handlePointerEnd.bind(this);

    this.resize();
    window.addEventListener("resize", this.resize);
    image.addEventListener("load", this.resize);
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerEnd);
    canvas.addEventListener("pointercancel", this.handlePointerEnd);
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const previous = document.createElement("canvas");
    previous.width = this.canvas.width;
    previous.height = this.canvas.height;
    if (previous.width && previous.height) {
      previous.getContext("2d").drawImage(this.canvas, 0, 0);
    }

    const pixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = bounds.width * pixelRatio;
    this.canvas.height = bounds.height * pixelRatio;
    this.context.scale(pixelRatio, pixelRatio);
    this.context.lineCap = "round";
    this.context.lineJoin = "round";
    this.context.strokeStyle = "#168dcc";
    this.context.lineWidth = 5;
    if (previous.width && previous.height) {
      this.context.drawImage(
        previous,
        0,
        0,
        previous.width,
        previous.height,
        0,
        0,
        bounds.width,
        bounds.height,
      );
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.canvas.classList.toggle("enabled", enabled);
    if (!enabled) this.drawing = false;
  }

  reset() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.points = [];
    this.drawing = false;
    this.onTraceChange();
  }

  getPoint(event) {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  handlePointerDown(event) {
    if (!this.enabled) return;
    event.preventDefault();
    this.drawing = true;
    this.canvas.setPointerCapture(event.pointerId);

    const point = this.getPoint(event);
    this.points.push(point);
    this.context.beginPath();
    this.context.moveTo(point.x, point.y);
  }

  handlePointerMove(event) {
    if (!this.drawing) return;
    event.preventDefault();

    const point = this.getPoint(event);
    this.points.push(point);
    this.context.lineTo(point.x, point.y);
    this.context.stroke();
  }

  handlePointerEnd() {
    if (!this.drawing) return;
    this.drawing = false;
    this.onTraceChange();
  }

  createPreview(width, height) {
    return this.createStrokeCanvas(width, height);
  }

  createStrokeCanvas(width, height) {
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round(width));
    output.height = Math.max(1, Math.round(height));
    output.getContext("2d").drawImage(
      this.canvas,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      0,
      0,
      output.width,
      output.height,
    );
    return output;
  }

  createStrokePngBlob(longEdge) {
    const sourceWidth = this.canvas.clientWidth;
    const sourceHeight = this.canvas.clientHeight;
    const scale = longEdge / Math.max(sourceWidth, sourceHeight);
    const output = this.createStrokeCanvas(sourceWidth * scale, sourceHeight * scale);
    return new Promise((resolve, reject) => {
      output.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The stroke PNG could not be created."));
      }, "image/png");
    });
  }

  destroy() {
    window.removeEventListener("resize", this.resize);
    this.image.removeEventListener("load", this.resize);
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerEnd);
    this.canvas.removeEventListener("pointercancel", this.handlePointerEnd);
  }
}

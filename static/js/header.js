import { intBufferFromCanvas } from "@thi.ng/pixel";
import { ditherWith, ATKINSON } from "@thi.ng/pixel-dither";

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
let width = 300;
let height = 150;

const observer = new ResizeObserver((entries) => {
  width = canvas.clientWidth;
  height = 20;
});
observer.observe(canvas)

// not import but draw something just to showcase

const grad=ctx.createLinearGradient(0,0, 280,0);
grad.addColorStop(0, "lightblue");
grad.addColorStop(1, "darkblue");

function render(time) {
  
  const range = Math.max(width, height) * 0.8;
  const size = 64 + Math.sin(time * 0.001) * 50;
  for (let i = 0; i < range; i += size) {
    ctx.fillStyle = grad;
    ctx.fillRect( i, -range, size, range * 2);
    ctx.fillRect(-i, -range, size, range * 2);
  }
  
  ctx.restore();

  requestAnimationFrame(render)
}
requestAnimationFrame(render);

const root = document.getElementById("app");
root.appendChild(img);

const img = intBufferFromCanvas(canvas);
const ditherCanvas = canvasFromPixelBuffer(ditherWith(ATKINSON, img), root);

canvas.remove();
observer.observe(ditherCanvas)
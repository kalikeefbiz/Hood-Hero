import * as THREE from "three";
import { rng, TILE } from "./geo";

function canvas(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  return c;
}

export function facadeTextures() {
  const cell = 32,
    size = cell * TILE,
    r = rng(7);
  const lit: boolean[] = [];
  for (let i = 0; i < TILE * TILE; i++) lit.push(r() < 0.34);
  const map = new THREE.CanvasTexture(
    canvas(size, size, (g) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, size, size);
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          g.fillStyle = "#e6e2dc";
          g.fillRect(x * cell, y * cell + cell - 3, cell, 3);
          g.fillStyle = lit[y * TILE + x] ? "#5b5348" : "#30353d";
          g.fillRect(x * cell + 8, y * cell + 7, 16, 17);
          g.fillStyle = "#d8d3cb";
          g.fillRect(x * cell + 7, y * cell + 24, 18, 2);
        }
    }),
  );
  const emissive = new THREE.CanvasTexture(
    canvas(size, size, (g) => {
      g.fillStyle = "#000";
      g.fillRect(0, 0, size, size);
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++)
          if (lit[y * TILE + x]) {
            const warm = r();
            g.fillStyle =
              warm < 0.7 ? "#ffc27a" : warm < 0.9 ? "#ffe2b0" : "#9fc8ff";
            g.fillRect(x * cell + 8, y * cell + 7, 16, 17);
          }
    }),
  );
  for (const t of [map, emissive]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
  }
  return { map, emissive };
}

export function radialTexture() {
  const t = new THREE.CanvasTexture(
    canvas(64, 64, (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.35)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }),
  );
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SIGN_FONT = '"Barlow Condensed", sans-serif';

type Cell = [number, number, number, number];
/**
 * One texture holds every painted sign, graffiti tag and mural, so all
 * signage in the city costs two draw calls. Cells are 256×64 px.
 */
export class SignAtlas {
  readonly cols = 4;
  readonly rows = 32;
  readonly cw = 256;
  readonly ch = 64;
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  private g: CanvasRenderingContext2D;
  private next = 0;
  private jobs: {
    cell: number;
    span: number;
    draw: (g: CanvasRenderingContext2D, w: number, h: number) => void;
  }[] = [];
  private keys = new Map<string, Cell>();
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.cols * this.cw;
    this.canvas.height = this.rows * this.ch;
    this.g = this.canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    // Load the two faces signs use once, then redraw with them. Drawing only
    // with faces the game ships keeps the browser from chasing missing ones.
    Promise.all([
      document.fonts?.load(`700 40px "Barlow Condensed"`),
      document.fonts?.load(`italic 700 40px "Barlow Condensed"`),
    ])
      .then(() => this.redraw())
      .catch(() => {});
  }
  private alloc(
    key: string,
    span: number,
    draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  ): Cell {
    const hit = this.keys.get(key);
    if (hit) return hit;
    // Multi-row cells (murals) start on a fresh column.
    const cell = this.next;
    this.next += span;
    if (this.next > this.cols * this.rows) throw new Error("Sign atlas full");
    this.jobs.push({ cell, span, draw });
    this.paint(this.jobs[this.jobs.length - 1]);
    const c = cell % this.cols,
      r = Math.floor(cell / this.cols);
    const W = this.canvas.width,
      H = this.canvas.height;
    // UV v=0 is the bottom of the canvas.
    const uv: Cell = [
      (c * this.cw + 2) / W,
      1 - ((r + 1) * this.ch - 2) / H,
      ((c + 1) * this.cw - 2) / W,
      1 - (r * this.ch + 2) / H,
    ];
    this.keys.set(key, uv);
    return uv;
  }
  private paint(job: {
    cell: number;
    draw: (g: CanvasRenderingContext2D, w: number, h: number) => void;
  }) {
    const c = job.cell % this.cols,
      r = Math.floor(job.cell / this.cols);
    const g = this.g;
    g.save();
    g.translate(c * this.cw, r * this.ch);
    g.beginPath();
    g.rect(0, 0, this.cw, this.ch);
    g.clip();
    g.clearRect(0, 0, this.cw, this.ch);
    job.draw(g, this.cw, this.ch);
    g.restore();
  }
  redraw() {
    for (const j of this.jobs) this.paint(j);
    this.texture.needsUpdate = true;
  }
  /** Painted shop sign: solid board, bold condensed lettering. */
  sign(text: string, bg: string, fg: string): Cell {
    return this.alloc(`sign:${text}:${bg}:${fg}`, 1, (g, w, h) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 4;
      g.strokeRect(2, 2, w - 4, h - 4);
      g.fillStyle = fg;
      g.textAlign = "center";
      g.textBaseline = "middle";
      let size = 46;
      g.font = `700 ${size}px ${SIGN_FONT}`;
      while (g.measureText(text).width > w - 18 && size > 14) {
        size -= 2;
        g.font = `700 ${size}px ${SIGN_FONT}`;
      }
      g.fillText(text, w / 2, h / 2 + 2);
    });
  }
  /** Spray-painted tag with transparent background. */
  tag(text: string, color: string, crown = false): Cell {
    return this.alloc(`tag:${text}:${color}:${crown}`, 1, (g, w, h) => {
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `italic 700 44px ${SIGN_FONT}`;
      g.lineJoin = "round";
      g.strokeStyle = "rgba(20,20,20,0.9)";
      g.lineWidth = 8;
      g.save();
      g.translate(w / 2, h / 2 + 4);
      g.rotate(-0.06);
      g.strokeText(text, 0, 0);
      g.fillStyle = color;
      g.fillText(text, 0, 0);
      g.restore();
      if (crown) {
        g.fillStyle = color;
        g.beginPath();
        const cx = w / 2 + g.measureText(text).width / 2 - 6,
          cy = 10;
        g.moveTo(cx - 14, cy + 10);
        g.lineTo(cx - 14, cy);
        g.lineTo(cx - 7, cy + 6);
        g.lineTo(cx, cy - 4);
        g.lineTo(cx + 7, cy + 6);
        g.lineTo(cx + 14, cy);
        g.lineTo(cx + 14, cy + 10);
        g.closePath();
        g.fill();
      }
    });
  }
  /** Gabriel's Angels wings mural, painted on a wall. */
  wings(): Cell {
    return this.alloc("wings", 1, (g, w, h) => {
      g.fillStyle = "#3a3633";
      g.fillRect(0, 0, w, h);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          g.fillStyle = i % 2 ? "#f5f1e6" : "#e9e3d2";
          g.beginPath();
          const bx = w / 2 + side * 14;
          g.ellipse(
            bx + side * (16 + i * 13),
            30 + i * 3,
            30 - i * 3,
            7,
            side * (0.5 - i * 0.12),
            0,
            Math.PI * 2,
          );
          g.fill();
        }
      }
      g.fillStyle = "#e9be39";
      g.font = `italic 700 18px ${SIGN_FONT}`;
      g.textAlign = "center";
      g.fillText("Gabriel's Angels", w / 2, h - 8);
    });
  }
  /** A memorial portrait wall: wings, a face shape and candles below. */
  memorial(): Cell {
    return this.alloc("memorial", 1, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "#2f5a7a");
      grad.addColorStop(1, "#7a5a4a");
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#e8e2d8";
      for (const side of [-1, 1]) {
        g.beginPath();
        g.ellipse(w / 2 + side * 42, 30, 40, 16, side * 0.4, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#6a4a3a";
      g.beginPath();
      g.ellipse(w / 2, 28, 15, 19, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#cd7935";
      g.font = `700 14px ${SIGN_FONT}`;
      g.textAlign = "center";
      g.fillText("REST EASY", w / 2, h - 6);
      // The Blips' defacement.
      g.strokeStyle = "#a35ee8";
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(30, 52);
      g.lineTo(w - 40, 14);
      g.stroke();
    });
  }
  /** Generic colourful mural for neighbourhood walls. */
  mural(seed: number): Cell {
    return this.alloc(`mural:${seed}`, 1, (g, w, h) => {
      const r = rng(seed);
      const palettes = [
        ["#2f6f8f", "#d9604b", "#e9be39"],
        ["#3a5a3a", "#c98f6a", "#f5f1e6"],
        ["#5a2a6a", "#e88a3a", "#f0d2a0"],
      ];
      const p = palettes[seed % palettes.length];
      const grad = g.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, p[0]);
      grad.addColorStop(1, p[1]);
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? p[2] : "rgba(255,255,255,0.5)";
        g.beginPath();
        g.arc(r() * w, r() * h, 6 + r() * 14, 0, Math.PI * 2);
        g.fill();
      }
    });
  }
}

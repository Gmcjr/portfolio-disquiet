declare module 'p5' {
  interface P5Canvas {
    parent(target: string): void;
  }

  interface P5Instance {
    setup: () => void;
    draw: () => void;
    windowWidth: number;
    width: number;
    height: number;
    createCanvas(width: number, height: number): P5Canvas;
    noLoop(): void;
    background(color: string): void;
    fill(color: string): void;
    ellipse(x: number, y: number, width: number, height: number): void;
    random(max: number): number;
    random(min: number, max: number): number;
  }

  interface P5Constructor {
    new (sketch: (p: P5Instance) => void): P5Instance;
  }

  const p5: P5Constructor;
  export default p5;
}

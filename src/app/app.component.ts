import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LayersComponent } from './layers/layers.component';

interface Point {
  x: number;
  y: number;
}

interface Layer {
  type: 'polygon' | 'text';
  data: any;
  order: Number
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [FormsModule,CommonModule, LayersComponent]
})
export class AppComponent {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;
@ViewChild('imageInput', { static: false }) imageInputRef!: ElementRef<HTMLInputElement>;

baseImage: HTMLImageElement | null = null;
  ctx!: CanvasRenderingContext2D;
  drawing = false;
  layers: Layer[] = [];
  counter = 0


  ngOnInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
  }

  getMousePos(event: MouseEvent): Point {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  startDraw(event: MouseEvent) {
    const currentLayer = this.layers[this.layers.length - 1];
    if (currentLayer?.type !== 'polygon') return;

    this.drawing = true;
    const point = this.getMousePos(event);
    currentLayer.data.points.push(point);
   // this.redraw();
  }

  draw(event: MouseEvent) {
    if (!this.drawing) return;
  //  this.redraw();
  }

  endDraw() {
    this.drawing = false;
  }

  redraw() {
  const canvas = this.canvasRef.nativeElement;
  this.ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw base image if available
  if (this.baseImage) {
    this.ctx.drawImage(this.baseImage, 0, 0, canvas.width, canvas.height);
  }

  this.layers.forEach(layer => {
    if (layer.type === 'polygon') {
      this.drawPolygon(layer.data.points);
    } else if (layer.type === 'text') {
      this.drawText(layer.data.text, layer.data.position);
    }
  });
}


  drawPolygon(points: Point[]) {
    if (points.length === 0) return;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(p => this.ctx.lineTo(p.x, p.y));
    this.ctx.stroke();
  }

  drawText(text: string, position: Point) {
    this.ctx.font = '16px Arial';
    this.ctx.fillText(text, position.x, position.y);
  }

  addPolygonLayer() {
    this.layers.push({ type: 'polygon', data: { points: [] }, order: this.counter++});
  }

  addTextLayer() {
    const text = prompt('Enter text:');
    if (!text) return;
    this.layers.push({ type: 'text', data: { text, position: { x: 100, y: 100 } }, order: this.counter++ });
   this.redraw();
  }

  saveLayers() {
    const dataStr = JSON.stringify(this.layers);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotations.json';
    a.click();
  }

  loadLayers() {
    this.fileInputRef.nativeElement.click();
  }

  handleFile(event: any) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      if (e.target !=null)
      ///this.layers = JSON.parse(e.target.result as string);
      this.redraw();
    };
    reader.readAsText(file);
  }
  uploadImage() {
  this.imageInputRef.nativeElement.click();
}

handleImage(event: any) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      this.baseImage = img;
      this.redraw();
    };
    img.src = e.target?.result as string;
  };
 reader.readAsDataURL(file);
}

  clearCanvas() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.baseImage = null;
  }

}

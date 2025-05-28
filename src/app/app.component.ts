import { Component, ElementRef, Input, ViewChild } from '@angular/core';
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
  order: Number;
  visible: Boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [FormsModule, CommonModule, LayersComponent],
})
export class AppComponent {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput', { static: false }) imageInputRef!: ElementRef<HTMLInputElement>;

  baseImage: HTMLImageElement | null = null;
  ctx!: CanvasRenderingContext2D;
  drawing = false;
  @Input() layers: Layer[] = [];
  
  counter = 0;


  selectedTextLayer: Layer | null = null;
  editingLayerIndex: number | null = null;
  editOptions = {
  bold: false,
  fontSize: 16,
  color: '#000000'
  };
  isDraggingText = false;
  offsetX = 0;
  offsetY = 0;

  ngOnInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
  }

  getMousePos(event: MouseEvent): Point {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

 
 startDraw(event: MouseEvent) {
  const pos = this.getMousePos(event);

  // Check for text layer dragging (from topmost to bottom)
  for (let i = this.layers.length - 1; i >= 0; i--) {
    const layer = this.layers[i];

    if (layer.type === 'text' && layer.visible !== false) {
      const { position, width, height } = layer.data;

      const lx = position.x;
      const ly = position.y;

      const isInside = (
        pos.x >= lx &&
        pos.x <= lx + width &&
        pos.y >= ly - height &&
        pos.y <= ly
      );

      if (isInside) {
        this.selectedTextLayer = layer;
        this.isDraggingText = true;
        this.offsetX = pos.x - lx;
        this.offsetY = pos.y - ly;
        return;
      }
    }
  }

  // If not dragging text, maybe draw polygon
  const currentLayer = this.layers[this.layers.length - 1];
  if (currentLayer?.type !== 'polygon') return;

  this.drawing = true;
  currentLayer.data.points.push(pos);
}


  // 🟠 MODIFIED: Track text movement
  draw(event: MouseEvent) {
    if (this.isDraggingText && this.selectedTextLayer) {
      const pos = this.getMousePos(event);
      this.selectedTextLayer.data.position.x = pos.x - this.offsetX;
      this.selectedTextLayer.data.position.y = pos.y - this.offsetY;
      this.redraw();
      return;
    }

    if (!this.drawing) return;
  }

  // 🟠 MODIFIED: End drag or draw
  endDraw() {
    if (this.isDraggingText) {
      this.isDraggingText = false;
      this.selectedTextLayer = null;
    }
    this.drawing = false;
  }

  redraw() {
  const canvas = this.canvasRef.nativeElement;
  this.ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (this.baseImage) {
    this.ctx.drawImage(this.baseImage, 0, 0, canvas.width, canvas.height);
  }

  this.layers.forEach(layer => {
    if (layer.visible === false) return; // ⬅️ Important for hiding layers

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

  drawText(text: string, position: { x: number, y: number }) {
  const layer = this.layers.find(
    l => l.data.text === text && 
         l.data.position.x === position.x &&
         l.data.position.y === position.y
  );
  if (!layer) return;

  this.ctx.font = layer.data.font || '16px Arial';
  this.ctx.fillStyle = layer.data.color || '#000000';
  this.ctx.fillText(text, position.x, position.y);
}

  addPolygonLayer() {
    this.layers.push({ type: 'polygon', data: { points: [] }, order: this.counter++, visible: true });
  }

  addTextLayer() {
  const text = prompt('Enter text:');
  if (!text) return;

  const defaultFont = '16px Arial';
  this.ctx.font = defaultFont;
  const width = this.ctx.measureText(text).width;
  const height = 16; // match font size

  this.layers.push({
    type: 'text',
    data: {
      text,
      position: { x: 100, y: 100 },
      font: defaultFont,
      color: '#000000',
      width,
      height
    },
    order: this.counter++,
    visible: true
  });

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
      if (e.target != null) {
        this.layers = JSON.parse(e.target.result as string); // 🟡 UNCOMMENTED
        this.redraw();
      }
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
    this.layers = []
    this.redraw()
  }

  handleDelete(index: number) {
    this.layers.splice(index, 1);
    this.redraw();
 }

handleEdit(index: number) {
  const layer = this.layers[index];
  if (layer.type !== 'text') return;

  this.editingLayerIndex = index;

  // Load current settings into editOptions
  const { font = '16px Arial', color = '#000000' } = layer.data;
  const sizeMatch = font.match(/(\d+)px/);
  this.editOptions = {
    bold: font.includes('bold'),
    fontSize: sizeMatch ? parseInt(sizeMatch[1]) : 16,
    color
  };
}

  handleToggleVisibility(index: number) {
    this.layers[index].visible = !this.layers[index].visible;
    this.redraw();
  }

updateLiveEdit() {
  if (this.editingLayerIndex === null) return;

  const layer = this.layers[this.editingLayerIndex];
  if (layer.type !== 'text') return;

  const { bold, fontSize, color } = this.editOptions;
  const weight = bold ? 'bold' : 'normal';
  const font = `${weight} ${fontSize}px Arial`;
  
  layer.data.font = font;
  layer.data.color = color;

  // Measure updated text dimensions
  this.ctx.font = font;
  const metrics = this.ctx.measureText(layer.data.text);
  layer.data.width = metrics.width;
  layer.data.height = fontSize; // Approximate height = font size

  this.redraw();
}



cancelEdit() {
  this.editingLayerIndex = null;
}
}



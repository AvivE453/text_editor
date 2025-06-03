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
  order: number;
  visible: boolean;
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
  showPolygonDialog = false;
  counter = 0;

  selectedTextLayer: Layer | null = null;
  editingLayerIndex: number | null = null;
  polygonEditingLayerIndex: number | null = null;

  editOptions = {
    bold: false,
    fontSize: 16,
    color: '#000000'
  };

  polygonEditOptions = {
    size: 50,
    color: '#000000',
    thickness: 1
  };

  isDraggingText = false;
  isDraggingPolygon = false;
  selectedPolygonLayer: Layer | null = null;
  offsetX = 0;
  offsetY = 0;

  ngOnInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
  }

  getMousePos(event: MouseEvent): Point {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  openAddPolygonDialog() {
    this.showPolygonDialog = true;
  }

  closeAddPolygonDialog() {
    this.showPolygonDialog = false;
  }

startDraw(event: MouseEvent) {
  const pos = this.getMousePos(event);

  for (let i = this.layers.length - 1; i >= 0; i--) {
    const layer = this.layers[i];

    if (layer.type === 'text' && layer.visible !== false) {
      const { position, width, height } = layer.data;
      if (
        pos.x >= position.x &&
        pos.x <= position.x + width &&
        pos.y >= position.y - height &&
        pos.y <= position.y
      ) {
        this.selectedTextLayer = layer;
        this.isDraggingText = true;
        this.offsetX = pos.x - position.x;
        this.offsetY = pos.y - position.y;
        return;
      }
    }

    if (layer.type === 'polygon' && layer.visible !== false) {
      const data = layer.data;
      if (data.points) {
        // Check if point is inside polygon
        if (this.isPointInPolygon(pos, data.points)) {
          this.selectedPolygonLayer = layer;
          this.isDraggingPolygon = true;
          this.offsetX = pos.x - data.center.x;
          this.offsetY = pos.y - data.center.y;
          return;
        }
      } else if (data.center && data.radius) {
        // Check if point is inside circle
        const distance = Math.hypot(pos.x - data.center.x, pos.y - data.center.y);
        if (distance <= data.radius) {
          this.selectedPolygonLayer = layer;
          this.isDraggingPolygon = true;
          this.offsetX = pos.x - data.center.x;
          this.offsetY = pos.y - data.center.y;
          return;
        }
      }
    }
  }
}

isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}


  draw(event: MouseEvent) {
    if (this.isDraggingText && this.selectedTextLayer) {
      const pos = this.getMousePos(event);
      this.selectedTextLayer.data.position.x = pos.x - this.offsetX;
      this.selectedTextLayer.data.position.y = pos.y - this.offsetY;
      this.redraw();
      return;
    }

    if (this.isDraggingPolygon && this.selectedPolygonLayer) {
      const pos = this.getMousePos(event);
      const layer = this.selectedPolygonLayer;
      const dx = pos.x - this.offsetX - layer.data.center.x;
      const dy = pos.y - this.offsetY - layer.data.center.y;

      // Move center
      layer.data.center.x += dx;
      layer.data.center.y += dy;

      // Move points
      if (layer.data.points) {
        layer.data.points = layer.data.points.map((p: Point) => ({
          x: p.x + dx,
          y: p.y + dy
        }));
      }

      this.redraw();
      return;
    }
  }

  endDraw() {
    if (this.isDraggingText) {
      this.isDraggingText = false;
      this.selectedTextLayer = null;
    }
    if (this.isDraggingPolygon) {
      this.isDraggingPolygon = false;
      this.selectedPolygonLayer = null;
    }
  }

  redraw() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.baseImage) {
      this.ctx.drawImage(this.baseImage, 0, 0, canvas.width, canvas.height);
    }

    this.layers.forEach(layer => {
      if (!layer.visible) return;
      if (layer.type === 'polygon') {
        this.drawPolygon(layer.data);
      } else if (layer.type === 'text') {
        this.drawText(layer.data.text, layer.data.position);
      }
    });
  }

  drawPolygon(data: any) {
    this.ctx.strokeStyle = data.color || '#000000';
    this.ctx.lineWidth = data.thickness || 1;

    if (data.center && data.radius) {
      this.ctx.beginPath();
      this.ctx.arc(data.center.x, data.center.y, data.radius, 0, 2 * Math.PI);
      this.ctx.stroke();
    } else if (data.points && data.points.length > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(data.points[0].x, data.points[0].y);
      data.points.slice(1).forEach((p: Point) => this.ctx.lineTo(p.x, p.y));
      this.ctx.closePath();
      this.ctx.stroke();
    }
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

  addTextLayer() {
    const text = prompt('Enter text:');
    if (!text) return;
    const defaultFont = '16px Arial';
    this.ctx.font = defaultFont;
    const width = this.ctx.measureText(text).width;
    const height = 16;
    this.layers.push({
      type: 'text',
      data: { text, position: { x: 100, y: 100 }, font: defaultFont, color: '#000000', width, height },
      order: this.counter++,
      visible: true
    });
    this.redraw();
  }

  addSquareLayer() {
    const size = 100;
    const startX = 100;
    const startY = 100;
    const center = { x: startX + size / 2, y: startY + size / 2 };
    const points: Point[] = [
      { x: center.x - size / 2, y: center.y - size / 2 },
      { x: center.x + size / 2, y: center.y - size / 2 },
      { x: center.x + size / 2, y: center.y + size / 2 },
      { x: center.x - size / 2, y: center.y + size / 2 },
      { x: center.x - size / 2, y: center.y - size / 2 }
    ];
    this.layers.push({
      type: 'polygon',
      data: { points, center, color: '#000000', thickness: 1 },
      order: this.counter++,
      visible: true
    });
    this.showPolygonDialog = false;
    this.redraw();
  }

  addTriangleLayer() {
    const size = 100;
    const startX = 100;
    const startY = 100;
    const points: Point[] = [
      { x: startX, y: startY },
      { x: startX + size, y: startY },
      { x: startX + size / 2, y: startY - size },
      { x: startX, y: startY }
    ];
    const centerX = (startX + startX + size + startX + size / 2) / 3;
    const centerY = (startY + startY + startY - size) / 3;
    const center = { x: centerX, y: centerY };
    this.layers.push({
      type: 'polygon',
      data: { points, center, color: '#000000', thickness: 1 },
      order: this.counter++,
      visible: true
    });
    this.showPolygonDialog = false;
    this.redraw();
  }

  addCircleLayer() {
    const centerX = 200;
    const centerY = 200;
    const radius = 50;
    this.layers.push({
      type: 'polygon',
      data: { center: { x: centerX, y: centerY }, radius, color: '#000000', thickness: 1 },
      order: this.counter++,
      visible: true
    });
    this.showPolygonDialog = false;
    this.redraw();
  }

  handleEdit(index: number) {
    const layer = this.layers[index];
    if (layer.type === 'text') {
      this.editingLayerIndex = index;
      this.polygonEditingLayerIndex = null;
      const { font = '16px Arial', color = '#000000' } = layer.data;
      const sizeMatch = font.match(/(\d+)px/);
      this.editOptions = {
        bold: font.includes('bold'),
        fontSize: sizeMatch ? parseInt(sizeMatch[1]) : 16,
        color
      };
    } else if (layer.type === 'polygon') {
      this.polygonEditingLayerIndex = index;
      this.editingLayerIndex = null;
      const { color = '#000000', thickness = 1 } = layer.data;
      this.polygonEditOptions = {
        size: 50,
        color,
        thickness
      };
    }
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
    this.ctx.font = font;
    const metrics = this.ctx.measureText(layer.data.text);
    layer.data.width = metrics.width;
    layer.data.height = fontSize;
    this.redraw();
  }

  updatePolygonLiveEdit() {
  if (this.polygonEditingLayerIndex === null) return;
  const layer = this.layers[this.polygonEditingLayerIndex];
  if (layer.type !== 'polygon') return;

  // Apply color and thickness
  layer.data.color = this.polygonEditOptions.color;
  layer.data.thickness = this.polygonEditOptions.thickness;

  const size = 2 * this.polygonEditOptions.size;
  const center = layer.data.center;

  if (layer.data.points) {

    if (layer.data.points.length === 5) {
      // Square
      layer.data.points = [
        { x: center.x - size, y: center.y - size },
        { x: center.x + size, y: center.y - size },
        { x: center.x + size, y: center.y + size },
        { x: center.x - size, y: center.y + size },
        { x: center.x - size, y: center.y - size }
      ];
    } else if (layer.data.points.length === 4) {
      // Triangle
      layer.data.points = [
        { x: center.x, y: center.y - size },
        { x: center.x + size, y: center.y + size },
        { x: center.x - size, y: center.y + size },
        { x: center.x, y: center.y - size }
      ];
    }
  } else if (layer.data.radius !== undefined) {
    layer.data.radius = size
  }

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
        this.layers = JSON.parse(e.target.result as string);
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
    this.layers = [];
    this.redraw();
  }

  handleDelete(index: number) {
    this.layers.splice(index, 1);
    this.redraw();
  }

  handleToggleVisibility(index: number) {
    this.layers[index].visible = !this.layers[index].visible;
    this.redraw();
  }

  cancelEdit() {
    this.editingLayerIndex = null;
  }

  cancelPolygonEdit() {
    this.polygonEditingLayerIndex = null;
  }
}

import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LayersComponent } from './layers/layers.component';

interface Point {
  x: number;
  y: number;
}

interface Layer {
  type: 'polygon' | 'text' | 'draw';
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
export class AppComponent { //references to elements in the HTML
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput', { static: false }) imageInputRef!: ElementRef<HTMLInputElement>;

  baseImage: HTMLImageElement | null = null;
  ctx!: CanvasRenderingContext2D;
  drawing = false;
  @Input() layers: Layer[] = [];
  isAddShapeDialogOpen = false;
  counter = 0;


  currentMode: 'move' | 'draw' = 'move';

  currentStroke: Point[] = [];
  selectedTextLayer: Layer | null = null;
  editingLayerIndex: number | null = null;
  selectedPolygonLayer: Layer | null = null;
  polygonEditingLayerIndex: number | null = null;
  selectedDrawLayer: Layer | null = null;
  drawEditingLayerIndex: number | null = null;

  
  dragStartMouse: Point = { x: 0, y: 0 }; 
  dragStartPoints: Point[] = []; //data of the stroke’s points at drag start 

  editOptions = {
    bold: false,
    fontSize: 16,
    color: '#000000'
  };

  polygonEditOptions = {
    size: 50,
    color: '#000000',
    fillColor: 'transparent',
    thickness: 1
  };

    drawOptions = {
    color: '#000000',
    thickness: 2
  };

  isDraggingText = false;
  isDraggingPolygon = false;
  isDraggingDrawLayer = false;
  offsetX = 0;
  offsetY = 0;





  ngOnInit() { //conecting the canvas and they layers 
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
  }

  getMousePos(event: MouseEvent): Point { //mouse position in the canvas 
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  openAddPolygonDialog() {
    this.isAddShapeDialogOpen = true;
  }

  closeAddPolygonDialog() {
    this.isAddShapeDialogOpen = false;
  }

  startMove(event: MouseEvent) {// check if we clicked on text or polygon layers 
    const pos = this.getMousePos(event);

    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];

      if (layer.type === 'text' && layer.visible !== false) { //  newest layer is first
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
          // triangle and square polygon
          if (this.isPointInPolygon(pos, data.points)) {
            this.selectedPolygonLayer = layer;
            this.isDraggingPolygon = true;
            this.offsetX = pos.x - data.center.x;
            this.offsetY = pos.y - data.center.y;
            return;
          }
        } else if (data.center && data.radius) {
          //  circle
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

      if (layer.type === 'draw' && layer.visible !== false) {
        const points = layer.data.points as Point[];
        const threshold = (layer.data.thickness || 1) * 2;
        
        // scan each segment
        for (let j = 0; j < points.length - 1; j++) {
          const A = points[j], B = points[j+1];
          // distance from click to segment AB
          const dx = B.x - A.x, dy = B.y - A.y;
          const t = ((pos.x - A.x)*dx + (pos.y - A.y)*dy) / (dx*dx + dy*dy);
          let closest: Point;
          if (t < 0)       closest = A;
          else if (t > 1)  closest = B;
          else             closest = { x: A.x + t*dx, y: A.y + t*dy };
          const dist = Math.hypot(pos.x - closest.x, pos.y - closest.y);
          
          if (dist <= threshold) {
            // — we hit the stroke at segment j!
            this.selectedDrawLayer    = layer;
            this.isDraggingDrawLayer  = true;
            // store starting mouse + points snapshot
            this.dragStartMouse       = pos;
            this.dragStartPoints      = points.map(p => ({ x: p.x, y: p.y }));
            return;
          }
        }
      }

    }
  }

  isPointInPolygon(point: Point, polygon: Point[]): boolean { //checking if point is in the polygon using point clipping
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) && //check if the point is between yi and yj and not above or below 
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi + 0.00001) + xi); //checking if we are in the right side from the edge
      if (intersect) inside = !inside;
    }
    return inside;
  }


  move(event: MouseEvent) {
    if (this.isDraggingText && this.selectedTextLayer) {
      const pos = this.getMousePos(event);
      this.selectedTextLayer.data.position.x = pos.x - this.offsetX;
      this.selectedTextLayer.data.position.y = pos.y - this.offsetY;
      this.redraw(); // in every movment of the polygon we drwing the canvas layers again  
    }

    if (this.isDraggingPolygon && this.selectedPolygonLayer) {
      const pos = this.getMousePos(event);
      const layer = this.selectedPolygonLayer;
      const dx = pos.x - this.offsetX - layer.data.center.x;
      const dy = pos.y - this.offsetY - layer.data.center.y;

      // updating center
      layer.data.center.x += dx;
      layer.data.center.y += dy;

      // updating points of polygons (if needed)
      if (layer.data.points) {
        layer.data.points = layer.data.points.map((p: Point) => ({
          x: p.x + dx,
          y: p.y + dy
        }));
      }

      this.redraw();
    }

    if (this.isDraggingDrawLayer && this.selectedDrawLayer) {
      const pos = this.getMousePos(event);
      const dx  = pos.x - this.dragStartMouse.x;
      const dy  = pos.y - this.dragStartMouse.y;

      // rebuild the stroke from the starting point
      this.selectedDrawLayer.data.points =
        this.dragStartPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
      this.redraw();
      return;  
    }
  }




  endMove() {
    if (this.isDraggingText) {
      this.isDraggingText = false;
      this.selectedTextLayer = null;
    }
    if (this.isDraggingPolygon) {
      this.isDraggingPolygon = false;
      this.selectedPolygonLayer = null;
    }
    if (this.isDraggingDrawLayer) {
      this.isDraggingDrawLayer = false;
      this.selectedDrawLayer   = null;
    }
  }

  //////////////////////////////////////////draw ///////////////////////////////////////////

  onPointerDown(evt: MouseEvent) {
    if (this.currentMode === 'draw') {
      // Start a new freehand stroke
      this.drawing = true;
      this.currentStroke = [ this.getMousePos(evt) ];
    } else {
      this.startMove(evt); // dragging
    }
  }

  onPointerMove(evt: MouseEvent) {
    if (this.currentMode === 'draw' && this.drawing) {
      const pos = this.getMousePos(evt);
      const points = this.currentStroke;
      const prev = points[points.length - 1];
      points.push(pos);

      // Draw the latest segment immediately for updating live
      this.ctx.strokeStyle = this.drawOptions.color;     
      this.ctx.lineWidth   = this.drawOptions.thickness;
      this.ctx.beginPath(); 
      this.ctx.moveTo(prev.x, prev.y);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    } else {
      this.move(evt); // dragging
    }
  }

  onPointerUp() {
    if (this.currentMode === 'draw' && this.drawing) {
      // add the new layer
      this.layers.push({
        type: 'draw',
        data: {
          points: [...this.currentStroke],
          color: this.drawOptions.color,
          thickness: this.drawOptions.thickness
        },
        order: this.counter++,
        visible: true
      });

      this.drawing = false;
      this.currentStroke = [];
      this.redraw();
    } else {
      this.endMove(); // end dragging
    }
  }








  // every time there is a change in the layers ,we redraw all the layers on the canvas by using ctx.
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
      } else if (layer.type === 'draw') {
        this.drawFreehand(layer.data);
      }
    });
  }

 
drawPolygon(data: any) { // we rendereing the whole canvas so each time we create a new polygon or edditing we have different setting for it 
  this.ctx.strokeStyle = data.color || '#000000';
  this.ctx.lineWidth = data.thickness || 1;
  this.ctx.fillStyle = data.fillColor || 'transparent';  // Default: no fill

  if (data.center && data.radius) {
    this.ctx.beginPath();
    this.ctx.arc(data.center.x, data.center.y, data.radius, 0, 2 * Math.PI);
    this.ctx.fill();   
    this.ctx.stroke(); 
  } else if (data.points && data.points.length > 0) {
    this.ctx.beginPath();
    this.ctx.moveTo(data.points[0].x, data.points[0].y);
    data.points.slice(1).forEach((p: Point) => this.ctx.lineTo(p.x, p.y));
    this.ctx.closePath();
    this.ctx.fill();   // fill inside
    this.ctx.stroke(); // draw border
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



  drawFreehand(data: { points: Point[]; color: string; thickness: number }) {
    const points = data.points;
    if (points.length < 2) return;

    this.ctx.strokeStyle = data.color;
    this.ctx.lineWidth   = data.thickness;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.stroke();
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
      data: { text, position: { x: 200, y: 200 }, font: defaultFont, color: '#000000', width, height },
      order: this.counter++,
      visible: true
    });
    this.redraw();
  }

  addSquareLayer() {
    const size = 100;
    const startX = 200;
    const startY = 200;
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
      data: { points, center, color: '#000000', fillColor: 'transparent', thickness: 1 },
      order: this.counter++,
      visible: true
    });
    this.isAddShapeDialogOpen = false;
    this.redraw();
  }

  addTriangleLayer() {
    const size = 100;
    const startX = 200;
    const startY = 200;
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
      data: { points, center, color: '#000000', fillColor: 'transparent', thickness: 1 },
      order: this.counter++,
      visible: true
    });
    this.isAddShapeDialogOpen = false;
    this.redraw();
  }

  addCircleLayer() {
    const centerX = 300;
    const centerY = 300;
    const radius = 50;
    this.layers.push({
      type: 'polygon',
      data: { center: { x: centerX, y: centerY }, radius, color: '#000000', fillColor: 'transparent', thickness: 1 },
      order: this.counter++,
      visible: true
    });
    this.isAddShapeDialogOpen = false;
    this.redraw();
  }

  handleEdit(index: number) { // updating the edit of polygon text or draw
    const layer = this.layers[index];
    if (layer.type === 'text') {
      this.editingLayerIndex = index;
      this.polygonEditingLayerIndex = null;
      this.drawEditingLayerIndex = null;
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
      this.drawEditingLayerIndex = null;
      const { color = '#000000', thickness = 1 } = layer.data;
      this.polygonEditOptions = {
        size: 50,
        color,
        fillColor: 'transparent',
        thickness
      };
    } else if (layer.type === 'draw') {
      this.drawEditingLayerIndex    = index;
      this.editingLayerIndex        = null;
      this.polygonEditingLayerIndex = null;
      this.drawOptions = {
        color:     layer.data.color,
        thickness: layer.data.thickness
      };

      this.currentMode = 'move'; // switch to move mode if needed so the edit toolbar shows
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
    layer.data.fillColor = this.polygonEditOptions.fillColor;
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

  updateDrawLiveEdit() {
    if (this.drawEditingLayerIndex === null) return;
    const layer = this.layers[this.drawEditingLayerIndex];
    layer.data.color     = this.drawOptions.color;
    layer.data.thickness = this.drawOptions.thickness;
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
    this.fileInputRef.nativeElement.value = ''; // for loading same layers after clear 
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

  cancelDrawEdit() {
    this.drawEditingLayerIndex = null;
  }
}
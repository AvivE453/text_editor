import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LayersComponent } from './layers/layers.component';

interface Point {
  x: number;
  y: number;
}

type ItemType =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'freehand'
  | 'polygonPoints'
  | 'text';

  export interface Item {
  subType: ItemType; // what kind of thing this is
  data: any; // the old data blob you were using
  order: number;
  visible: boolean;
  }

export interface Layer {
  type: 'polygon' | 'text';
  // data: any;
  order: number;
  visible: boolean;
  items: Array<Item>;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [FormsModule, CommonModule, LayersComponent],
})
export class AppComponent {
  //references to elements in the HTML
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false })
  fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput', { static: false })
  imageInputRef!: ElementRef<HTMLInputElement>;

  baseImage: HTMLImageElement | null = null;
  ctx!: CanvasRenderingContext2D;
  @Input() layers: Layer[] = [];
  currentLayerIndex: number = -1;
  isdrawing = false;
  isAddShapeDialogOpen = false;
  isDrawingPolygonByClick = false;
  isDraggingText = false;
  isDraggingPolygon = false;
  isDraggingDrawLayer = false;
  offsetX = 0;
  offsetY = 0;
  counter = 0;

  currentMode: 'move' | 'draw' | 'polygonPoints' = 'move';
  selectedLayer: 'text' | 'polygon' = 'text';
  currentDrawPoints: Point[] = []; // points to draw with by hand
  currentPolygonPoints: Point[] = []; // points to draw polygon
  selectedTextLayer: Item | null = null; // selected text layer
  editingLayerIndex: number | null = null;
  selectedPolygonLayer: Item | null = null;
  polygonEditingLayerIndex: number | null = null;
  selectedDrawLayer: Item | null = null;
  drawEditingLayerIndex: number | null = null;

  dragStartMouse: Point = { x: 0, y: 0 };
  dragStartPoints: Point[] = []; //data for draw by hand points location when dragging

  editOptions = {
    bold: false,
    fontSize: 16,
    color: '#000000',
  };

  polygonEditOptions = {
    size: 50,
    color: '#000000',
    fillColor: 'transparent',
    thickness: 1,
  };

  drawOptions = {
    color: '#000000',
    thickness: 2,
  };

  addNewLayer(selected: 'text' | 'polygon' = 'text') {
    this.layers.push({
      items: [],
      type: selected,
      order: this.counter++,
      visible: true,
    });
    this.currentLayerIndex = this.layers.length - 1;
    this.redraw();   // ← add this line

  }

  ngOnInit() {
    //conecting the canvas and they layers
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
  }

  getMousePos(event: MouseEvent): Point {
    //mouse position in the canvas
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  openAddPolygonDialog() {
    this.isAddShapeDialogOpen = true;
  }

  closeAddPolygonDialog() {
    this.isAddShapeDialogOpen = false;
  }

  enterPolygonByClickMode() {
    // close the standard “Add Shape” dialog
    this.isAddShapeDialogOpen = false;
    this.currentMode = 'polygonPoints';
    this.currentPolygonPoints = [];
    this.isDrawingPolygonByClick = true;
  }

  onCanvasClick(evt: MouseEvent) {
    if (this.currentMode === 'polygonPoints') {
      const pt = this.getMousePos(evt);
      this.currentPolygonPoints.push(pt);

      // 1) redraw background layers
      this.redraw();

      // 2) set your live-draw style
      this.ctx.strokeStyle = this.polygonEditOptions.color;
      this.ctx.lineWidth = this.polygonEditOptions.thickness;

      // 3) draw the entire polyline so far
      if (this.currentPolygonPoints.length > 1) {
        this.ctx.beginPath();
        const pts = this.currentPolygonPoints;
        this.ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach((p) => this.ctx.lineTo(p.x, p.y));
        this.ctx.stroke();
      }
    } else {
      this.startMove(evt);
    }
  }

  onCanvasDblClick(evt: MouseEvent) {
    if (
      this.currentMode === 'polygonPoints' &&
      this.currentPolygonPoints.length >= 3
    ) {
      // close the loop
      const pts = [...this.currentPolygonPoints, this.currentPolygonPoints[0]];
      // compute centroid
      const center = pts.slice(0, -1).reduce(
        (c, p, i, arr) => ({
          x: c.x + p.x / arr.length,
          y: c.y + p.y / arr.length,
        }),
        { x: 0, y: 0 }
      );
      // push new item
      this.layers[this.currentLayerIndex].items.push({
        subType: 'polygonPoints',
        data: {
          points: pts,
          center,
          color: this.polygonEditOptions.color,
          fillColor: this.polygonEditOptions.fillColor,
          thickness: this.polygonEditOptions.thickness,
        },
        order: this.counter++,
        visible: true,
      });
      // reset
      this.currentPolygonPoints = [];
      this.isDrawingPolygonByClick = false;
      this.endMove();
      this.currentMode = 'move';
      this.redraw();
    }
  }

  startMove(event: MouseEvent) {
    // check if we clicked on text or polygon layers
    const pos = this.getMousePos(event);

    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      for (let j = layer.items.length - 1; j >= 0; j--) {
      const item = layer.items[j];
      if (layer.type === 'text' && layer.visible !== false) {
        //  newest layer is first
        const { position, width, height } = item.data;
        if (
          pos.x >= position.x &&
          pos.x <= position.x + width &&
          pos.y >= position.y - height &&
          pos.y <= position.y
        ) {
          this.selectedTextLayer = item;
          this.isDraggingText = true;
          this.offsetX = pos.x - position.x;
          this.offsetY = pos.y - position.y;
          return;
        }
      }

      if (
        (layer.type === 'polygon' || item.subType === 'polygonPoints') &&
        layer.visible !== false
      ) {
        const data = item.data;
        if (data.points) {
          // triangle and square polygon
          if (this.isPointInPolygon(pos, data.points)) {
            this.selectedPolygonLayer = item;
            this.isDraggingPolygon = true;
            this.offsetX = pos.x - data.center.x;
            this.offsetY = pos.y - data.center.y;
            return;
          }
        } else if (data.center && data.radius) {
          //  circle
          const distance = Math.hypot(
            pos.x - data.center.x,
            pos.y - data.center.y
          );
          if (distance <= data.radius) {
            this.selectedPolygonLayer = item;
            this.isDraggingPolygon = true;
            this.offsetX = pos.x - data.center.x;
            this.offsetY = pos.y - data.center.y;
            return;
          }
        }
      }

      if (item.subType === 'freehand' && layer.visible !== false) {
        const points = item.data.points as Point[];
        const threshold = (item.data.thickness || 1) * 2;

        // scan each segment
        for (let j = 0; j < points.length - 1; j++) {
          const A = points[j],
            B = points[j + 1];
          // distance from click to segment AB
          const dx = B.x - A.x,
            dy = B.y - A.y;
          const t =
            ((pos.x - A.x) * dx + (pos.y - A.y) * dy) / (dx * dx + dy * dy);
          let closest: Point;
          if (t < 0) closest = A;
          else if (t > 1) closest = B;
          else closest = { x: A.x + t * dx, y: A.y + t * dy };
          const dist = Math.hypot(pos.x - closest.x, pos.y - closest.y);

          if (dist <= threshold) {
            // — we hit the stroke at segment j!
            this.selectedDrawLayer = item;
            this.isDraggingDrawLayer = true;
            // store starting mouse + points snapshot
            this.dragStartMouse = pos;
            this.dragStartPoints = points.map((p) => ({ x: p.x, y: p.y }));
            return;
          }}
        }
      }
    }
  }

  isPointInPolygon(point: Point, polygon: Point[]): boolean {
    //checking if point is in the polygon using point clipping
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x,
        yi = polygon[i].y;
      const xj = polygon[j].x,
        yj = polygon[j].y;
      const intersect =
        yi > point.y !== yj > point.y && //check if the point is between yi and yj and not above or below
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 0.00001) + xi; //checking if we are in the right side from the edge
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
      const item = this.selectedPolygonLayer;
      const dx = pos.x - this.offsetX - item.data.center.x;
      const dy = pos.y - this.offsetY - item.data.center.y;

      // updating center
      item.data.center.x += dx;
      item.data.center.y += dy;

      // updating points of polygons (if needed)
      if (item.data.points) {
        item.data.points = item.data.points.map((p: Point) => ({
          x: p.x + dx,
          y: p.y + dy,
        }));
      }

      this.redraw();
    }

    if (this.isDraggingDrawLayer && this.selectedDrawLayer) {
      const pos = this.getMousePos(event);
      const dx = pos.x - this.dragStartMouse.x;
      const dy = pos.y - this.dragStartMouse.y;

      // rebuild the stroke from the starting point
      this.selectedDrawLayer.data.points = this.dragStartPoints.map((p) => ({
        x: p.x + dx,
        y: p.y + dy,
      }));
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
      this.selectedDrawLayer = null;
    }
  }

  //////////////////////////////////////////draw ///////////////////////////////////////////

  onPointerDown(evt: MouseEvent) {
    if (this.currentMode === 'draw') {
      // Start a new freehand stroke
      this.isdrawing = true;
      this.currentDrawPoints = [this.getMousePos(evt)];
    } else {
      this.startMove(evt); // dragging
    }
  }

  onPointerMove(evt: MouseEvent) {
    if (this.currentMode === 'draw' && this.isdrawing) {
      const pos = this.getMousePos(evt);
      const points = this.currentDrawPoints;
      const prev = points[points.length - 1];
      points.push(pos);

      // Draw the latest segment immediately for updating live
      this.ctx.strokeStyle = this.drawOptions.color;
      this.ctx.lineWidth = this.drawOptions.thickness;
      this.ctx.beginPath();
      this.ctx.moveTo(prev.x, prev.y);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    } else {
      this.move(evt); // dragging
    }
  }

  onPointerUp() {
    if (this.currentMode === 'draw' && this.isdrawing) {
      // add the new layer
      this.layers[this.currentLayerIndex].items.push({
        subType: 'freehand',
        data: {
          points: [...this.currentDrawPoints],
          color: this.drawOptions.color,
          thickness: this.drawOptions.thickness,
        },
         order: this.counter++,
        visible: true,
      });

      this.isdrawing = false;
      this.currentDrawPoints = [];
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

    this.layers.forEach((layer, index) => {
      if (!layer.visible) return;
      layer.items.forEach((item) => {
      if (!item.visible) return; // skip invisible items
      if (item.subType === 'circle' || item.subType === 'triangle' || item.subType === 'square' || item.subType === 'polygonPoints') {
        this.drawPolygon(item.data);
      } else if (item.subType === 'text') {
        this.drawText(item.data.text, item.data.position, index);
      } else if (item.subType === 'freehand') {
        this.drawFreehand(item.data);
      }})
    });
  }

  drawPolygon(data: any) {
    // we rendereing the whole canvas so each time we create a new polygon or edditing we have different setting for it
    this.ctx.strokeStyle = data.color || '#000000';
    this.ctx.lineWidth = data.thickness || 1;
    this.ctx.fillStyle = data.fillColor || 'transparent'; // Default: no fill

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
      this.ctx.fill(); // fill inside
      this.ctx.stroke(); // draw border
    }
  }

  drawText(text: string, position: { x: number; y: number }, index : number) {
    const item = this.layers[index].items.find(
      (item) =>
        item.data.text === text &&
        item.data.position.x === position.x &&
        item.data.position.y === position.y
    );
    if (!item) return;
    this.ctx.font = item.data.font || '16px Arial';
    this.ctx.fillStyle = item.data.color || '#000000';
    this.ctx.fillText(text, position.x, position.y);
  }

  drawFreehand(data: { points: Point[]; color: string; thickness: number }) {
    const points = data.points;
    if (points.length < 2) return;

    this.ctx.strokeStyle = data.color;
    this.ctx.lineWidth = data.thickness;
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
    this.layers[this.currentLayerIndex].items.push({
      data: {
        text,
        position: { x: 200, y: 200 },
        font: defaultFont,
        color: '#000000',
        width,
        height,
      },
      subType: 'text',
       order: this.counter++,
        visible: true,
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
      { x: center.x - size / 2, y: center.y - size / 2 },
    ];
    this.layers[this.currentLayerIndex].items.push({
      subType: 'square',
      data: {
        points,
        center,
        color: '#000000',
        fillColor: 'transparent',
        thickness: 1,
      },
       order: this.counter++,
        visible: true,
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
      { x: startX, y: startY },
    ];
    const centerX = (startX + startX + size + startX + size / 2) / 3;
    const centerY = (startY + startY + startY - size) / 3;
    const center = { x: centerX, y: centerY };
    this.layers[this.currentLayerIndex].items.push({
      subType: 'triangle',
      data: {
        points,
        center,
        color: '#000000',
        fillColor: 'transparent',
        thickness: 1,
      },
       order: this.counter++,
        visible: true,
    });
    this.isAddShapeDialogOpen = false;
    this.redraw();
  }

  addCircleLayer() {
    const centerX = 300;
    const centerY = 300;
    const radius = 50;
    this.layers[this.currentLayerIndex].items.push({
      subType: 'circle',
      data: {
        center: { x: centerX, y: centerY },
        radius,
        color: '#000000',
        fillColor: 'transparent',
        thickness: 1,
      },
       order: this.counter++,
        visible: true,

    });
    this.isAddShapeDialogOpen = false;
    this.redraw();
  }

  handleItemEdit(layerIndex: number ,index: number) {
    // updating the edit of polygon text or draw
    const item = this.layers[this.currentLayerIndex].items[index];
    if (item.subType === 'text') {
      this.editingLayerIndex = index;
      this.polygonEditingLayerIndex = null;
      this.drawEditingLayerIndex = null;
      const { font = '16px Arial', color = '#000000' } = item.data;
      const sizeMatch = font.match(/(\d+)px/);
      this.editOptions = {
        bold: font.includes('bold'),
        fontSize: sizeMatch ? parseInt(sizeMatch[1]) : 16,
        color,
      };
    } else if (item.subType === 'polygonPoints' || item.subType === 'triangle' || item.subType === 'square' || item.subType === 'circle' ) {
      this.polygonEditingLayerIndex = index;
      this.editingLayerIndex = null;
      this.drawEditingLayerIndex = null;
      const {
        color = '#000000',
        fillColor = 'transparent',
        thickness = 1,
      } = item.data;
      this.polygonEditOptions = {
        size: 50,
        color,
        fillColor,
        thickness,
      };
    } else if (item.subType ==='freehand') {
      this.drawEditingLayerIndex = index;
      this.editingLayerIndex = null;
      this.polygonEditingLayerIndex = null;
      this.drawOptions = {
        color: item.data.color,
        thickness: item.data.thickness,
      };

      this.currentMode = 'move'; // switch to move mode if needed so the edit toolbar shows
    }
  }

  updateLiveEdit() {
    if (this.editingLayerIndex === null) return;
    const item = this.layers[this.currentLayerIndex].items[this.editingLayerIndex];
    if (item.subType !== 'text') return;
    const { bold, fontSize, color } = this.editOptions;
    const weight = bold ? 'bold' : 'normal';
    const font = `${weight} ${fontSize}px Arial`;
    item.data.font = font;
    item.data.color = color;
    this.ctx.font = font;
    const metrics = this.ctx.measureText(item.data.text);
    item.data.width = metrics.width;
    item.data.height = fontSize;
    this.redraw();
  }

  updatePolygonLiveEdit() {
    if (this.polygonEditingLayerIndex === null) return;
    const item = this.layers[this.currentLayerIndex].items[this.polygonEditingLayerIndex];
    if (item.subType === 'text' || item.subType === 'freehand')
       return;

    // Apply color and thickness
    item.data.color = this.polygonEditOptions.color;
    item.data.fillColor = this.polygonEditOptions.fillColor;
    item.data.thickness = this.polygonEditOptions.thickness;

    const size = 2 * this.polygonEditOptions.size;
    const center = item.data.center;

    if (item.data.points) {
      if (item.subType === 'square') {
        // Square
        item.data.points = [
          { x: center.x - size, y: center.y - size },
          { x: center.x + size, y: center.y - size },
          { x: center.x + size, y: center.y + size },
          { x: center.x - size, y: center.y + size },
          { x: center.x - size, y: center.y - size },
        ];
      } else if (item.subType === 'triangle') {
        // Triangle
        item.data.points = [
          { x: center.x, y: center.y - size },
          { x: center.x + size, y: center.y + size },
          { x: center.x - size, y: center.y + size },
          { x: center.x, y: center.y - size },
        ];
      }
    } else if (item.data.radius !== undefined) {
      item.data.radius = size;
    }

    this.redraw();
  }

  updateDrawLiveEdit() {
    if (this.drawEditingLayerIndex === null) return;
    const item = this.layers[this.currentLayerIndex].items[this.drawEditingLayerIndex];
    item.data.color = this.drawOptions.color;
    item.data.thickness = this.drawOptions.thickness;
    this.redraw();
  }

  saveLayers() {
    const dataStr = JSON.stringify(this.layers[this.currentLayerIndex]);
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
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e: ProgressEvent<FileReader>) => {
    try {
      const text = e.target?.result as string;
      const parsed = JSON.parse(text);

      if (Array.isArray(parsed)) {
        // Replace entire layers list
        this.layers = parsed;
      } else {
        // Single-layer JSON: append it
        this.layers.push(parsed);
      }

      // Select the first layer if any
      this.currentLayerIndex = this.layers.length > 0 ? 0 : -1;
      this.redraw();
    } catch (err) {
      console.error('Failed to load layers:', err);
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
    reader.onload = (e) => {
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

  handleLayerDelete(index: number) {
    this.layers.splice(index, 1);
    this.currentLayerIndex --;
    this.redraw();
  }

  handleLayerToggle(index: number) {
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

  handleItemDelete(layerIdx: number, itemIdx: number) {
  this.layers[layerIdx].items.splice(itemIdx,1);
  this.redraw();
}

handleItemToggle(layerIdx: number, itemIdx: number) {
  const item = this.layers[layerIdx].items[itemIdx];
  item.visible = !item.visible;
  this.redraw();
}


}

import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LayersComponent } from './layers/layers.component';

interface Point {
  x: number;
  y: number;
}

//A layer can have multiple items, each item can be a different type of polygon or text respectively to layer type.
type ItemType =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'freehand'
  | 'polygonPoints'
  | 'text';

export interface Item {
  subType: ItemType;
  data: any;
  visible: boolean;
}

//A multiple layers can be applied on the canvas (which displays an image), each layer can be a polygon or text.
export interface Layer {
  type: 'polygon' | 'text';
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
//FormsModule is used for ngModel, CommonModule is used for ngIf and ngFor
export class AppComponent {
  //references to elements in the HTML
  //View child grab a reference to a child component
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: false })
  fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput', { static: false })
  imageInputRef!: ElementRef<HTMLInputElement>;

  baseImage: HTMLImageElement | null = null;
  ctx!: CanvasRenderingContext2D; /*The CanvasRenderingContext2D is the primary API for drawing and manipulating 2D graphics
   on an HTML <canvas> element. In brief:
 */
  @Input() layers: Layer[] = []; //The input allows the layers component to receive layers from the app component
  currentLayerIndex: number = -1; //an index of the current layer that is being seleected.
  isdrawing = false; //darwing by hand on the canvas
  isAddShapeDialogOpen = false;
  isDrawingPolygonByClick = false;
  isDraggingText = false;
  isDraggingPolygon = false;
  isDraggingDrawItem = false;
  //offsetX and offsetY are used to calculate the position of the text or polygon when dragging
  offsetX = 0;
  offsetY = 0;

  // Identifies the current mode of interaction with the canvas moving items on canvas, drawing by hand or drawing polygon by points
  currentMode: 'move' | 'draw' | 'polygonPoints' = 'move';
  currentDrawPoints: Point[] = []; // points to draw by hand
  currentPolygonPoints: Point[] = []; // Array of points for drawing polygon by click
  selectedTextItem: Item | null = null; // selected text item
  editingItemIndex: number | null = null;
  selectedPolygonItem: Item | null = null;
  polygonEditingItemIndex: number | null = null;
  selectedDrawItem: Item | null = null;
  drawEditingItemIndex: number | null = null;

  dragStartMouse: Point = { x: 0, y: 0 }; //starting mouse position when dragging in freehand mode
  dragStartPoints: Point[] = []; // starting points of the freehand stroke when draggingS
  selectdDraggingVertex : number = -1; // the vertex that is being dragged in polygon editing mode
  isDraggingVertex = false; // flag to indicate if a vertex is being dragged

  editOptions = {
    //text editing options
    bold: false,
    fontSize: 16,
    color: '#000000',
    text: ''
  };

  polygonEditOptions = {
    // polygon editing options
    size: 50,
    color: '#000000',
    fillColor: 'transparent',
    thickness: 1,
  };

  drawOptions = {
    //freehand drawing options
    color: '#000000',
    thickness: 2,
  };

  ngOnInit() {
    // Initialize the canvas context
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
  }

  addNewLayer(selected: 'text' | 'polygon' = 'text') {
    this.layers.push({
      items: [],
      type: selected, // type of the layer, can be polygon or text, selected by clicking the corrospond button
      visible: true,
    });
    this.currentLayerIndex = this.layers.length - 1;
    this.redraw();
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

  //enter polygon points by click mode
  enterPolygonByClickMode() {
    this.isAddShapeDialogOpen = false;
    this.currentMode = 'polygonPoints';
    this.currentPolygonPoints = [];
    this.isDrawingPolygonByClick = true;
  }

  onCanvasClick(evt: MouseEvent) {
    if (this.currentMode === 'polygonPoints') {
      const point = this.getMousePos(evt);
      this.currentPolygonPoints.push(point);
      this.redraw();
      this.ctx.strokeStyle = this.polygonEditOptions.color;
      this.ctx.lineWidth = this.polygonEditOptions.thickness;
      // Draw the resulting polygon points on the canvas
      if (this.currentPolygonPoints.length > 1) {
        this.ctx.beginPath(); // begin a new path for drawing.
        const points = this.currentPolygonPoints;
        this.ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((p) => this.ctx.lineTo(p.x, p.y));
        this.ctx.stroke();
      }
    } else {
      this.startMove(evt);
    }
  }

  onCanvasDblClick(evt: MouseEvent) {
    if (
      this.currentMode === 'polygonPoints' &&
      this.currentPolygonPoints.length >= 3 // at least 3 points to form a polygon
    ) {
      // close the loop
      const points = [
        ...this.currentPolygonPoints,
        this.currentPolygonPoints[0],
      ];
      // compute center - used for dragging the polygon
      const center = points.slice(0, -1).reduce(
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
          points: points,
          center,
          color: this.polygonEditOptions.color,
          fillColor: this.polygonEditOptions.fillColor,
          thickness: this.polygonEditOptions.thickness,
        },
        visible: true,
      });
      // reset after adding the polygon
      this.currentPolygonPoints = [];
      this.isDrawingPolygonByClick = false;
      this.endMove();
      this.currentMode = 'move';
      this.redraw();
    }
  }

  startMove(event: MouseEvent) {
    // check if we clicked on text or polygon items
    const mousePos = this.getMousePos(event);

    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      for (let j = layer.items.length - 1; j >= 0; j--) {
        const item = layer.items[j];
        if (
          item.subType === 'text' &&
          layer.visible !== false &&
          item.visible !== false
        ) {
          //  newest item is first
          const { position, width, height } = item.data;
          if (
            //find the item that was clicked
            mousePos.x >= position.x &&
            mousePos.x <= position.x + width &&
            mousePos.y >= position.y - height &&
            mousePos.y <= position.y
          ) {
            this.selectedTextItem = item;
            this.isDraggingText = true;
            this.offsetX = mousePos.x - position.x;
            this.offsetY = mousePos.y - position.y;
            return;
          }
        }

        if (
          (layer.type === 'polygon' && item.subType !== 'freehand') &&  layer.visible !== false && item.visible !== false ) {
          const data = item.data;
          if (data.points) {
            // triangle and square polygon
            if (this.isPointInPolygon(mousePos, data.points)) {
              this.selectedPolygonItem = item;
              this.isDraggingPolygon = true;
              this.offsetX = mousePos.x - data.center.x;
              this.offsetY = mousePos.y - data.center.y;
              return;
            }
          } else if (data.center && data.radius) {
            //  circle
            const distance = Math.hypot(
              mousePos.x - data.center.x,
              mousePos.y - data.center.y
            );
            if (distance <= data.radius) { // check if the click does not exceed the radius
              this.selectedPolygonItem = item;
              this.isDraggingPolygon = true;
              this.offsetX = mousePos.x - data.center.x;
              this.offsetY = mousePos.y - data.center.y;
              return;
            }
          }
        }

        if (item.subType === 'freehand' && layer.visible !== false) {
          const points = item.data.points as Point[];
          const threshold = (item.data.thickness || 1) * 2;   // Set a hit threshold based on stroke thickness (twice the thickness)


          // Iterate over each line segment in the stroke
          for (let j = 0; j < points.length - 1; j++) {
            const A = points[j],
              B = points[j + 1];
            // Compute segmrnt length from A to B
            const dx = B.x - A.x,
              dy = B.y - A.y;
             // Project the mouse click onto the line AB (normalized t in [0,1])
            const t =
              ((mousePos.x - A.x) * dx + (mousePos.y - A.y) * dy) /
              (dx * dx + dy * dy);
            let closest: Point;     // Find the closest point on AB to the mouse click
            if (t < 0) closest = A;
            else if (t > 1) closest = B;
            else closest = { x: A.x + t * dx, y: A.y + t * dy }; //Closest point within the segment; using interpolation

            const dist = Math.hypot(
              mousePos.x - closest.x,
              mousePos.y - closest.y
            );

            if (dist <= threshold) { //if within the threshold distance start dragging
              this.selectedDrawItem = item;
              this.isDraggingDrawItem = true;
              // store starting mouse and stroke points for dragging
              this.dragStartMouse = mousePos;
              this.dragStartPoints = points.map((p) => ({ x: p.x, y: p.y })); // create a copy of the points to avoid mutation
              return;
            }
          }
        }
      }
    }
  }

 isPointInPolygon(mousePoint: Point, polygonPoints: Point[]): boolean { //algoithm for clipping points
  let inside = false;
  const len = polygonPoints.length;

  for (let i = 0; i < len; i++) {
    // current vertex
    const { x: xi, y: yi } = polygonPoints[i];
    // next vertex, wrapping back to 0 at the end
    const { x: xj, y: yj } = polygonPoints[(i + 1) % len];

    const crossesY = (yi > mousePoint.y) !== (yj > mousePoint.y);
    if (!crossesY) continue;

    // Compute intersection X without worrying about dividing by zero
    const slope = (xj - xi) / (yj - yi);
    const intersectX = xi + (mousePoint.y - yi) * slope;

  // If the intersection is to the right of the point, flip the flag (points order is clockwise)
    if (mousePoint.x < intersectX) inside = !inside;
  }

  return inside;
}

  move(event: MouseEvent) {
    if (this.isDraggingText && this.selectedTextItem) {
      const pos = this.getMousePos(event);
      this.selectedTextItem.data.position.x = pos.x - this.offsetX;
      this.selectedTextItem.data.position.y = pos.y - this.offsetY;
      this.redraw(); // in every movment of the polygon we drwing the canvas layers again
    }

    if (this.isDraggingPolygon && this.selectedPolygonItem) {
      const pos = this.getMousePos(event);
      const item = this.selectedPolygonItem;
      const dx = pos.x - this.offsetX - item.data.center.x;
      const dy = pos.y - this.offsetY - item.data.center.y;

      // updating center
      item.data.center.x += dx;
      item.data.center.y += dy;

      // updating points of polygons if not circle
      if (item.data.points) {
        item.data.points = item.data.points.map((p: Point) => ({
          x: p.x + dx,
          y: p.y + dy,
        }));
      }

      this.redraw();
    }

    if (this.isDraggingDrawItem && this.selectedDrawItem) {
      const pos = this.getMousePos(event);
      const dx = pos.x - this.dragStartMouse.x;
      const dy = pos.y - this.dragStartMouse.y;

      // rebuild the stroke from the starting point
      this.selectedDrawItem.data.points = this.dragStartPoints.map((p) => ({
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
      this.selectedTextItem = null;
    }
    if (this.isDraggingPolygon) {
      this.isDraggingPolygon = false;
      this.selectedPolygonItem = null;
    }
    if (this.isDraggingDrawItem) {
      this.isDraggingDrawItem = false;
      this.selectedDrawItem = null;
    }
  }

  onPointerDown(evt: MouseEvent) {
  const pos = this.getMousePos(evt);

  //Editing a polygon by clicking on its vertices
  if (this.polygonEditingItemIndex !== null) {
    const layer = this.layers[this.currentLayerIndex];
    const item  = layer.items[this.polygonEditingItemIndex];
    // Check if we clicked on a vertex of the polygon
    if (item.subType === 'polygonPoints') {
      for (let i = 0; i < item.data.points.length; i++) {
        const p = item.data.points[i];
        const d = Math.hypot(pos.x - p.x, pos.y - p.y);
        if (d <= 5) {
          this.selectdDraggingVertex = i;
          this.isDraggingVertex   = true;
          return;    
        }
      }
    }
  }


    if (this.currentMode === 'draw') {
      // Start a new freehand stroke
      this.isdrawing = true;
      this.currentDrawPoints = [this.getMousePos(evt)]; //first point of the stroke
    } else {
      this.startMove(evt); // dragging
    }
  }

  onPointerMove(evt: MouseEvent) {
      const pos = this.getMousePos(evt);

      if (this.isDraggingVertex && this.polygonEditingItemIndex !== null) {
    const polyItem = this.layers[this.currentLayerIndex]
                          .items[this.polygonEditingItemIndex];
    // Update the specific vertex
    polyItem.data.points[this.selectdDraggingVertex] = pos;

    // Recalculate center so whole-polygon moves still work:
    const pts = polyItem.data.points;
    polyItem.data.center = {
      x: pts.reduce((sum: number, p: Point) => sum + p.x, 0) / pts.length,
      y: pts.reduce((sum: number, p: Point) => sum + p.y, 0) / pts.length,
    };

    this.redraw();
    return;  
  }


    if (this.currentMode === 'draw' && this.isdrawing) { 
      const pos = this.getMousePos(evt);
      const points = this.currentDrawPoints;
      const prev = points[points.length - 1];
      points.push(pos); 

      // Draw the latest segment immediately for updating live
      this.ctx.strokeStyle = this.drawOptions.color;
      this.ctx.lineWidth = this.drawOptions.thickness;
      this.ctx.beginPath(); // start a new path for drawing
      this.ctx.moveTo(prev.x, prev.y); // move to the last point
      this.ctx.lineTo(pos.x, pos.y); // draw a line to the current point
      this.ctx.stroke(); // render the line on the canvas
    } else {
      this.move(evt); // dragging
    }
  }

  onPointerUp() {
    if (this.isDraggingVertex) {
         this.isDraggingVertex   = false;
         this.selectdDraggingVertex = -1;
    return;       //keep on editing the polygon
  }

    if (this.currentMode === 'draw' && this.isdrawing) { 
      // add the new layer
      this.layers[this.currentLayerIndex].items.push({   
        subType: 'freehand',
        data: {
          points: [...this.currentDrawPoints],
          color: this.drawOptions.color,
          thickness: this.drawOptions.thickness,
        },
        visible: true,
      });

      this.isdrawing = false;
      this.currentDrawPoints = [];
      this.redraw();
    } else {
      this.endMove(); // end dragging
    }
  }

  // every time there is a change in the layers ,we redraw all the layers on the canvas.
  redraw() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height); // clear the canvas

    if (this.baseImage) {
      this.ctx.drawImage(this.baseImage, 0, 0, canvas.width, canvas.height);
    }

    this.layers.forEach((layer, index) => {
      if (!layer.visible) return;
      layer.items.forEach((item, itemIndex) => {
        if (!item.visible) return; // skip invisible items
        if (
          item.subType === 'circle' ||
          item.subType === 'triangle' ||
          item.subType === 'square' ||
          item.subType === 'polygonPoints'
        ) {
          this.drawPolygon(item.data);
          if (index === this.currentLayerIndex
  && itemIndex === this.polygonEditingItemIndex && item.subType === 'polygonPoints') {
            item.data.points.forEach( (p : any) => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 5, 0, 2*Math.PI);
            this.ctx.fillStyle = '#fff';
            this.ctx.fill();
            this.ctx.strokeStyle = '#000';
            this.ctx.stroke();
  });
          }
        } else if (item.subType === 'text') {
          this.drawText(item.data);
        } else if (item.subType === 'freehand') {
          this.drawFreehand(item.data);
        }
      });
    });
  }

/**
 * Right-click on a vertex to delete it when in polygon-edit mode.
 */
onCanvasContextMenu(evt: MouseEvent) {
  evt.preventDefault();    // don’t show the browser menu
  const pos = this.getMousePos(evt);

  //Check if we are in polygon editing mode
  if (this.polygonEditingItemIndex === null) return;

  const layer = this.layers[this.currentLayerIndex];
  const item  = layer.items[this.polygonEditingItemIndex];

  if (item.subType !== 'polygonPoints') return;


  for (let i = 0; i < item.data.points.length; i++) {
    const p = item.data.points[i];
    if (Math.hypot(pos.x - p.x, pos.y - p.y) <= 5) {
      //Remove that one point
      item.data.points.splice(i, 1);

      //Recalc the polygon’s center so your drag-whole-shape still works
      const pts = item.data.points;
      item.data.center = {
        x: pts.reduce((sum: number, p: Point) => sum + p.x, 0) / pts.length,
        y: pts.reduce((sum: number, p: Point) => sum + p.y, 0) / pts.length,
      };

      //If fewer than 3 points remain, cancel edit mode
      if (item.data.points.length < 3) {
        this.polygonEditingItemIndex = null;
      }

      this.redraw();
      return;
    }
  }
}



  drawPolygon(data: any) {
    // we rendereing the whole canvas so each time we create a new polygon or edditing we have different setting for it
    this.ctx.strokeStyle = data.color || '#000000';
    this.ctx.lineWidth = data.thickness || 1;
    this.ctx.fillStyle = data.fillColor || 'transparent'; // Default: no fill
    
    if (data.center && data.radius) { // circle
      this.ctx.beginPath();
      this.ctx.arc(data.center.x, data.center.y, data.radius, 0, 2 * Math.PI); 
      this.ctx.fill();
      this.ctx.stroke();
    } else if (data.points && data.points.length > 0) {
      this.ctx.beginPath();
      this.ctx.moveTo(data.points[0].x, data.points[0].y); // start at the first point
      data.points.slice(1).forEach((p: Point) => this.ctx.lineTo(p.x, p.y)); // draw lines between points
      this.ctx.closePath(); // close the path to form a polygon
      this.ctx.fill(); 
      this.ctx.stroke(); 
      
    }
  }

  drawText(data: any) {
    this.ctx.font = data.font || '16px Arial';
    this.ctx.fillStyle = data.color || '#000000';
    this.ctx.fillText(data.text, data.position.x, data.position.y);
  }

  drawFreehand(data: { points: Point[]; color: string; thickness: number }) {
    const points = data.points;
    if (points.length < 2) return;

    this.ctx.strokeStyle = data.color;
    this.ctx.lineWidth = data.thickness;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y); // start at the first point
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y); // draw lines between points
    }
    this.ctx.stroke(); // render the freehand stroke on the canvas
  }

  addTextItem() {
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
      visible: true,
    });
    this.redraw();
  }

  addSquareItem() {
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
      visible: true,
    });
    this.isAddShapeDialogOpen = false;
    this.redraw();
  }

  addTriangleItem() {
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
      visible: true,
    });
    this.isAddShapeDialogOpen = false;
    this.redraw();
  }

  addCircleItem() {
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
      visible: true,
    });
    this.isAddShapeDialogOpen = false;
    this.redraw();
  }

  handleItemEdit(index: number) {
    // updating the edit of polygon text or draw
    const item = this.layers[this.currentLayerIndex].items[index]; 
    if (item.subType === 'text') { 
      this.editingItemIndex = index; // index of the text item that is being edited only
      this.polygonEditingItemIndex = null;
      this.drawEditingItemIndex = null;
      const { font = '16px Arial', color = '#000000' } = item.data;
      const sizeMatch = font.match(/(\d+)px/);
      this.editOptions = {
        bold: font.includes('bold'),
        fontSize: sizeMatch ? parseInt(sizeMatch[1]) : 16,
        color,
        text: item.data.text || '', // initialize with existing text or empty string
      };
    } else if ( 
      item.subType === 'polygonPoints' ||
      item.subType === 'triangle' ||
      item.subType === 'square' ||
      item.subType === 'circle'
    ) {
      this.polygonEditingItemIndex = index; // index of the polygon item that is being edited only
      this.editingItemIndex = null;
      this.drawEditingItemIndex = null;
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
      if(item.subType === 'polygonPoints')
        this.redraw();
    } else if (item.subType === 'freehand') {
      this.drawEditingItemIndex = index; // index of the freehand item that is being edited only  
      this.editingItemIndex = null;
      this.polygonEditingItemIndex = null;
      this.drawOptions = {
        color: item.data.color,
        thickness: item.data.thickness,
      };

      this.currentMode = 'move'; // switch to move mode if needed so the edit toolbar shows
    }
  }

  updateLiveEdit() { // updating the text item live edit
    if (this.editingItemIndex === null) return;
    const item = this.layers[this.currentLayerIndex].items[this.editingItemIndex];
    if (item.subType !== 'text') return;
    const { bold, fontSize, color } = this.editOptions;
    const weight = bold ? 'bold' : 'normal';
    const font = `${weight} ${fontSize}px Arial`;
    item.data.font = font;
    item.data.color = color;
    item.data.text = this.editOptions.text;
    this.ctx.font = font;
    const metrics = this.ctx.measureText(item.data.text); // measure the text width 
    item.data.width = metrics.width;
    item.data.height = fontSize;
   
    this.redraw();
  }

  updatePolygonLiveEdit() { // updating the polygon item live edit
    if (this.polygonEditingItemIndex === null) return;
    const item = this.layers[this.currentLayerIndex].items[this.polygonEditingItemIndex];
    if (item.subType === 'text' || item.subType === 'freehand') 
      return;
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
    } else if (item.data.radius !== undefined) { // Circle
      item.data.radius = size;
    }
    this.redraw();
  }

  updateDrawLiveEdit() { // updating the freehand item live edit
    if (this.drawEditingItemIndex === null) return;
    const item = this.layers[this.currentLayerIndex].items[this.drawEditingItemIndex];
    item.data.color = this.drawOptions.color;
    item.data.thickness = this.drawOptions.thickness;
    this.redraw();
  }

  saveLayers() {
    const dataStr = JSON.stringify(this.layers[this.currentLayerIndex]); // convert the current layer to JSON string
    const blob = new Blob([dataStr], { type: 'application/json' }); // create a blob from the JSON string so it can be downloaded
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

  handleFile(event: any) { // handle the file input change event, namely when a file is selected
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader(); // FileReader is used to read the contents of files stored on the user's computer.
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text); // parse the JSON string to an object

        if (Array.isArray(parsed)) { 
          // Replace entire layers list
          this.layers = parsed;
        } else {
          // Single-layer JSON: append it
          this.layers.push(parsed);
        }

        // Select the first layer if any
        this.currentLayerIndex = this.layers.length > this.layers.length - 1 ? 0 : -1;
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
    reader.readAsDataURL(file); // read the file as a data URL
  }

  clearCanvas() {
    this.layers = [];
    this.redraw();
  }

  handleLayerDelete(index: number) {
    // Remove the layer by building a new array
    this.layers = this.layers.filter((_, i) => i !== index);

    //  Update the current layer index

    this.currentLayerIndex = Math.min(
      this.layers.length - 1,
      Math.max(0, this.currentLayerIndex - 1)
    ); 

    this.redraw();
  }

  handleLayerToggle(index: number) {
    this.layers[index].visible = !this.layers[index].visible;
    this.redraw();
  }

  cancelEdit() {
    this.editingItemIndex = null;
  }

  cancelPolygonEdit() {
    this.polygonEditingItemIndex = null;
    this.redraw();
  }

  cancelDrawEdit() {
    this.drawEditingItemIndex = null;
  }

  handleItemDelete(layerIdx: number, itemIdx: number) {
    this.layers[layerIdx].items.splice(itemIdx, 1);
    this.redraw();
  }

  handleItemToggle(layerIdx: number, itemIdx: number) {
    const item = this.layers[layerIdx].items[itemIdx];
    item.visible = !item.visible;
    this.redraw();
  }
}

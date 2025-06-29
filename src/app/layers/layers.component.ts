import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Layer, Item } from '../app.component';  // adjust path as needed


@Component({
  selector: 'app-layers',
  imports: [CommonModule],
  templateUrl: './layers.component.html',
  styleUrl: './layers.component.scss'
})

export class LayersComponent {
  @Input() layers: Layer[] = [];
  @Output() onDeleteLayer       = new EventEmitter<number>();
  @Output() onToggleLayerVis    = new EventEmitter<number>();
  @Output() layerSelected = new EventEmitter<number>();


  // ITEM‐level
  @Output() onDeleteItem        = new EventEmitter<{layer: number, item: number}>();
  @Output() onEditItem          = new EventEmitter<{layer: number, item: number}>();
  @Output() onToggleItemVis     = new EventEmitter<{layer: number, item: number}>();

  selectedLayerIndex: number | null = null;
  selectedItemIndex: number | null  = null;

  selectLayer(i: number) {
    this.selectedLayerIndex = i;
    this.selectedItemIndex  = null;
    this.layerSelected.emit(i);
  }

  selectItem(layerIdx: number, itemIdx: number) {
    this.selectedLayerIndex = layerIdx;
    this.selectedItemIndex  = itemIdx;
  }

  deleteLayer(i: number) {
    this.onDeleteLayer.emit(i);
  }

  deleteItem(i: number, j: number) {
    this.onDeleteItem.emit({ layer: i, item: j });
  }



  editItem(i: number, j: number) {
    this.onEditItem.emit({ layer: i, item: j });
  }

  toggleLayerVisibility(i: number) {
    this.onToggleLayerVis.emit(i);
  }

  toggleItemVisibility(i: number, j: number) {
    this.onToggleItemVis.emit({ layer: i, item: j });
  }
}

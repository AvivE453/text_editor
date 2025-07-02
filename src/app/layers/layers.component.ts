import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Layer, Item } from '../app.component';  // adjust path as needed


@Component({
  selector: 'app-layers',
  imports: [CommonModule],
  templateUrl: './layers.component.html',
  styleUrl: './layers.component.scss'
})
// to call (or “emit”) a custom event from a child component up to its parent.
export class LayersComponent {
  @Input() layers: Layer[] = [];
  @Output() onDeleteLayer       = new EventEmitter<number>();
  @Output() onToggleLayerVis    = new EventEmitter<number>(); // layer visibility toggle
  @Output() layerSelected = new EventEmitter<number>(); // layer selection event


  // ITEM‐level
  @Output() onDeleteItem        = new EventEmitter<{layer: number, item: number}>(); // item deletion event
  @Output() onEditItem          = new EventEmitter<{item: number}>(); // item edit event
  @Output() onToggleItemVis     = new EventEmitter<{layer: number, item: number}>(); // item visibility toggle

  selectedLayerIndex: number | null = null;
  selectedItemIndex: number | null  = null;

  selectLayer(i: number) {
    this.selectedLayerIndex = i;
    this.selectedItemIndex  = null;
    this.layerSelected.emit(i); //Update the selected layer index which allows editing and deleting items
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



  editItem(j: number) {
    this.onEditItem.emit({item: j});
  }

  toggleLayerVisibility(i: number) {
    this.onToggleLayerVis.emit(i);
  }

  toggleItemVisibility(i: number, j: number) {
    this.onToggleItemVis.emit({ layer: i, item: j });
  }
}

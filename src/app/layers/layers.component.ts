import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-layers',
  imports: [CommonModule],
  templateUrl: './layers.component.html',
  styleUrl: './layers.component.scss'
})

export class LayersComponent {
  @Input() layers: any[] = [];
  @Output() onDelete = new EventEmitter<number>();
  @Output() onEdit = new EventEmitter<number>();
  @Output() onToggleVisibility = new EventEmitter<number>();

    selectedLayerIndex: number | null = null;

  selectLayer(index: number) {
    this.selectedLayerIndex = index;
  }

  deleteLayer(index: number) {
    this.onDelete.emit(index);
    if (this.selectedLayerIndex === index) this.selectedLayerIndex = null;
  }

  editLayer(index: number) {
    this.onEdit.emit(index);
  }

  toggleLayerVisibility(index: number) {
    this.onToggleVisibility.emit(index);
  }
}

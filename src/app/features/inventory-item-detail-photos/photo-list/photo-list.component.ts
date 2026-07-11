import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, forkJoin } from 'rxjs';
import { EventService } from '../../../core/services/event.service';
import { InventoryItemDetailPhotoConfigService } from '../../../core/services/inventory-item-detail-photo-config.service';
import { InventoryItemDetailPhotoService } from '../../../core/services/inventory-item-detail-photo.service';
import { InventoryItemDetailService } from '../../../core/services/inventory-item-detail.service';
import { EventResponse } from '../../../models/event.model';
import {
  InventoryItemDetailPhotoConfigResponse,
  InventoryItemDetailPhotoResponse,
} from '../../../models/inventory-item-detail-photo.model';
import { InventoryItemDetailResponse } from '../../../models/inventory-item-detail.model';
import { INVENTORY_STORES } from '../../../shared/catalogs.constants';

@Component({
  selector: 'app-photo-list',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './photo-list.component.html',
  styleUrl: './photo-list.component.css',
})
export class PhotoListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly eventService = inject(EventService);
  private readonly detailService = inject(InventoryItemDetailService);
  private readonly photoConfigService = inject(InventoryItemDetailPhotoConfigService);
  private readonly photoService = inject(InventoryItemDetailPhotoService);

  readonly storeOptions = INVENTORY_STORES;
  readonly displayedColumns = [
    'fileName',
    'contentType',
    'fileSizeBytes',
    'distance',
    'capturedAt',
    'actions',
  ];

  readonly scopeForm = this.fb.group({
    eventId: [1, [Validators.required, Validators.min(1)]],
    storeId: [0, [Validators.required, Validators.min(1)]],
    itemDetailId: [0, [Validators.required, Validators.min(1)]],
  });

  readonly configForm = this.fb.group({
    eventId: [1, [Validators.required, Validators.min(1)]],
    storeId: [0, [Validators.required, Validators.min(1)]],
    itemDetailId: [0, [Validators.required, Validators.min(1)]],
    locationLabel: ['', [Validators.required, Validators.maxLength(120)]],
    referenceLatitude: [0, [Validators.required, Validators.min(-90), Validators.max(90)]],
    referenceLongitude: [0, [Validators.required, Validators.min(-180), Validators.max(180)]],
    gpsRadiusMeters: [200, [Validators.min(1)]],
    observations: ['', [Validators.maxLength(1000)]],
  });

  readonly uploadForm = this.fb.group({
    eventId: [1, [Validators.required, Validators.min(1)]],
    storeId: [0, [Validators.required, Validators.min(1)]],
    itemDetailId: [0, [Validators.required, Validators.min(1)]],
    gpsLatitude: [0, [Validators.required, Validators.min(-90), Validators.max(90)]],
    gpsLongitude: [0, [Validators.required, Validators.min(-180), Validators.max(180)]],
    capturedAt: [''],
    observations: ['', [Validators.maxLength(1000)]],
  });

  events: EventResponse[] = [];
  details: InventoryItemDetailResponse[] = [];
  configs: InventoryItemDetailPhotoConfigResponse[] = [];
  photos: InventoryItemDetailPhotoResponse[] = [];
  selectedFiles: File[] = [];

  loading = false;
  loadingPhotos = false;
  savingConfig = false;
  uploadingPhotos = false;
  errorMessage = '';

  ngOnInit() {
    this.syncFormsFromScope();
    this.loadInitialData();
  }

  get detailOptions() {
    return this.details.filter(
      (detail) => detail.storeId === Number(this.scopeForm.controls.storeId.value),
    );
  }

  getStoreLabel(storeId: number) {
    return this.storeOptions.find((store) => store.id === storeId)?.label || `Bodega #${storeId}`;
  }

  getDetailLabel(detailId: number) {
    const detail = this.details.find((currentDetail) => currentDetail.id === detailId);

    if (!detail) {
      return `Detalle #${detailId}`;
    }

    return `${detail.code} - ${detail.storeName}`;
  }

  formatBytes(value: number) {
    if (value < 1024) {
      return `${value} B`;
    }

    const kb = value / 1024;

    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }

    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  syncFormsFromScope() {
    const scope = this.scopeForm.getRawValue();

    this.configForm.patchValue(scope);
    this.uploadForm.patchValue(scope);
  }

  onScopeChanged() {
    this.syncFormsFromScope();
  }

  loadInitialData() {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      events: this.eventService.getAll(),
      details: this.detailService.getAll(),
      configs: this.photoConfigService.getAll(),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ events, details, configs }) => {
          this.events = events;
          this.details = details;
          this.configs = configs;
        },
        error: () => (this.errorMessage = 'No se pudo cargar la informacion de fotos.'),
      });
  }

  findScopeConfig() {
    const scope = this.scopeForm.getRawValue();

    return this.configs.find(
      (config) =>
        config.eventId === Number(scope.eventId) &&
        config.storeId === Number(scope.storeId) &&
        config.itemDetailId === Number(scope.itemDetailId),
    );
  }

  loadPhotos() {
    if (this.scopeForm.invalid) {
      this.scopeForm.markAllAsTouched();
      return;
    }

    const scope = this.scopeForm.getRawValue();
    this.loadingPhotos = true;
    this.errorMessage = '';

    this.photoService
      .listByScope(Number(scope.eventId), Number(scope.storeId), Number(scope.itemDetailId))
      .pipe(finalize(() => (this.loadingPhotos = false)))
      .subscribe({
        next: (photos) => {
          this.photos = photos;
        },
        error: () =>
          (this.errorMessage = 'No se pudieron cargar las fotos para el alcance seleccionado.'),
      });
  }

  saveConfig() {
    if (this.configForm.invalid || this.savingConfig) {
      this.configForm.markAllAsTouched();
      return;
    }

    this.savingConfig = true;
    this.errorMessage = '';

    const raw = this.configForm.getRawValue();
    const body = {
      eventId: Number(raw.eventId),
      storeId: Number(raw.storeId),
      itemDetailId: Number(raw.itemDetailId),
      locationLabel: raw.locationLabel.trim(),
      referenceLatitude: Number(raw.referenceLatitude),
      referenceLongitude: Number(raw.referenceLongitude),
      gpsRadiusMeters: raw.gpsRadiusMeters ? Number(raw.gpsRadiusMeters) : undefined,
      observations: raw.observations.trim() || undefined,
    };

    const existingConfig = this.findScopeConfig();
    const request = existingConfig
      ? this.photoConfigService.update(existingConfig.id, {
          ...body,
          gpsRadiusMeters: Number(body.gpsRadiusMeters || existingConfig.gpsRadiusMeters || 200),
        })
      : this.photoConfigService.create(body);

    request.pipe(finalize(() => (this.savingConfig = false))).subscribe({
      next: () => this.loadInitialData(),
      error: () => (this.errorMessage = 'No se pudo guardar la configuracion GPS.'),
    });
  }

  onFilesSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files || []);
    this.selectedFiles = files.filter((file) => file.type.startsWith('image/'));

    if (this.selectedFiles.length !== files.length) {
      this.errorMessage = 'Solo se permiten archivos de imagen.';
    }
  }

  uploadPhotos() {
    if (this.uploadForm.invalid || this.uploadingPhotos) {
      this.uploadForm.markAllAsTouched();
      return;
    }

    if (!this.selectedFiles.length) {
      this.errorMessage = 'Debe seleccionar al menos una imagen.';
      return;
    }

    if (!this.findScopeConfig()) {
      this.errorMessage =
        'Debe crear la configuracion GPS para este alcance antes de cargar fotos.';
      return;
    }

    this.uploadingPhotos = true;
    this.errorMessage = '';

    const raw = this.uploadForm.getRawValue();

    this.photoService
      .uploadBatch({
        eventId: Number(raw.eventId),
        storeId: Number(raw.storeId),
        itemDetailId: Number(raw.itemDetailId),
        gpsLatitude: Number(raw.gpsLatitude),
        gpsLongitude: Number(raw.gpsLongitude),
        capturedAt: raw.capturedAt || undefined,
        observations: raw.observations.trim() || undefined,
        files: this.selectedFiles,
      })
      .pipe(finalize(() => (this.uploadingPhotos = false)))
      .subscribe({
        next: () => {
          this.selectedFiles = [];
          this.loadPhotos();
        },
        error: () => (this.errorMessage = 'No se pudieron cargar las fotos.'),
      });
  }

  viewPhoto(photoId: number) {
    this.photoService.getContent(photoId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
      error: () => (this.errorMessage = 'No se pudo abrir el contenido de la foto.'),
    });
  }

  deletePhoto(photo: InventoryItemDetailPhotoResponse) {
    if (!confirm(`Eliminar la foto ${photo.fileName}?`)) {
      return;
    }

    this.photoService.delete(photo.id).subscribe({
      next: () => this.loadPhotos(),
      error: () => (this.errorMessage = 'No se pudo eliminar la foto.'),
    });
  }
}

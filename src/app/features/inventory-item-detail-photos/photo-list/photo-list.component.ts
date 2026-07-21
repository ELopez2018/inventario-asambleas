import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
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

function toApiLocalDateTime(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length === 16 ? `${value}:00` : value;
}

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
    MatStepperModule,
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

  readonly gpsGateForm = this.fb.group({
    gpsReady: [false, Validators.requiredTrue],
  });

  readonly filesGateForm = this.fb.group({
    filesReady: [false, Validators.requiredTrue],
  });

  events: EventResponse[] = [];
  details: InventoryItemDetailResponse[] = [];
  configs: InventoryItemDetailPhotoConfigResponse[] = [];
  photos: InventoryItemDetailPhotoResponse[] = [];
  selectedFiles: File[] = [];

  @ViewChild('manualMap') manualMapElement?: ElementRef<HTMLDivElement>;

  locatingGps = false;
  gpsVerified = false;
  gpsFallbackConfirmations = 0;
  showManualMap = false;
  manualPointSelected = false;
  gpsStepMessage = 'Paso 3: active el GPS del dispositivo y pulse "Verificar GPS".';

  private mapInitialized = false;
  private mapInstance?: any;
  private manualSelectionMarker?: any;

  loading = false;
  loadingPhotos = false;
  savingConfig = false;
  uploadingPhotos = false;
  errorMessage = '';

  ngOnInit() {
    this.syncFormsFromScope();
    this.loadInitialData();
  }

  ngAfterViewChecked() {
    if (this.showManualMap && !this.mapInitialized && this.manualMapElement) {
      void this.initializeManualMap();
    }
  }

  ngOnDestroy() {
    if (this.mapInstance) {
      this.mapInstance.remove();
    }
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
    this.resetGpsTutorialState();
  }

  get canShowMapFallback(): boolean {
    return this.gpsFallbackConfirmations >= 2;
  }

  get gpsReadyForUpload(): boolean {
    return this.gpsVerified || (this.canShowMapFallback && this.manualPointSelected);
  }

  get canUpload(): boolean {
    return this.gpsReadyForUpload && this.selectedFiles.length > 0 && !this.uploadingPhotos;
  }

  get gpsGateCompleted(): boolean {
    return this.gpsGateForm.valid;
  }

  get filesGateCompleted(): boolean {
    return this.filesGateForm.valid;
  }

  private resetGpsTutorialState() {
    this.locatingGps = false;
    this.gpsVerified = false;
    this.gpsFallbackConfirmations = 0;
    this.showManualMap = false;
    this.manualPointSelected = false;
    this.gpsStepMessage = 'Paso 3: active el GPS del dispositivo y pulse "Verificar GPS".';
    this.uploadForm.patchValue({
      gpsLatitude: 0,
      gpsLongitude: 0,
    });
    this.gpsGateForm.patchValue({ gpsReady: false });
    this.filesGateForm.patchValue({ filesReady: false });

    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = undefined;
      this.manualSelectionMarker = undefined;
      this.mapInitialized = false;
    }
  }

  verifyGps(): void {
    if (!navigator.geolocation) {
      this.handleGpsFailure('Este navegador no soporta geolocalizacion.');
      return;
    }

    this.locatingGps = true;
    this.errorMessage = '';
    this.gpsStepMessage = 'Intentando obtener coordenadas con GPS activo...';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.locatingGps = false;
        this.gpsVerified = true;
        this.manualPointSelected = false;
        this.showManualMap = false;
        this.uploadForm.patchValue({
          gpsLatitude: Number(position.coords.latitude.toFixed(7)),
          gpsLongitude: Number(position.coords.longitude.toFixed(7)),
        });
        this.gpsGateForm.patchValue({ gpsReady: true });
        this.gpsStepMessage =
          'GPS verificado. Puede continuar con la seleccion de archivos y la carga.';
      },
      (error) => {
        this.locatingGps = false;
        const messageByCode: Record<number, string> = {
          1: 'Permiso de ubicacion denegado.',
          2: 'No se pudo determinar la ubicacion del dispositivo.',
          3: 'Tiempo de espera agotado al consultar GPS.',
        };

        this.handleGpsFailure(
          messageByCode[error.code] ?? 'No fue posible obtener coordenadas GPS.',
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  private handleGpsFailure(reason: string): void {
    this.gpsVerified = false;
    this.gpsGateForm.patchValue({ gpsReady: false });
    this.errorMessage = `${reason} Debe encender GPS para continuar con la carga de fotos.`;

    const confirmation = confirm(
      'No fue posible validar GPS. Confirma que NO es posible encender GPS en este momento.',
    );

    if (confirmation) {
      this.gpsFallbackConfirmations += 1;
    }

    if (this.canShowMapFallback) {
      this.showManualMap = true;
      this.gpsStepMessage =
        'Se habilito mapa de respaldo. Seleccione manualmente un punto para continuar.';
      return;
    }

    const pendingConfirmations = 2 - this.gpsFallbackConfirmations;
    this.gpsStepMessage = `GPS obligatorio. Debe reintentar activarlo. Confirmaciones restantes para habilitar mapa: ${pendingConfirmations}.`;
  }

  private async initializeManualMap(): Promise<void> {
    if (!this.manualMapElement || this.mapInitialized) {
      return;
    }

    const L = await import('leaflet');
    const map = L.map(this.manualMapElement.nativeElement).setView([4.5709, -74.2973], 6);

    const layer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });
    layer.addTo(map);

    map.on('click', (event) => {
      this.selectManualPoint(event.latlng.lat, event.latlng.lng, L);
    });

    this.mapInstance = map;
    this.mapInitialized = true;

    setTimeout(() => {
      this.mapInstance?.invalidateSize();
    }, 0);
  }

  private selectManualPoint(lat: number, lng: number, L: typeof import('leaflet')): void {
    const point: [number, number] = [Number(lat.toFixed(7)), Number(lng.toFixed(7))];

    if (!this.mapInstance) {
      return;
    }

    if (!this.manualSelectionMarker) {
      this.manualSelectionMarker = L.circleMarker(point, {
        radius: 8,
        color: '#0f172a',
        fillColor: '#1d4ed8',
        fillOpacity: 0.8,
      }).addTo(this.mapInstance);
    } else {
      this.manualSelectionMarker.setLatLng(point);
    }

    this.manualPointSelected = true;
    this.uploadForm.patchValue({ gpsLatitude: point[0], gpsLongitude: point[1] });
    this.gpsGateForm.patchValue({ gpsReady: true });
    this.gpsStepMessage =
      'Punto manual seleccionado. Ya puede subir las fotos con estas coordenadas.';
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
    this.filesGateForm.patchValue({ filesReady: this.selectedFiles.length > 0 });

    if (this.selectedFiles.length !== files.length) {
      this.errorMessage = 'Solo se permiten archivos de imagen.';
    }
  }

  uploadPhotos() {
    if (this.uploadForm.invalid || this.uploadingPhotos) {
      this.uploadForm.markAllAsTouched();
      return;
    }

    if (!this.gpsReadyForUpload) {
      this.errorMessage =
        'GPS obligatorio: valide GPS del dispositivo o seleccione un punto en el mapa de respaldo.';
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
        capturedAt: toApiLocalDateTime(raw.capturedAt),
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

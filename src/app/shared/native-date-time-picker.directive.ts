import { Directive, ElementRef, HostListener, inject } from '@angular/core';

@Directive({
  selector: 'input[type="date"], input[type="time"], input[type="datetime-local"]',
  standalone: true,
  exportAs: 'nativeDateTimePicker',
})
export class NativeDateTimePickerDirective {
  private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);

  @HostListener('click')
  @HostListener('focus')
  openPicker(): void {
    const input = this.elementRef.nativeElement;

    if (input.disabled || input.readOnly || typeof input.showPicker !== 'function') {
      return;
    }

    try {
      input.showPicker();
    } catch {
      // Some browsers only allow showPicker from direct user gestures.
    }
  }
}

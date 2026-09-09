import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ContactModalService {
  readonly isOpen = signal(false);
  private lastFocusedElement: HTMLElement | null = null;

  open(): void {
    this.lastFocusedElement = document.activeElement as HTMLElement | null;
    this.isOpen.set(true);
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.lastFocusedElement?.focus();
  }
}

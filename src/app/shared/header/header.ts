import { Component, ElementRef, HostListener, effect, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../theme/theme';
import { ContactModalService } from '../contact/contact-modal';

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {
  protected readonly menuOpen = signal(false);
  private readonly contactCloseButton = viewChild<ElementRef<HTMLButtonElement>>('contactCloseButton');

  protected readonly email = 'caseymacleod22@gmail.com';
  protected readonly phone = '732-272-4494';
  protected readonly phoneHref = 'tel:+17322724494';

  constructor(
    protected readonly theme: ThemeService,
    protected readonly contact: ContactModalService,
  ) {
    effect(() => {
      if (this.contact.isOpen()) {
        setTimeout(() => this.contactCloseButton()?.nativeElement.focus());
      }
    });
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected openContact(): void {
    this.closeMenu();
    this.contact.open();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.contact.close();
  }
}

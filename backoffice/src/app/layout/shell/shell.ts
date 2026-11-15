import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Header, Sidebar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly mobileMenuOpen = signal(false);

  protected toggleMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}

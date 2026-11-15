import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../shared/components/icon/icon';
import { NAV_ITEMS, type NavItem } from '../navigation';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  readonly open = input(false);
  readonly close = output<void>();

  protected readonly navItems: readonly NavItem[] = NAV_ITEMS;

  protected closeMenu(): void {
    this.close.emit();
  }
}

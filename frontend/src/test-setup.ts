// Polyfills for running unit tests under jsdom (the default Vitest environment).
// jsdom ne gère pas la top layer des fenêtres natives.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
}
// Ionic components such as ion-menu and ion-split-pane query `window.matchMedia`,
// which jsdom does not implement.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

const dialogue = window.HTMLDialogElement?.prototype;

if (dialogue) {
  if (!('open' in dialogue)) {
    Object.defineProperty(dialogue, 'open', {
      configurable: true,
      get(this: HTMLDialogElement) {
        return this.hasAttribute('open');
      },
      set(this: HTMLDialogElement, ouvert: boolean) {
        this.toggleAttribute('open', ouvert);
      },
    });
  }

  dialogue.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };

  dialogue.close ??= function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
}

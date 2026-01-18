export {};

type UIButton = {
  id: string;
  text: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

type UIDialogOptions = {
  title?: string;
  message: string;
  buttons: UIButton[];
  dismissible?: boolean;
};

declare global {
  interface Window {
    __uiModalOpen?: boolean;
  }
}

function ensureRoot(): HTMLDivElement {
  let root = document.getElementById('modal-root') as HTMLDivElement | null;
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }
  return root;
}

export function uiIsOpen(): boolean {
  return !!window.__uiModalOpen;
}

export function uiDialog<T extends string = string>(
  opts: UIDialogOptions
): Promise<T> {
  const root = ensureRoot();
  root.innerHTML = '';

  window.__uiModalOpen = true;

  const overlay = document.createElement('div');
  overlay.className = 'ui-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'ui-modal';

  const title = document.createElement('div');
  title.className = 'ui-modal-title';
  title.textContent = opts.title || 'Notice';

  const body = document.createElement('div');
  body.className = 'ui-modal-body';
  body.textContent = String(opts.message || '');

  const footer = document.createElement('div');
  footer.className = 'ui-modal-footer';

  modal.appendChild(title);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  root.appendChild(overlay);

  const focusable: HTMLButtonElement[] = [];
  const primaryId = opts.buttons[0]?.id;
  let resolved = false;

  return new Promise<T>((resolve) => {
    function finish(id: string) {
      if (resolved) return;
      resolved = true;

      window.__uiModalOpen = false;
      root.innerHTML = '';
      document.removeEventListener('keydown', onKeyDown, true);

      resolve(id as T);
    }

    for (const btn of opts.buttons) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `ui-btn ${btn.variant ? `ui-btn-${btn.variant}` : 'ui-btn-primary'}`;
      b.textContent = btn.text;
      b.addEventListener('click', () => finish(btn.id));
      footer.appendChild(b);
      focusable.push(b);
    }

    // Focus first button
    setTimeout(() => focusable[0]?.focus(), 0);

    function onKeyDown(e: KeyboardEvent) {
      if (!window.__uiModalOpen) return;

      // Trap Tab
      if (e.key === 'Tab' && focusable.length) {
        e.preventDefault();
        const idx = focusable.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.shiftKey
          ? idx <= 0 ? focusable.length - 1 : idx - 1
          : idx === focusable.length - 1 ? 0 : idx + 1;
        focusable[next].focus();
        return;
      }

      // Enter = primary button
      if (e.key === 'Enter' && primaryId) {
        e.preventDefault();
        finish(primaryId);
        return;
      }

      // Esc = cancel (only if dismissible)
      if (e.key === 'Escape' && opts.dismissible) {
        const cancel =
          opts.buttons.find(b => b.id === 'cancel') ??
          opts.buttons[opts.buttons.length - 1];
        finish(cancel.id);
      }
    }

    document.addEventListener('keydown', onKeyDown, true);

    // Backdrop click = cancel (only if dismissible)
    overlay.addEventListener('mousedown', (e) => {
      if (!opts.dismissible) return;
      if (e.target === overlay) {
        const cancel =
          opts.buttons.find(b => b.id === 'cancel') ??
          opts.buttons[opts.buttons.length - 1];
        finish(cancel.id);
      }
    });
  });
}

export async function uiAlert(
  message: string,
  title = 'Notice',
  okText = 'OK'
): Promise<void> {
  await uiDialog({
    title,
    message,
    buttons: [{ id: 'ok', text: okText, variant: 'primary' }],
    dismissible: true,
  });
}

export async function uiConfirm(
  message: string,
  title = 'Confirm',
  okText = 'OK',
  cancelText = 'Cancel'
): Promise<boolean> {
  const choice = await uiDialog({
    title,
    message,
    buttons: [
      { id: 'ok', text: okText, variant: 'primary' },
      { id: 'cancel', text: cancelText, variant: 'ghost' },
    ],
    dismissible: true,
  });
  return choice === 'ok';
}

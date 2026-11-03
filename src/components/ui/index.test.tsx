// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Modal } from './index';

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open modal</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Test dialog"
        footer={<button>Save</button>}
      >
        <button>First action</button>
      </Modal>
    </>
  );
}

describe('Modal keyboard behavior', () => {
  it('traps focus, closes on Escape, and restores focus to the opener', () => {
    render(<ModalHarness />);
    const opener = screen.getByRole('button', { name: 'Open modal' });
    opener.focus();
    fireEvent.click(opener);

    const close = screen.getByRole('button', { name: 'Close' });
    const lastAction = screen.getByRole('button', { name: 'Save' });
    expect(close).toHaveFocus();

    lastAction.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastAction).toHaveFocus();

    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

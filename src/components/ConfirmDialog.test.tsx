import { render, screen } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('focuses Cancel first so Enter does not confirm a destructive action', () => {
    render(<ConfirmDialog title="Delete?" message="Sure?" confirmLabel="Delete" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });
});

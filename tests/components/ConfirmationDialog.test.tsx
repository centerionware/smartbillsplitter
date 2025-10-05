import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ConfirmationDialog from '../../components/ConfirmationDialog';

describe('ConfirmationDialog', () => {
  it('does not render when isOpen is false', () => {
    render(
      <ConfirmationDialog
        isOpen={false}
        title="Test Title"
        message="Test Message"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renders correctly when isOpen is true', () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        title="Test Title"
        message="Test Message"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Message')).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirmMock = vi.fn();
    render(
      <ConfirmationDialog
        isOpen={true}
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={onConfirmMock}
        onCancel={vi.fn()}
        confirmText="Yes, Confirm"
      />
    );
    const confirmButton = screen.getByRole('button', { name: 'Yes, Confirm' });
    await userEvent.click(confirmButton);
    expect(onConfirmMock).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancelMock = vi.fn();
    render(
      <ConfirmationDialog
        isOpen={true}
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={onCancelMock}
        cancelText="No, Cancel"
      />
    );
    const cancelButton = screen.getByRole('button', { name: 'No, Cancel' });
    await userEvent.click(cancelButton);
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });

  it('applies danger variant styles to the confirm button', () => {
    render(
      <ConfirmationDialog
        isOpen={true}
        title="Delete Item"
        message="This is permanent."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirmVariant="danger"
        confirmText="Delete"
      />
    );
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    expect(confirmButton).toHaveClass('bg-red-600');
  });
});
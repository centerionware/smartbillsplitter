import React from 'react';
// FIX: Changed import for `screen`. In some test setups with module resolution issues, `screen` may not be correctly resolved from `@testing-library/react`. Importing it directly from `@testing-library/dom` is a workaround.
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import { describe, it, expect, vi } from 'vitest';
import Header from '../../components/Header';
import { View } from '../../types';

describe('Header component', () => {
  it('renders the application title', () => {
    render(
      <Header
        navigate={vi.fn()}
        onOpenSettings={vi.fn()}
        currentView={View.Dashboard}
        canInstall={false}
        promptInstall={vi.fn()}
      />
    );

    const titleElement = screen.getByRole('heading', { name: /sharedbills/i });
    expect(titleElement).toBeInTheDocument();
  });

  it('shows the "Create New Bill" button on the dashboard view', () => {
    render(
      <Header
        navigate={vi.fn()}
        onOpenSettings={vi.fn()}
        currentView={View.Dashboard}
        canInstall={false}
        promptInstall={vi.fn()}
      />
    );

    const createButton = screen.getByLabelText('Create new bill');
    expect(createButton).toBeInTheDocument();
  });

  it('does not show the "Create New Bill" button on other views', () => {
    render(
      <Header
        navigate={vi.fn()}
        onOpenSettings={vi.fn()}
        currentView={View.BillDetails}
        canInstall={false}
        promptInstall={vi.fn()}
      />
    );
    
    const createButton = screen.queryByLabelText('Create new bill');
    expect(createButton).not.toBeInTheDocument();
  });
});
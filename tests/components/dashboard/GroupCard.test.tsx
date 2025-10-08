import React from 'react';
import { render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import GroupCard from '../../../components/dashboard/GroupCard';
import type { Group } from '../../../types';

const mockGroup: Group = {
  id: 'group-1',
  name: 'Apartment Crew',
  participants: [
    { id: 'p1', name: 'Alice', amountOwed: 0, paid: false },
    { id: 'p2', name: 'Bob', amountOwed: 0, paid: false },
    { id: 'p3', name: 'Charlie', amountOwed: 0, paid: false },
  ],
  defaultSplit: { mode: 'equally' },
  lastUpdatedAt: Date.now(),
  popularity: 10,
};

describe('GroupCard', () => {
  it('renders group name and member count', () => {
    render(<GroupCard group={mockGroup} onEdit={vi.fn()} onClick={vi.fn()} layoutMode="card" />);

    expect(screen.getByText('Apartment Crew')).toBeInTheDocument();
    // FIX: Use getAllByText because "3 members" appears twice.
    expect(screen.getAllByText('3 members').length).toBeGreaterThan(0);
  });

  it('displays participant avatars', () => {
    render(<GroupCard group={mockGroup} onEdit={vi.fn()} onClick={vi.fn()} layoutMode="card" />);

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('opens the menu when the menu button is clicked', async () => {
    const onEditMock = vi.fn();
    render(<GroupCard group={mockGroup} onEdit={onEditMock} onClick={vi.fn()} layoutMode="card" />);
    
    const menuButton = screen.getByLabelText('More options');
    await userEvent.click(menuButton);

    const editButton = screen.getByRole('button', { name: 'Edit Group' });
    expect(editButton).toBeInTheDocument();
    
    await userEvent.click(editButton);
    expect(onEditMock).toHaveBeenCalledTimes(1);
  });
});
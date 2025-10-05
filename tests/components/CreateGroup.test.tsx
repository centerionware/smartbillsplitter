import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateGroup from '../../components/CreateGroup';
import { Group, SplitMode } from '../../types';

const onSaveMock = vi.fn();
const onUpdateMock = vi.fn();
const onBackMock = vi.fn();

const mockGroup: Group = {
  id: 'group-1',
  name: 'Apartment Mates',
  participants: [
    { id: 'p1', name: 'Alice', amountOwed: 0, paid: false },
    { id: 'p2', name: 'Bob', amountOwed: 0, paid: false },
  ],
  defaultSplit: { mode: 'equally' },
  lastUpdatedAt: Date.now(),
  popularity: 5,
};

describe('CreateGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in "Create" mode correctly', () => {
    render(<CreateGroup onSave={onSaveMock} onUpdate={onUpdateMock} onBack={onBackMock} />);
    expect(screen.getByRole('heading', { name: /Create New Group/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Group/i })).toBeInTheDocument();
  });

  it('renders in "Edit" mode correctly', () => {
    render(<CreateGroup onSave={onSaveMock} onUpdate={onUpdateMock} onBack={onBackMock} groupToEdit={mockGroup} />);
    expect(screen.getByRole('heading', { name: /Edit Group/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update Group/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Apartment Mates')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
  });

  it('allows adding and removing participants', async () => {
    render(<CreateGroup onSave={onSaveMock} onUpdate={onUpdateMock} onBack={onBackMock} />);
    
    // Starts with group name input + 1 participant input = 2
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    
    // Add a participant
    await userEvent.click(screen.getByText(/Add Manually/i));
    // Now has group name + 2 participant inputs = 3
    expect(screen.getAllByRole('textbox')).toHaveLength(3);

    // Remove the first participant
    const removeButtons = screen.getAllByLabelText(/Remove participant/i);
    expect(removeButtons).toHaveLength(2);
    await userEvent.click(removeButtons[0]);

    // Back to group name + 1 participant input = 2
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  it('validates group name is not empty on save', async () => {
    render(<CreateGroup onSave={onSaveMock} onUpdate={onUpdateMock} onBack={onBackMock} />);
    await userEvent.click(screen.getByRole('button', { name: /Save Group/i }));
    
    expect(screen.getByText('Group name is required.')).toBeInTheDocument();
    expect(onSaveMock).not.toHaveBeenCalled();
  });

  it('calls onSave with correct data for a new group', async () => {
    render(<CreateGroup onSave={onSaveMock} onUpdate={onUpdateMock} onBack={onBackMock} />);
    
    await userEvent.type(screen.getByLabelText(/Group Name/i), 'Test Group');
    await userEvent.type(screen.getByPlaceholderText('Participant 1'), 'Charlie');
    await userEvent.click(screen.getByRole('button', { name: /Save Group/i }));

    expect(onSaveMock).toHaveBeenCalledWith({
      name: 'Test Group',
      participants: expect.arrayContaining([
        expect.objectContaining({ name: 'Charlie' }),
      ]),
      defaultSplit: { mode: 'equally', splitValues: undefined },
      popularity: 0,
    });
  });

  it('calls onUpdate with correct data when editing a group', async () => {
    render(<CreateGroup onSave={onSaveMock} onUpdate={onUpdateMock} onBack={onBackMock} groupToEdit={mockGroup} />);
    
    const nameInput = screen.getByLabelText(/Group Name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'New Apartment Name');
    
    await userEvent.click(screen.getByRole('button', { name: /Update Group/i }));

    expect(onUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Apartment Name',
    }));
  });
});

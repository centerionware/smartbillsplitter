import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGroups } from '../../hooks/useGroups';
import type { Group } from '../../types';

// FIX: Added direct imports for mocked functions. `vi.mock` hoists and replaces these modules, so the imports will refer to the mocks.
import { getGroups, addGroup, updateGroup, deleteGroupDB } from '../../services/db';
import { postMessage } from '../../services/broadcastService';

// Mock dependencies
vi.mock('../../services/db', () => ({
  getGroups: vi.fn(),
  addGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroupDB: vi.fn(),
}));
vi.mock('../../services/broadcastService', () => ({
  postMessage: vi.fn(),
  useBroadcastListener: vi.fn(),
}));

const mockGroups: Group[] = [
  { id: 'g1', name: 'Roomies', participants: [], defaultSplit: { mode: 'equally' }, lastUpdatedAt: Date.now(), popularity: 10 },
  { id: 'g2', name: 'Work Lunch', participants: [], defaultSplit: { mode: 'equally' }, lastUpdatedAt: Date.now(), popularity: 5 },
];

describe('useGroups hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load groups on initial render', async () => {
    vi.mocked(getGroups).mockResolvedValue([...mockGroups]);
    const { result } = renderHook(() => useGroups());
    
    expect(result.current.isLoading).toBe(true);
    await act(async () => {});
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.groups).toHaveLength(2);
    expect(result.current.groups[0].name).toBe('Roomies');
  });

  it('should add a new group', async () => {
    vi.mocked(getGroups).mockResolvedValue([]);
    const { result } = renderHook(() => useGroups());
    await act(async () => {});

    const newGroupData = { name: 'Trip Friends', participants: [], defaultSplit: { mode: 'item' as const }, popularity: 0 };
    vi.mocked(getGroups).mockResolvedValueOnce([{...newGroupData, id: 'g3', lastUpdatedAt: Date.now()}]);

    await act(async () => {
      await result.current.addGroup(newGroupData);
    });

    expect(addGroup).toHaveBeenCalledWith(expect.objectContaining(newGroupData));
    expect(postMessage).toHaveBeenCalledWith({ type: 'groups-updated' });
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].name).toBe('Trip Friends');
  });

  it('should update an existing group', async () => {
    vi.mocked(getGroups).mockResolvedValue([...mockGroups]);
    const { result } = renderHook(() => useGroups());
    await act(async () => {});

    const groupToUpdate = { ...mockGroups[0], name: 'Apartment Mates' };
    
    await act(async () => {
      await result.current.updateGroup(groupToUpdate);
    });
    
    expect(updateGroup).toHaveBeenCalledWith(expect.objectContaining(groupToUpdate));
    expect(postMessage).toHaveBeenCalledWith({ type: 'groups-updated' });
  });

  it('should delete a group', async () => {
    vi.mocked(getGroups).mockResolvedValue([...mockGroups]);
    const { result } = renderHook(() => useGroups());
    await act(async () => {});

    vi.mocked(getGroups).mockResolvedValueOnce([mockGroups[1]]);

    await act(async () => {
      await result.current.deleteGroup('g1');
    });

    expect(deleteGroupDB).toHaveBeenCalledWith('g1');
    expect(postMessage).toHaveBeenCalledWith({ type: 'groups-updated' });
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].id).toBe('g2');
  });
});
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGroups } from '../../hooks/useGroups';
import type { Group } from '../../types';
import { getGroups, addGroup, updateGroup, deleteGroupDB } from '../../services/db';
import { postMessage } from '../../services/broadcastService';

vi.mock('../../services/db');
vi.mock('../../services/broadcastService');

const mockGroups: Group[] = [
  { id: 'g1', name: 'Roomies', participants: [], defaultSplit: { mode: 'equally' }, lastUpdatedAt: 1759694234875, popularity: 10 },
  { id: 'g2', name: 'Work Lunch', participants: [], defaultSplit: { mode: 'equally' }, lastUpdatedAt: 1759694234875, popularity: 5 },
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
  });

  it('should update an existing group', async () => {
    vi.mocked(getGroups).mockResolvedValue([...mockGroups]);
    const { result } = renderHook(() => useGroups());
    await act(async () => {});

    const groupToUpdate = { ...mockGroups[0], name: 'Apartment Mates' };
    
    await act(async () => {
      await result.current.updateGroup(groupToUpdate);
    });
    
    // FIX: Expect `lastUpdatedAt` to be any number because the hook generates a new timestamp.
    expect(updateGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'g1',
        name: 'Apartment Mates',
        lastUpdatedAt: expect.any(Number)
      })
    );
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
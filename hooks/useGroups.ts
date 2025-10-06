import { useState, useEffect, useCallback } from 'react';
import type { Group } from '../types';
import { getGroups, addGroup as addDB, updateGroup as updateDB, deleteGroupDB } from '../services/db';
import { postMessage, useBroadcastListener } from '../services/broadcastService';

const sortGroups = (groups: Group[]) => groups.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);

export const useGroups = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadGroups = useCallback(async (isInitialLoad: boolean = false) => {
        if (isInitialLoad) setIsLoading(true);
        try {
            const dbGroups = await getGroups();
            setGroups(sortGroups(dbGroups));
        } catch (err) {
            console.error("Failed to load groups:", err);
        } finally {
            if (isInitialLoad) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadGroups(true);
    }, [loadGroups]);

    useBroadcastListener(useCallback(message => {
        if (message.type === 'groups-updated') {
            loadGroups(false);
        }
    }, [loadGroups]));

    const addGroup = useCallback(async (newGroupData: Omit<Group, 'id' | 'lastUpdatedAt' | 'popularity'>) => {
        const newGroup: Group = {
            ...newGroupData,
            id: `group-${Date.now()}`,
            lastUpdatedAt: Date.now(),
            popularity: 0,
        };
        await addDB(newGroup);
        setGroups(prev => sortGroups([newGroup, ...prev]));
        postMessage({ type: 'groups-updated' });
        return newGroup;
    }, []);

    const updateGroup = useCallback(async (updatedGroup: Group) => {
        const groupWithTimestamp = { ...updatedGroup, lastUpdatedAt: Date.now() };
        await updateDB(groupWithTimestamp);
        setGroups(prev => sortGroups(prev.map(g => g.id === groupWithTimestamp.id ? groupWithTimestamp : g)));
        postMessage({ type: 'groups-updated' });
    }, []);

    const deleteGroup = useCallback(async (groupId: string) => {
        await deleteGroupDB(groupId);
        setGroups(prev => prev.filter(g => g.id !== groupId));
        postMessage({ type: 'groups-updated' });
    }, []);
    
    const incrementGroupPopularity = useCallback(async (groupId: string) => {
        const groupToUpdate = groups.find(g => g.id === groupId);
        if (groupToUpdate) {
            const updatedGroup = { ...groupToUpdate, popularity: (groupToUpdate.popularity || 0) + 1 };
            await updateDB(updatedGroup);
            setGroups(prev => sortGroups(prev.map(g => g.id === groupId ? updatedGroup : g)));
            postMessage({ type: 'groups-updated' });
        }
    }, [groups]);

    return { groups, addGroup, updateGroup, deleteGroup, incrementGroupPopularity, isLoading };
};
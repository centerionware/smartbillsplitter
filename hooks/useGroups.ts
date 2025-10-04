
import { useState, useEffect, useCallback } from 'react';
import type { Group } from '../types';
import { getGroups, addGroup as addDB, updateGroup as updateDB, deleteGroupDB } from '../services/db';
import { postMessage, useBroadcastListener } from '../services/broadcastService';

export const useGroups = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadGroups = useCallback(async (isInitialLoad: boolean = false) => {
        if (isInitialLoad) setIsLoading(true);
        try {
            const dbGroups = await getGroups();
            dbGroups.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
            setGroups(dbGroups);
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

    const addGroup = useCallback(async (newGroupData: Omit<Group, 'id' | 'lastUpdatedAt'>) => {
        const newGroup: Group = {
            ...newGroupData,
            id: `group-${Date.now()}`,
            lastUpdatedAt: Date.now(),
        };
        await addDB(newGroup);
        postMessage({ type: 'groups-updated' });
        await loadGroups(false);
        return newGroup;
    }, [loadGroups]);

    const updateGroup = useCallback(async (updatedGroup: Group) => {
        const groupWithTimestamp = { ...updatedGroup, lastUpdatedAt: Date.now() };
        await updateDB(groupWithTimestamp);
        postMessage({ type: 'groups-updated' });
        await loadGroups(false);
    }, [loadGroups]);

    const deleteGroup = useCallback(async (groupId: string) => {
        await deleteGroupDB(groupId);
        postMessage({ type: 'groups-updated' });
        await loadGroups(false);
    }, [loadGroups]);

    return { groups, addGroup, updateGroup, deleteGroup, isLoading };
};

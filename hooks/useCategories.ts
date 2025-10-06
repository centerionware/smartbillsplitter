import { useState, useEffect, useCallback } from 'react';
import type { Category } from '../types';
import { getCategories, saveMultipleCategories, deleteCategoryDB } from '../services/db';
import { postMessage, useBroadcastListener } from '../services/broadcastService';

const createDefaultCategories = (): Category[] => {
    const now = Date.now();
    return [
        { id: `cat-${now}-1`, name: 'Groceries', isDefault: true },
        { id: `cat-${now}-2`, name: 'Dining', isDefault: true },
        { id: `cat-${now}-3`, name: 'Transportation', isDefault: true },
        { id: `cat-${now}-4`, name: 'Utilities', isDefault: true },
        { id: `cat-${now}-5`, name: 'Entertainment', isDefault: true },
        { id: `cat-${now}-6`, name: 'Shopping', isDefault: true },
        { id: `cat-${now}-7`, name: 'Health', isDefault: true },
        { id: `cat-${now}-8`, name: 'Travel', isDefault: true },
        { id: `cat-${now}-9`, name: 'Home', isDefault: true },
        { id: `cat-${now}-10`, name: 'Other', isDefault: true },
    ];
};

const sortCategories = (categories: Category[]) => categories.sort((a, b) => a.name.localeCompare(b.name));

export const useCategories = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadCategories = useCallback(async (isInitialLoad: boolean = false) => {
        if (isInitialLoad) setIsLoading(true);
        try {
            let dbCategories = await getCategories();

            if (isInitialLoad && dbCategories.length === 0 && !localStorage.getItem('sharedbills.defaultCategoriesLoaded')) {
                console.log("First launch: creating default example categories.");
                const defaultCategories = createDefaultCategories();
                await saveMultipleCategories(defaultCategories);
                dbCategories.push(...defaultCategories);
                localStorage.setItem('sharedbills.defaultCategoriesLoaded', 'true');
            }
            
            setCategories(sortCategories(dbCategories));
        } catch (error) {
            console.error("Failed to load categories from IndexedDB:", error);
        } finally {
            if (isInitialLoad) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCategories(true);
    }, [loadCategories]);

    useBroadcastListener(useCallback(message => {
        if (message.type === 'categories-updated') {
            loadCategories(false);
        }
    }, [loadCategories]));

    const saveCategories = useCallback(async (updatedCategories: Category[]) => {
        await saveMultipleCategories(updatedCategories);
        setCategories(sortCategories(updatedCategories));
        postMessage({ type: 'categories-updated' });
    }, []);
    
    const deleteCategory = useCallback(async (categoryId: string) => {
        await deleteCategoryDB(categoryId);
        setCategories(prev => prev.filter(c => c.id !== categoryId));
        postMessage({ type: 'categories-updated' });
    }, []);

    return { categories, isLoading, saveCategories, deleteCategory };
};

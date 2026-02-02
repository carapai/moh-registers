import { useCallback, useState } from "react";

/**
 * Unified Tracker Modal Management Hook
 *
 * Consolidates modal state management across EventModal, TrackerRegistration,
 * and ProgramStageCapture components.
 *
 * Features:
 * - Modal open/close state
 * - Entity ID management
 * - Auto-incrementing key for forcing component re-initialization
 * - Type-safe callbacks
 *
 * Eliminates:
 * - Duplicate modal state in multiple components
 * - Multiple modalKey patterns
 * - Inconsistent modal reset logic
 */

interface UseTrackerModalReturn {
    isOpen: boolean;
    entityId: string | null;
    key: number;
    open: (id?: string) => void;
    close: () => void;
}

export function useTrackerModal(): UseTrackerModalReturn {
    const [isOpen, setIsOpen] = useState(false);
    const [entityId, setEntityId] = useState<string | null>(null);
    const [key, setKey] = useState(0);

    /**
     * Open modal with optional entity ID
     * Increments key to force re-initialization
     */
    const open = useCallback((id?: string) => {
        setEntityId(id || null);
        setKey((k) => k + 1);
        setIsOpen(true);
    }, []);

    /**
     * Close modal and reset entity ID
     */
    const close = useCallback(() => {
        setIsOpen(false);
        setEntityId(null);
    }, []);

    return {
        isOpen,
        entityId,
        key,
        open,
        close,
    };
}

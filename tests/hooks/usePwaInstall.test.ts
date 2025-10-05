import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePwaInstall } from '../../hooks/usePwaInstall';

// Mock event for beforeinstallprompt
const mockInstallPromptEvent = {
  platforms: ['web'],
  userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
  prompt: vi.fn(),
  preventDefault: vi.fn(),
};

describe('usePwaInstall hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset any previous event listeners
    window.dispatchEvent = vi.fn();
    window.addEventListener = vi.fn();
    window.removeEventListener = vi.fn();
  });

  it('should initially have canInstall as false', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.canInstall).toBe(false);
  });
  
  it('should set canInstall to true when beforeinstallprompt event is fired', () => {
    const { result } = renderHook(() => usePwaInstall());

    // Manually find the event listener that the hook attached
    const [event, listener] = vi.mocked(window.addEventListener).mock.calls.find(
      (call) => call[0] === 'beforeinstallprompt'
    ) || [];

    expect(event).toBe('beforeinstallprompt');
    
    // Simulate the event
    act(() => {
      (listener as EventListener)(mockInstallPromptEvent as unknown as Event);
    });

    expect(result.current.canInstall).toBe(true);
    expect(mockInstallPromptEvent.preventDefault).toHaveBeenCalled();
  });

  it('should call prompt on the event when promptInstall is called', async () => {
     const { result } = renderHook(() => usePwaInstall());

     const [event, listener] = vi.mocked(window.addEventListener).mock.calls.find(
      (call) => call[0] === 'beforeinstallprompt'
    ) || [];
    
    act(() => {
      (listener as EventListener)(mockInstallPromptEvent as unknown as Event);
    });

    expect(result.current.canInstall).toBe(true);
    
    await act(async () => {
      await result.current.promptInstall();
    });

    expect(mockInstallPromptEvent.prompt).toHaveBeenCalledTimes(1);
    // After prompting, the event is consumed and canInstall should be false
    expect(result.current.canInstall).toBe(false);
  });

  it('should set canInstall to false after appinstalled event', () => {
    const { result } = renderHook(() => usePwaInstall());

    const [beforeInstallEvent, beforeInstallListener] = vi.mocked(window.addEventListener).mock.calls.find(
      (call) => call[0] === 'beforeinstallprompt'
    ) || [];
    const [appInstalledEvent, appInstalledListener] = vi.mocked(window.addEventListener).mock.calls.find(
      (call) => call[0] === 'appinstalled'
    ) || [];

     act(() => {
      (beforeInstallListener as EventListener)(mockInstallPromptEvent as unknown as Event);
    });
    
    expect(result.current.canInstall).toBe(true);

    act(() => {
      (appInstalledListener as EventListener)(new Event('appinstalled'));
    });

    expect(result.current.canInstall).toBe(false);
  });
});
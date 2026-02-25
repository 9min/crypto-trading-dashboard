import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useToastStore, MAX_TOASTS } from './toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useToastStore.setState({ toasts: [] });
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 9)}`),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('addToast adds a toast with correct defaults', () => {
    const id = useToastStore.getState().addToast('Test message');
    const { toasts } = useToastStore.getState();

    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toEqual(
      expect.objectContaining({
        id,
        message: 'Test message',
        type: 'info',
        duration: 4000,
      }),
    );
  });

  it('addToast respects custom type and duration', () => {
    useToastStore.getState().addToast('Error occurred', 'error', 8000);
    const { toasts } = useToastStore.getState();

    expect(toasts[0].type).toBe('error');
    expect(toasts[0].duration).toBe(8000);
  });

  it('removeToast removes a specific toast by id', () => {
    const id1 = useToastStore.getState().addToast('First');
    const id2 = useToastStore.getState().addToast('Second');

    expect(useToastStore.getState().toasts).toHaveLength(2);

    useToastStore.getState().removeToast(id1);

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].id).toBe(id2);
  });

  it('removeToast is a no-op for unknown id', () => {
    useToastStore.getState().addToast('Existing');
    useToastStore.getState().removeToast('nonexistent-id');

    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('enforces FIFO cap of MAX_TOASTS', () => {
    for (let i = 0; i < MAX_TOASTS + 3; i++) {
      useToastStore.getState().addToast(`Toast ${i}`);
    }

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(MAX_TOASTS);
    // Oldest toasts (0, 1, 2) should be evicted; newest should remain
    expect(toasts[0].message).toBe(`Toast 3`);
    expect(toasts[MAX_TOASTS - 1].message).toBe(`Toast ${MAX_TOASTS + 2}`);
  });

  it('addToast returns a unique id', () => {
    const id1 = useToastStore.getState().addToast('A');
    const id2 = useToastStore.getState().addToast('B');

    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
  });
});

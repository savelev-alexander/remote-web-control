import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useQRRemote } from '../src/useQRRemote';

describe('useQRRemote', () => {
  let registerMock: ReturnType<typeof vi.fn>;
  let unregisterMock: ReturnType<typeof vi.fn>;
  let destroyMock: ReturnType<typeof vi.fn>;
  let showMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registerMock = vi.fn();
    unregisterMock = vi.fn();
    destroyMock = vi.fn();
    showMock = vi.fn();
    (window as unknown as { QRRemote: unknown }).QRRemote = {
      init: vi.fn().mockResolvedValue({
        sessionId: 'sess-test',
        register: registerMock,
        unregister: unregisterMock,
        showQR: showMock,
        hideQR: vi.fn(),
        destroy: destroyMock,
      }),
    };
  });

  it('exposes sessionId once init resolves', async () => {
    const { result } = renderHook(() => useQRRemote());
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.sessionId).toBe('sess-test');
  });

  it('forwards register and unregister to the handle', async () => {
    const { result } = renderHook(() => useQRRemote());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.register('btn-1', { kind: 'button', label: 'X', onAction: () => {} }));
    expect(registerMock).toHaveBeenCalledWith('btn-1', expect.objectContaining({ kind: 'button' }));

    act(() => result.current.unregister('btn-1'));
    expect(unregisterMock).toHaveBeenCalledWith('btn-1');
  });

  it('calls destroy on unmount', async () => {
    const { result, unmount } = renderHook(() => useQRRemote());
    await waitFor(() => expect(result.current.ready).toBe(true));
    unmount();
    expect(destroyMock).toHaveBeenCalled();
  });

  it('forwards showQR call', async () => {
    const { result } = renderHook(() => useQRRemote());
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.showQR());
    expect(showMock).toHaveBeenCalled();
  });
});

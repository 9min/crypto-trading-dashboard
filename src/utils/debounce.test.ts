import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the function after the specified delay', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('resets the timer on subsequent calls — only the last invocation fires', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(100);
    // Only 200ms since first call, but timer was reset
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('passes arguments to the underlying function', () => {
    const fn = vi.fn<(a: number, b: string) => void>();
    const debounced = debounce(fn, 100);

    debounced(42, 'hello');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith(42, 'hello');
  });

  it('uses the arguments from the last call when debouncing', () => {
    const fn = vi.fn<(v: string) => void>();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('cancel() prevents the pending call from executing', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(100);
    debounced.cancel();
    vi.advanceTimersByTime(200);

    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel() is a no-op when no call is pending', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    // Should not throw
    debounced.cancel();
    expect(fn).not.toHaveBeenCalled();
  });

  it('allows new calls after cancel()', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();

    debounced();
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledOnce();
  });
});

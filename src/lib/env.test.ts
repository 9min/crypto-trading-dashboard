import { validateEnv, getClientEnv, resetEnvValidation } from './env';

describe('env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetEnvValidation();
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateEnv', () => {
    it('returns empty array when all variables are set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const missing = validateEnv();

      expect(missing).toEqual([]);
    });

    it('returns missing variable names when some are unset', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const missing = validateEnv();

      expect(missing).toEqual(['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
    });

    it('returns all variable names when none are set', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const missing = validateEnv();

      expect(missing).toEqual(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
    });

    it('treats empty string as missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '  ';

      const missing = validateEnv();

      expect(missing).toEqual(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
    });

    it('logs a structured error when variables are missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      validateEnv();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        '[env] Missing environment variables',
        expect.objectContaining({
          component: 'env',
          action: 'validateEnv',
          missing: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
        }),
      );
    });

    it('does not log when all variables are present', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      validateEnv();

      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('only logs once across multiple calls', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      validateEnv();
      validateEnv();
      validateEnv();

      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getClientEnv', () => {
    it('returns env values when set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

      const env = getClientEnv();

      expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co');
      expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('test-key');
    });

    it('returns empty strings for unset variables', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const env = getClientEnv();

      expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('');
      expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('');
    });
  });
});

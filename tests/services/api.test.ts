import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from '../../services/api';

describe('api.fetchWithRetry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return a successful response on the first try', async () => {
    const mockResponse = new Response('OK', { status: 200 });
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

    const response = await fetchWithRetry('http://test.com');
    
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should not retry on a 4xx client error', async () => {
    const mockResponse = new Response('Not Found', { status: 404 });
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

    const response = await fetchWithRetry('http://test.com');

    expect(response.status).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on a 5xx server error and eventually succeed', async () => {
    const failResponse1 = new Response('Server Error', { status: 500 });
    const failResponse2 = new Response('Server Error', { status: 503 });
    const successResponse = new Response('OK', { status: 200 });
    
    vi.mocked(fetch)
      .mockResolvedValueOnce(failResponse1)
      .mockResolvedValueOnce(failResponse2)
      .mockResolvedValueOnce(successResponse);
    
    const response = await fetchWithRetry('http://test.com', {}, 4, 10); // 4 retries, 10ms backoff

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  
  it('should retry on a network failure and eventually succeed', async () => {
    const successResponse = new Response('OK', { status: 200 });
    
    vi.mocked(fetch)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(successResponse);

    const response = await fetchWithRetry('http://test.com', {}, 3, 10);

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw an error after all retries fail', async () => {
    const failResponse = new Response('Server Error', { status: 500 });
    vi.mocked(fetch).mockResolvedValue(failResponse);

    await expect(fetchWithRetry('http://test.com', {}, 3, 10))
      .rejects
      .toThrow('All fetch attempts failed');
      
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

import { TMDB_API_KEY, TMDB_BASE_URL, SCRAPER_API_URL } from '../constants';

const fetchWithTimeout = async (resource: RequestInfo, options: RequestInit & { timeout?: number } = {}) => {
  const { timeout = 45000, ...fetchOptions } = options; // Increased default timeout for scraper
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
      const response = await fetch(resource, {
        ...fetchOptions,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
  } catch(error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
          throw new Error('The request timed out. The server took too long to respond.');
      }
      // This is a common browser error for CORS issues or network failures.
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          throw new Error('Network Error: Could not connect to the server. Please ensure the backend server is running and configured for cross-origin requests.');
      }
      // Re-throw other unexpected errors.
      throw error;
  }
};


const fetchWithHeaders = async (url: string, options: RequestInit & { timeout?: number } = {}) => {
    const response = await fetchWithTimeout(url, options);
    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = await response.text();
        }
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData) || response.statusText}`);
    }
    const contentType = response.headers.get("content-type");
    return contentType?.includes("application/json") ? response.json() : response.text();
};


export const fetchFromTMDB = async (endpoint: string, params: Record<string, string | number | boolean> = {}) => {
  const lang = localStorage.getItem('cineStreamLanguage') || 'ar';
  const defaultParams = {
    api_key: TMDB_API_KEY,
    language: lang === 'ar' ? 'ar-SA' : 'en-US',
  };
  const urlParams = new URLSearchParams({ ...defaultParams, ...params } as Record<string, string>);
  const url = `${TMDB_BASE_URL}${endpoint}?${urlParams}`;
  return fetchWithHeaders(url);
};

export const fetchStreamUrl = async (
    title: string,
    media_type: 'movie' | 'tv',
    year?: string | null,
    season?: number | null,
    episode?: number | null
): Promise<{ quality: string, url: string }[]> => {
    const params = new URLSearchParams();
    params.append('title', title);
    // The new backend expects 'series' instead of 'tv'
    params.append('type', media_type === 'tv' ? 'series' : 'movie');
    
    // The backend script does not use 'year' for movies
    if (media_type === 'tv' && season) {
        params.append('season', String(season));
    }
    if (media_type === 'tv' && episode) {
        params.append('episode', String(episode));
    }

    const targetUrl = `${SCRAPER_API_URL}?${params.toString()}`;
    
    // Add the ngrok header to bypass the browser warning page.
    const responseData = await fetchWithHeaders(targetUrl, {
        headers: {
            'ngrok-skip-browser-warning': 'true',
        },
    });

    if (typeof responseData !== 'object' || responseData === null) {
        console.error('Invalid response from scraper API:', responseData);
        throw new Error('Scraper API returned an invalid response.');
    }
    
    const typedResponse = responseData as { status: string, links?: { quality: string, url: string }[], message?: string };

    if (typedResponse.status === 'success' && Array.isArray(typedResponse.links) && typedResponse.links.length > 0) {
        return typedResponse.links;
    } else {
        const errorMessage = typedResponse.message || 'Failed to get stream. The content might not be available.';
        throw new Error(errorMessage);
    }
};





export interface Movie {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  popularity?: number;
  genres?: { id: number; name: string }[];
  runtime?: number;
  media_type?: 'movie' | 'tv';
  itemType?: 'movie' | 'tv';
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
  credits?: { cast: { name:string }[] };
  production_companies?: { name: string }[];
  status?: string;
  original_title?: string;
  original_name?: string;
  recommendations?: { results: Movie[] };
  seasons?: Season[];
  number_of_seasons?: number;
  number_of_episodes?: number;
}

export interface Actor {
  id: number;
  name: string;
  profile_path: string | null;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  known_for_department: string;
  popularity: number;
  likes?: number;
  combined_credits?: {
    cast: Movie[];
  };
  images?: {
    profiles: { file_path: string }[];
  };
}

export interface TVShow extends Movie {
  name: string;
  first_air_date: string;
  number_of_seasons: number;
}

export interface Season {
  id: number;
  season_number: number;
  name: string;
  poster_path: string | null;
  episode_count: number;
}

export interface Episode {
  id: number;
  episode_number: number;
  name:string;
  overview: string;
  still_path: string | null;
}

export interface HistoryItem {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  itemImage: string;
  currentTime: number;
  duration: number;
  timestamp: number;
  episodeId?: number;
}

export interface FavoriteItem {
  id: number;
  title?: string;
  name?: string;
  poster?: string;
  type: 'movie' | 'tv';
  vote_average: number;
}

export interface DownloadItem {
  title: string;
  poster: string;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  type: 'ADULT' | 'KIDS';
  favorites: FavoriteItem[];
  history: HistoryItem[];
  lastSearches: Movie[];
  downloads: DownloadItem[];
  tastePreferences?: number[];
  followedActors?: number[];
}

export interface AccountData {
  screens: Profile[];
  activeScreenId: string | null;
}

export interface Short {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  videoKey: string;
  media_type: 'movie' | 'tv';
}

export interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
  getPlayerState: () => number;
}

declare global {
  interface Window {
    YT?: {
      Player: new (id:string, options: {
        videoId: string;
        playerVars?: Record<string, any>;
        events?: {
          onReady?: (event: { target: YTPlayer }) => void;
        };
      }) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
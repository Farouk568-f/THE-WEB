import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Profile, AccountData, HistoryItem, FavoriteItem, DownloadItem, Movie } from '../types';
import { useTranslation } from './LanguageContext';

interface ProfileContextType {
  accountData: AccountData | null;
  activeProfile: Profile | null;
  isKidsMode: boolean;
  isDarkMode: boolean;
  toast: { message: string, type: 'success' | 'error' | 'info' } | null;
  setToast: (toast: { message: string, type: 'success' | 'error' | 'info' } | null) => void;
  selectProfile: (profileId: string) => void;
  addProfile: (profile: Omit<Profile, 'id' | 'favorites' | 'history' | 'lastSearches' | 'downloads'>) => Profile | undefined;
  updateProfile: (profileId: string, updates: Partial<Pick<Profile, 'name' | 'avatar' | 'type'>>) => void;
  deleteProfile: (profileId: string) => void;
  getScreenSpecificData: <K extends keyof Profile>(key: K, defaultValue: Profile[K]) => Profile[K];
  setScreenSpecificData: <K extends keyof Profile>(key: K, value: Profile[K]) => void;
  toggleFavorite: (item: Movie | FavoriteItem) => void;
  isFavorite: (itemId: number) => boolean;
  updateHistory: (item: HistoryItem) => void;
  addDownload: (item: DownloadItem) => void;
  removeDownload: (title: string) => void;
  addLastSearch: (item: Movie) => void;
  clearLastSearches: () => void;
  setDarkMode: (isDark: boolean) => void;
  clearAllData: () => void;
  switchProfile: () => void;
  toggleFollowActor: (actorId: number) => void;
  isFollowingActor: (actorId: number) => boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const getLocalStorageItem = <T,>(key: string, defaultValue: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error(`LS Error get ${key}:`, e);
        return defaultValue;
    }
};

const setLocalStorageItem = <T,>(key: string, value: T) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`LS Error set ${key}:`, e);
    }
};

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isKidsMode, setIsKidsMode] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => getLocalStorageItem('darkMode', true));
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const data = getLocalStorageItem<AccountData>('cineStreamAccount', { screens: [], activeScreenId: null });
    setAccountData(data);
    if (data.activeScreenId) {
      const profile = data.screens.find(s => s.id === data.activeScreenId);
      if (profile) {
        setActiveProfile(profile);
        setIsKidsMode(profile.type === 'KIDS');
      }
    }
  }, []);
  
  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.style.backgroundColor = isDarkMode ? '#16161A' : '#F0F2F5';
  }, [isDarkMode]);

  const updateAccountData = useCallback((newData: AccountData) => {
    setAccountData(newData);
    setLocalStorageItem('cineStreamAccount', newData);
  }, []);
  
  const setDarkMode = (isDark: boolean) => {
    setIsDarkMode(isDark);
    setLocalStorageItem('darkMode', isDark);
  };

  const selectProfile = useCallback((profileId: string) => {
    if (accountData) {
      const newActiveProfile = accountData.screens.find(p => p.id === profileId);
      if (newActiveProfile) {
        setActiveProfile(newActiveProfile);
        setIsKidsMode(newActiveProfile.type === 'KIDS');
        updateAccountData({ ...accountData, activeScreenId: profileId });
      }
    }
  }, [accountData, updateAccountData]);

  const switchProfile = () => {
    if(accountData){
        setActiveProfile(null);
        setIsKidsMode(false);
        updateAccountData({ ...accountData, activeScreenId: null });
    }
  };

  const addProfile = useCallback((profileData: Omit<Profile, 'id' | 'favorites' | 'history' | 'lastSearches' | 'downloads'>): Profile | undefined => {
    if (accountData && accountData.screens.length < 5) {
      const newProfile: Profile = {
        id: `scr_${Date.now()}`,
        name: profileData.name,
        avatar: profileData.avatar,
        type: profileData.type,
        tastePreferences: profileData.tastePreferences || [],
        favorites: [],
        history: [],
        lastSearches: [],
        downloads: [],
        followedActors: [],
      };
      const newData = { ...accountData, screens: [...accountData.screens, newProfile] };
      updateAccountData(newData);
      setToast({ message: t('profileCreated'), type: 'success' });
      return newProfile;
    }
    return undefined;
  }, [accountData, updateAccountData, t]);
  
  const updateProfile = useCallback((profileId: string, updates: Partial<Pick<Profile, 'name' | 'avatar' | 'type'>>) => {
    if (accountData) {
      const newScreens = accountData.screens.map(p => p.id === profileId ? { ...p, ...updates } : p);
      const newData = { ...accountData, screens: newScreens };
      updateAccountData(newData);
      if (activeProfile?.id === profileId) {
        const updatedProfile = newScreens.find(p => p.id === profileId);
        if (updatedProfile) {
          setActiveProfile(updatedProfile);
          setIsKidsMode(updatedProfile.type === 'KIDS');
        }
      }
      setToast({ message: t('profileUpdated'), type: 'success' });
    }
  }, [accountData, updateAccountData, activeProfile, t]);
  
  const deleteProfile = useCallback((profileId: string) => {
    if (accountData && accountData.screens.length > 1) {
      const newScreens = accountData.screens.filter(p => p.id !== profileId);
      let newActiveId = accountData.activeScreenId;
      if (newActiveId === profileId) {
        newActiveId = null;
        setActiveProfile(null);
        setIsKidsMode(false);
      }
      const newData = { ...accountData, screens: newScreens, activeScreenId: newActiveId };
      updateAccountData(newData);
      setToast({ message: t('profileDeleted'), type: 'success' });
    }
  }, [accountData, updateAccountData, t]);

  const setScreenSpecificData = useCallback(<K extends keyof Profile>(key: K, value: Profile[K]) => {
    if (activeProfile && accountData) {
        const updatedProfile = { ...activeProfile, [key]: value };
        const newScreens = accountData.screens.map(p => p.id === activeProfile.id ? updatedProfile : p);
        setActiveProfile(updatedProfile);
        updateAccountData({ ...accountData, screens: newScreens });
    }
  }, [activeProfile, accountData, updateAccountData]);

  const getScreenSpecificData = useCallback(<K extends keyof Profile>(key: K, defaultValue: Profile[K]): Profile[K] => {
    return activeProfile?.[key] as Profile[K] ?? defaultValue;
  }, [activeProfile]);

  const toggleFavorite = useCallback((item: Movie | FavoriteItem) => {
    if (!item?.id || !activeProfile) return;

    const favorites = getScreenSpecificData('favorites', []);
    const isFav = favorites.some(f => f.id === item.id);
    let newFavorites: FavoriteItem[];

    if (isFav) {
        newFavorites = favorites.filter(f => f.id !== item.id);
        setToast({ message: t('removedFromFavorites'), type: 'info' });
    } else {
        if (!('poster_path' in item)) {
            console.error("Cannot add item to favorites: not a full Movie object.", item);
            setToast({ message: t('errorInsufficientInfo'), type: 'error' });
            return;
        }
        const movieItem = item as Movie;
        const favEntry: FavoriteItem = {
            id: movieItem.id,
            title: movieItem.title,
            name: movieItem.name,
            poster: movieItem.poster_path ? `${"https://image.tmdb.org/t/p/w500"}${movieItem.poster_path}` : '',
            type: movieItem.media_type || (movieItem.title ? 'movie' : 'tv'),
            vote_average: movieItem.vote_average
        };
        newFavorites = [...favorites, favEntry];
        setToast({ message: t('addedToFavorites'), type: 'success' });
    }
    setScreenSpecificData('favorites', newFavorites);
}, [getScreenSpecificData, setScreenSpecificData, activeProfile, setToast, t]);

  const toggleFollowActor = useCallback((actorId: number) => {
    if (!activeProfile) return;

    const followed = getScreenSpecificData('followedActors', []);
    const isFollowing = followed.includes(actorId);
    let newFollowed: number[];

    if (isFollowing) {
        newFollowed = followed.filter(id => id !== actorId);
        setToast({ message: t('unfollowedActor'), type: 'info' });
    } else {
        newFollowed = [...followed, actorId];
        setToast({ message: t('followedActor'), type: 'success' });
    }
    setScreenSpecificData('followedActors', newFollowed);
  }, [getScreenSpecificData, setScreenSpecificData, activeProfile, setToast, t]);

  const isFollowingActor = useCallback((actorId: number) => {
    if (!activeProfile) return false;
    const followed = getScreenSpecificData('followedActors', []);
    return followed.includes(actorId);
  }, [getScreenSpecificData, activeProfile]);


  const isFavorite = useCallback((itemId: number) => {
    if(!activeProfile) return false;
    const favorites = getScreenSpecificData('favorites', []);
    return favorites.some(f => f.id === itemId);
  }, [getScreenSpecificData, activeProfile]);

  const updateHistory = useCallback((itemToUpdate: HistoryItem) => {
      if (isKidsMode) return;
      const history = getScreenSpecificData('history', []);
      
      const newHistory = history.filter(h => {
        if (itemToUpdate.episodeId && h.episodeId) { // both are episodes
            return h.episodeId !== itemToUpdate.episodeId;
        }
        if (!itemToUpdate.episodeId && !h.episodeId) { // both are movies/show-level
            return h.id !== itemToUpdate.id;
        }
        // one is episode, one is movie, they can't be the same item
        return true; 
    });

      // Add the updated item to the beginning of the array.
      newHistory.unshift(itemToUpdate);

      // Limit the history to the last 20 items.
      const trimmedHistory = newHistory.slice(0, 20);

      setScreenSpecificData('history', trimmedHistory);
  }, [getScreenSpecificData, setScreenSpecificData, isKidsMode]);

  const addDownload = useCallback((item: DownloadItem) => {
    const downloads = getScreenSpecificData('downloads', []);
    if(!downloads.some(d => d.title === item.title)){
        setScreenSpecificData('downloads', [...downloads, item]);
        setToast({ message: t('downloadAdded', { title: item.title }), type: 'success'});
    } else {
        setToast({ message: t('itemAlreadyInDownloads', { title: item.title }), type: 'info'});
    }
  }, [getScreenSpecificData, setScreenSpecificData, setToast, t]);

  const removeDownload = useCallback((title: string) => {
    const downloads = getScreenSpecificData('downloads', []);
    setScreenSpecificData('downloads', downloads.filter(d => d.title !== title));
    setToast({ message: t('itemRemovedFromDownloads', { title: title }), type: 'info'});
  }, [getScreenSpecificData, setScreenSpecificData, setToast, t]);

  const addLastSearch = useCallback((item: Movie) => {
    let searches = getScreenSpecificData('lastSearches', []);
    searches = searches.filter(s => s.id !== item.id);
    searches.unshift(item);
    if(searches.length > 10) searches = searches.slice(0, 10);
    setScreenSpecificData('lastSearches', searches);
  }, [getScreenSpecificData, setScreenSpecificData]);

  const clearLastSearches = useCallback(() => {
    setScreenSpecificData('lastSearches', []);
  }, [setScreenSpecificData]);

  const clearAllData = useCallback(() => {
    setLocalStorageItem('cineStreamAccount', { screens: [], activeScreenId: null });
    setAccountData({ screens: [], activeScreenId: null });
    setActiveProfile(null);
    setIsKidsMode(false);
    setToast({ message: t('allDataCleared'), type: 'success' });
  }, [setToast, t]);

  return (
    <ProfileContext.Provider value={{
      accountData,
      activeProfile,
      isKidsMode,
      isDarkMode,
      toast,
      setToast,
      selectProfile,
      addProfile,
      updateProfile,
      deleteProfile,
      getScreenSpecificData,
      setScreenSpecificData,
      toggleFavorite,
      isFavorite,
      updateHistory,
      addDownload,
      removeDownload,
      addLastSearch,
      clearLastSearches,
      setDarkMode,
      clearAllData,
      switchProfile,
      toggleFollowActor,
      isFollowingActor,
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
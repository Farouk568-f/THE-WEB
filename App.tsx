

import React from 'react';
import { HashRouter, Routes, Route, Outlet } from 'react-router-dom';
import HomePage from './pages/HomePage';
import DetailsPage from './pages/DetailsPage';
import PlayerPage from './pages/PlayerPage';
import ProfilePage from './pages/ProfilePage';
import GenericPage from './pages/GenericPage';
import SettingsPage from './pages/SettingsPage';
import ActorDetailsPage from './pages/ActorDetailsPage';
import ShortsPage from './pages/ShortsPage';
import YouPage from './pages/YouPage';
import { ProfileProvider } from './contexts/ProfileContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { PlayerProvider } from './contexts/PlayerContext';
import { ToastContainer } from './components/common';
import PipPlayer from './components/PipPlayer';
import { useTranslation } from './contexts/LanguageContext';

const GenericPageWrapper: React.FC<{ pageType: 'favorites' | 'downloads' | 'search' | 'all' | 'subscriptions' }> = ({ pageType }) => {
  const { t } = useTranslation();
  const pageTitles = {
    favorites: t('favorites'),
    downloads: t('downloads'),
    search: t('search'),
    all: t('allCategory'),
    subscriptions: t('subscriptions')
  }
  return <GenericPage pageType={pageType} title={pageTitles[pageType]} />;
};


const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ProfileProvider>
        <HashRouter>
          <PlayerProvider>
            <Routes>
              <Route path="/" element={<ProfilePage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/details/:type/:id" element={<DetailsPage />} />
              <Route path="/actor/:id" element={<ActorDetailsPage />} />
              <Route path="/player" element={<PlayerPage />} />
              <Route path="/shorts" element={<ShortsPage />} />
              <Route path="/favorites" element={<GenericPageWrapper pageType="favorites" />} />
              <Route path="/downloads" element={<GenericPageWrapper pageType="downloads" />} />
              <Route path="/search" element={<GenericPageWrapper pageType="search" />} />
              <Route path="/all/:category" element={<GenericPageWrapper pageType="all" />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/you" element={<YouPage />} />
              <Route path="/subscriptions" element={<GenericPageWrapper pageType="subscriptions" />} />
            </Routes>
            <PipPlayer />
          </PlayerProvider>
        </HashRouter>
        <ToastContainer />
      </ProfileProvider>
    </LanguageProvider>
  );
};

export default App;
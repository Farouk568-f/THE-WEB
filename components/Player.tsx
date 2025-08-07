
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Movie, Episode } from '../types';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import { fetchStreamUrl, fetchFromTMDB } from '../services/apiService';
import IntroPlayer from './IntroPlayer';
import * as Icons from './Icons';
import { IMAGE_BASE_URL, BACKDROP_SIZE_MEDIUM } from '../constants';

interface Stream {
    quality: string;
    url: string;
}

interface PlayerProps {
    item: Movie;
    itemType: 'movie' | 'tv';
    initialSeason: number | undefined;
    initialEpisode: Episode | null;
    initialTime?: number;
    initialStreamUrl?: string;
    onEpisodesButtonClick?: () => void;
    isFav: boolean;
    onToggleFavorite: () => void;
    onShare: () => void;
    onDownload: () => void;
    onEnterPip: (streamUrl: string, currentTime: number, isPlaying: boolean, dimensions: DOMRect) => void;
}

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh > 0) return `${hh.toString().padStart(2, '0')}:${mm}:${ss}`;
    return `${mm}:${ss}`;
};

const VideoPlayer: React.FC<PlayerProps> = ({ item, itemType, initialSeason, initialEpisode, initialTime, initialStreamUrl, onEpisodesButtonClick, isFav, onToggleFavorite, onShare, onDownload, onEnterPip }) => {
    const navigate = useNavigate();
    const { setToast } = useProfile();
    const { t } = useTranslation();

    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTap = useRef(0);
    const seekIndicatorRef = useRef<{ el: HTMLDivElement, icon: HTMLElement, timer: ReturnType<typeof setTimeout> } | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [currentTime, setCurrentTime] = useState(initialTime || 0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [modals, setModals] = useState({ settings: false, subtitles: false });
    
    const [availableStreams, setAvailableStreams] = useState<Stream[]>([]);
    const [currentStream, setCurrentStream] = useState<Stream | null>(null);
    
    // Intro states
    const [showIntro, setShowIntro] = useState(true);
    const [introEnabled, setIntroEnabled] = useState(true); // Can be controlled by user settings

    const isModalOpen = Object.values(modals).some(Boolean);

    const hideControls = useCallback(() => {
        if (!videoRef.current?.paused && !isModalOpen) {
            setShowControls(false);
        }
    }, [isModalOpen]);

    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        setShowControls(true);
        controlsTimeoutRef.current = setTimeout(hideControls, 4000);
    }, [hideControls]);

    // Check if intro should be shown
    useEffect(() => {
        // Only show intro for TV shows and if intro is enabled
        const shouldShowIntro = itemType === 'tv' && introEnabled && !initialStreamUrl;
        setShowIntro(shouldShowIntro);
    }, [itemType, introEnabled, initialStreamUrl]);

    // Effect for fetching stream data
    useEffect(() => {
        // Don't fetch streams if intro is showing
        if (showIntro && introEnabled) return;

        const fetchAndSetStreams = async () => {
            setIsBuffering(true);
            if (initialStreamUrl) {
                const stream: Stream = { quality: t('auto'), url: initialStreamUrl };
                setAvailableStreams([stream]);
                setCurrentStream(stream);
                setIsBuffering(false);
                return;
            }
            try {
                // To ensure the scraper works for all languages, fetch the English title.
                // The backend scraper is optimized for English titles.
                const englishDetails = await fetchFromTMDB(`/${itemType}/${item.id}`, { language: 'en-US' });
                const englishTitle = englishDetails.title || englishDetails.name;

                // Use the fetched English title if available, otherwise fallback to the original title from the item prop.
                const titleToScrape = englishTitle || item.original_title || item.original_name || item.name || item.title;
                
                if (!englishTitle) {
                    console.warn("Could not get English title from TMDB. Falling back to available title:", titleToScrape);
                }
                
                const year = itemType === 'movie' ? (item.release_date?.substring(0, 4) || null) : null;
                const streams = await fetchStreamUrl(titleToScrape, itemType, year, initialSeason, initialEpisode?.episode_number);
                
                if (streams && streams.length > 0) {
                    streams.sort((a, b) => parseInt(a.quality) - parseInt(b.quality));
                    const preferredStream = streams.find(s => s.quality === '480') || streams[0];
                    setAvailableStreams(streams);
                    setCurrentStream(preferredStream);
                } else {
                    throw new Error("No stream links found.");
                }
            } catch (error: any) {
                setToast({ message: error.message || t('failedToLoadVideo'), type: "error" });
            }
        };

        if (item) fetchAndSetStreams();
    }, [item, itemType, initialSeason, initialEpisode, initialStreamUrl, setToast, t, showIntro, introEnabled]);
    
    // Effect for handling video source changes and autoplay
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !currentStream || showIntro) return;

        console.log("Setting up main video after intro");
        
        // Clear any existing source first
        video.src = '';
        video.load();
        
        // Small delay to ensure clean state
        const timer = setTimeout(() => {
            const videoElement = videoRef.current;
            if (videoElement && currentStream) {
                const savedTime = initialTime || 0;
                
                videoElement.src = currentStream.url;
                videoElement.load();

                // Wait for video to be ready before playing
                const onLoadedData = () => {
                    const playPromise = videoElement.play();
                    if (playPromise !== undefined) {
                        playPromise.then(() => {
                            if (savedTime > 0) {
                                videoElement.currentTime = savedTime;
                            }
                            setIsPlaying(true);
                            setIsBuffering(false);
                        }).catch(error => {
                            console.log("Autoplay was prevented.", error);
                            setIsPlaying(false);
                            setIsBuffering(false);
                        });
                    }
                    videoElement.removeEventListener('loadeddata', onLoadedData);
                };

                videoElement.addEventListener('loadeddata', onLoadedData);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [currentStream, initialTime, showIntro]);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
             video.play().catch(e => {
                console.error("Play action failed.", e);
                setToast({ message: t('failedToLoadVideo'), type: "error" });
            });
        }
        else {
             video.pause();
        }
        resetControlsTimeout();
    }, [resetControlsTimeout, setToast, t]);

    const handleContainerClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.controls-bar') || target.closest('.modal-content')) return;
        setShowControls(s => {
            if (!s) resetControlsTimeout();
            return !s;
        });
    }, [resetControlsTimeout]);

    const showSeekAnimation = (forward: boolean) => {
        if (!playerContainerRef.current) return;
        if (seekIndicatorRef.current && seekIndicatorRef.current.el) {
            clearTimeout(seekIndicatorRef.current.timer);
        } else {
            const el = document.createElement('div');
            const icon = document.createElement('i');
            el.className = `absolute top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/50 flex items-center justify-center text-white text-3xl z-20 pointer-events-none`;
            el.appendChild(icon);
            seekIndicatorRef.current = { el, icon, timer: -1 as any };
        }
        const { el, icon } = seekIndicatorRef.current;
        el.style.left = forward ? 'auto' : '15%';
        el.style.right = forward ? '15%' : 'auto';
        icon.className = `fa-solid ${forward ? 'fa-forward' : 'fa-backward'}`;

        if (!el.parentNode) playerContainerRef.current.appendChild(el);

        el.classList.remove('animate-double-tap');
        void el.offsetWidth;
        el.classList.add('animate-double-tap');

        seekIndicatorRef.current.timer = setTimeout(() => {
            el.remove();
            seekIndicatorRef.current = null;
        }, 600);
    };

    const handleSeek = (forward: boolean) => {
        const video = videoRef.current;
        if (video) {
            video.currentTime += forward ? 10 : -10;
            showSeekAnimation(forward);
        }
        resetControlsTimeout();
    };

    const handleDoubleTap = (e: React.TouchEvent) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const tapX = e.touches[0].clientX - rect.left;
        const width = rect.width;
        const now = new Date().getTime();
        if ((now - lastTap.current) < 400) {
            e.preventDefault();
            if (tapX < width / 3) handleSeek(false);
            else if (tapX > (width * 2) / 3) handleSeek(true);
            else togglePlay();
        }
        lastTap.current = now;
    };

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (video) {
            const newTime = parseFloat(e.target.value);
            video.currentTime = newTime;
            setCurrentTime(newTime);
        }
        resetControlsTimeout();
    };

    const toggleFullscreen = useCallback(() => {
        const elem = playerContainerRef.current;
        if (!elem) return;
        if (!document.fullscreenElement) elem.requestFullscreen().catch(err => console.error(`Fullscreen error: ${err.message}`));
        else document.exitFullscreen();
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || showIntro) return; // Don't attach listeners when intro is showing

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => setCurrentTime(video.currentTime);
        const onDurationChange = () => setDuration(video.duration || 0);
        const onWaiting = () => setIsBuffering(true);
        const onPlaying = () => {
             setIsBuffering(false);
             resetControlsTimeout();
        };
        const onProgress = () => { if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1)); };
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('progress', onProgress);
        
        // Update initial states
        setIsPlaying(!video.paused);
        setCurrentTime(video.currentTime);
        setDuration(video.duration || 0);
        setIsBuffering(video.readyState < 3 && !video.paused);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('progress', onProgress);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [resetControlsTimeout, showIntro]);

    useEffect(() => {
        resetControlsTimeout();
    }, [resetControlsTimeout]);



    const handleEnterPip = () => {
        if (videoRef.current && currentStream && playerContainerRef.current) {
            const dimensions = playerContainerRef.current.getBoundingClientRect();
            onEnterPip(currentStream.url, videoRef.current.currentTime, !videoRef.current.paused, dimensions);
        }
    }

    const openModal = (modal: 'settings' | 'subtitles') => {
        setModals({ settings: false, subtitles: false, [modal]: true });
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
    
    const handleQualityChange = (stream: Stream) => {
        if (stream.url === currentStream?.url) return;
        setCurrentStream(stream);
        setModals({ settings: false, subtitles: false });
    };

    const handleIntroEnd = () => {
        setShowIntro(false);
        // Reset states for main video
        setIsBuffering(true);
        setCurrentTime(0);
        setDuration(0);
        setBuffered(0);
        setIsPlaying(false);
        setShowControls(true);
        resetControlsTimeout();
    };

    const handleSkipIntro = () => {
        setShowIntro(false);
        // Reset states for main video  
        setIsBuffering(true);
        setCurrentTime(0);
        setDuration(0);
        setBuffered(0);
        setIsPlaying(false);
        setShowControls(true);
        resetControlsTimeout();
    };

    return (
        <div ref={playerContainerRef} className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden cursor-none" onClick={handleContainerClick} onTouchStart={handleDoubleTap}>
            {showIntro && introEnabled ? (
                <IntroPlayer
                    onIntroEnd={handleIntroEnd}
                    onSkipIntro={handleSkipIntro}
                    isFullscreen={isFullscreen}
                    toggleFullscreen={toggleFullscreen}
                    navigate={navigate}
                />
            ) : (
                <>
                    <video
                        ref={videoRef}
                        className="w-full h-full object-contain"
                        playsInline
                        muted={false}
                        crossOrigin="anonymous"
                        poster={item.backdrop_path ? `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}` : ''}
                        preload="auto"
                    />

                    {isBuffering && <div className="absolute w-12 h-12 border-4 border-t-transparent border-white rounded-full animate-spin z-20 pointer-events-none"></div>}

                    <div className={`absolute inset-0 bg-gradient-to-t from-black/70 to-transparent z-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'} pointer-events-none`}></div>

                    <div className={`absolute inset-0 transition-opacity duration-300 z-20 ${showControls ? 'opacity-100' : 'opacity-0'} ${isModalOpen ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                        <Controls
                            isPlaying={isPlaying}
                            isFav={isFav}
                            itemType={itemType}
                            currentTime={currentTime}
                            duration={duration}
                            buffered={buffered}
                            isFullscreen={isFullscreen}
                            togglePlay={togglePlay}
                            handleSeek={handleSeek}
                            handleProgressChange={handleProgressChange}
                            toggleFullscreen={toggleFullscreen}
                            handleEnterPip={handleEnterPip}
                            openModal={openModal}
                            onEpisodesButtonClick={onEpisodesButtonClick}
                            navigate={navigate}
                            onToggleFavorite={onToggleFavorite}
                            onShare={onShare}
                            onDownload={onDownload}
                            t={t}
                        />
                    </div>
                </>
            )}

            {isModalOpen &&
                <div className="absolute inset-0 bg-black/60 z-30 pointer-events-auto" onClick={(e) => { e.stopPropagation(); setModals({ settings: false, subtitles: false }) }}>
                    <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] rounded-t-2xl p-4 overflow-y-auto glassmorphic-panel animate-[slide-in-bottom_0.3s_ease-out_forwards] modal-content" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-1 mx-auto mb-4 bg-gray-600 rounded-full"></div>
                        {modals.settings &&
                            <div className="text-white space-y-2">
                                <div>
                                    <h4 className="mb-3 font-semibold text-lg">{t('playbackSpeed')}</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {[0.5, 1, 1.5, 2].map(rate => <button key={rate} onClick={() => { if (videoRef.current) videoRef.current.playbackRate = rate; setPlaybackRate(rate); }} className={`w-16 px-3 py-2 text-sm rounded-lg font-bold transition-colors ${playbackRate === rate ? 'bg-[var(--primary)] text-white' : 'bg-white/10 text-gray-300'}`}>{rate}x</button>)}
                                    </div>
                                </div>
                                <div className="pt-4 mt-4 border-t border-white/10">
                                    <h4 className="mb-3 font-semibold text-lg">{t('introSettings')}</h4>
                                    <button 
                                        onClick={() => setIntroEnabled(!introEnabled)}
                                        className={`w-full px-3 py-2 text-sm rounded-lg font-bold text-start transition-colors ${introEnabled ? 'bg-[var(--primary)] text-white' : 'bg-white/10 text-gray-300'}`}
                                    >
                                        {introEnabled ? t('introEnabled') : t('introDisabled')}
                                    </button>
                                </div>
                                {availableStreams.length > 0 && (
                                    <div className="pt-4 mt-4 border-t border-white/10">
                                        <h4 className="mb-3 font-semibold text-lg">{t('quality')}</h4>
                                        <div className="flex flex-col gap-2">
                                            {[...availableStreams].reverse().map((stream) => (
                                                <button
                                                    key={stream.url}
                                                    onClick={() => handleQualityChange(stream)}
                                                    className={`w-full px-3 py-2 text-sm rounded-lg font-bold text-start transition-colors ${currentStream?.url === stream.url ? 'bg-[var(--primary)] text-white' : 'bg-white/10 text-gray-300'}`}
                                                >
                                                    {stream.quality}p
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        }
                    </div>
                </div>
            }
        </div>
    );
};

const Controls: React.FC<any> = ({
    isPlaying, isFav, itemType, currentTime, duration, buffered, isFullscreen,
    togglePlay, handleSeek, handleProgressChange, toggleFullscreen, handleEnterPip, openModal,
    onEpisodesButtonClick, navigate, onToggleFavorite, onShare, onDownload, t
}) => (
    <div className="absolute inset-0 p-3 md:p-4 flex flex-col justify-between text-white controls-bar">
        {/* Top Controls */}
        <div className="flex items-center justify-between">
            <button onClick={() => isFullscreen ? toggleFullscreen() : navigate(-1)} className="w-10 h-10 text-xl pointer-events-auto"><Icons.BackIcon className="w-8 h-8" /></button>
            <div className="flex items-center gap-x-2 md:gap-x-4 text-2xl pointer-events-auto">
                {isFullscreen && <button onClick={onDownload} className="w-9 h-9"><i className="fa-solid fa-download"></i></button>}
                <button onClick={() => openModal('settings')} className="w-9 h-9"><Icons.SettingsIcon className="w-7 h-7" /></button>
                {isFullscreen && <button onClick={onToggleFavorite} className="w-9 h-9"><Icons.SaveIcon isSaved={isFav} className="w-7 h-7" /></button>}
            </div>
        </div>

        {/* Middle Controls (Fullscreen only) */}
        {isFullscreen &&
            <div className="flex items-center justify-center gap-x-12 pointer-events-auto">
                <button onClick={() => handleSeek(false)} className="text-4xl"><Icons.RewindIcon className="w-10 h-10" /></button>
                <button onClick={togglePlay} className="text-6xl transform transition-transform">
                    {isPlaying ? <Icons.PauseIcon className="w-16 h-16" /> : <Icons.PlayIcon className="w-16 h-16" />}
                </button>
                <button onClick={() => handleSeek(true)} className="text-4xl"><Icons.ForwardIcon className="w-10 h-10" /></button>
            </div>
        }

        {/* Bottom Controls */}
        <div className="pointer-events-auto">
            <div className="flex items-center gap-x-3 text-white px-1 text-xs md:text-sm" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.6)' }}>
                <span className="font-mono">{formatTime(currentTime)}</span>
                <div className="flex-grow"></div>
                <span className="font-mono">{formatTime(duration)}</span>
            </div>

            <div className="relative flex items-center group py-2">
                <input
                    type="range"
                    min="0"
                    max={duration || 1}
                    value={currentTime}
                    onChange={handleProgressChange}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer range-slider"
                    style={{ '--progress': `${(currentTime / duration) * 100}%`, '--buffered': `${(buffered / duration) * 100}%` } as React.CSSProperties}
                />
            </div>
            <div className="flex items-center justify-between mt-1">
                <div className='flex items-center gap-x-3'>
                    <button onClick={togglePlay} className="w-8 h-8 text-xl">
                        {isPlaying ? <Icons.PauseIcon className="w-6 h-6" /> : <Icons.PlayIcon className="w-6 h-6" />}
                    </button>
                    {itemType === 'tv' &&
                        <button onClick={onEpisodesButtonClick} className="px-3 py-1 text-sm bg-white/10 rounded-md transition-colors">
                            {t('episodes')}
                        </button>
                    }
                </div>
                <div className="flex items-center gap-x-3">
                    <button onClick={handleEnterPip} className="w-8 h-8 text-xl"><Icons.PipIcon className="w-6 h-6" /></button>
                    <button onClick={toggleFullscreen} className="w-8 h-8 text-xl">
                        {isFullscreen ? <Icons.ExitFullscreenIcon className="w-6 h-6" /> : <Icons.EnterFullscreenIcon className="w-6 h-6" />}
                    </button>
                </div>
            </div>
        </div>
        <style>{`
            .range-slider {
                background: linear-gradient(to right, var(--primary) 0%, var(--primary) var(--progress), rgba(255,255,255,0.4) var(--progress), rgba(255,255,255,0.4) var(--buffered), rgba(255,255,255,0.2) var(--buffered));
            }
            .range-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: white;
                cursor: pointer;
                transition: transform 0.2s;
                transform: scale(1);
            }
            .range-slider::-moz-range-thumb {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: white;
                cursor: pointer;
                border: none;
                transition: transform 0.2s;
                transform: scale(1);
            }
        `}</style>
    </div>
);

export default VideoPlayer;

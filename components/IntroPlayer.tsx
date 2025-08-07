import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../contexts/LanguageContext';
import * as Icons from './Icons';

interface IntroPlayerProps {
    onIntroEnd: () => void;
    onSkipIntro: () => void;
    isFullscreen: boolean;
    toggleFullscreen: () => void;
    navigate: any;
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

const IntroPlayer: React.FC<IntroPlayerProps> = ({ 
    onIntroEnd, 
    onSkipIntro, 
    isFullscreen, 
    toggleFullscreen, 
    navigate 
}) => {
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [showControls, setShowControls] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showSkipButton, setShowSkipButton] = useState(false);
    const [skipCountdown, setSkipCountdown] = useState(5);

    const hideControls = useCallback(() => {
        if (!videoRef.current?.paused) {
            setShowControls(false);
        }
    }, []);

    const resetControlsTimeout = useCallback(() => {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        setShowControls(true);
        controlsTimeoutRef.current = setTimeout(hideControls, 4000);
    }, [hideControls]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Set intro video source
        video.src = '/intro.mp4';
        video.load();

        // Start playing automatically
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                setIsPlaying(true);
                setIsBuffering(false);
            }).catch(error => {
                console.log("Autoplay was prevented.", error);
                setIsPlaying(false);
                setIsBuffering(false);
            });
        }
    }, []);

    // Show skip button after 3 seconds and start countdown
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSkipButton(true);
            
            // Start countdown
            let countdown = 5;
            const countdownInterval = setInterval(() => {
                countdown--;
                setSkipCountdown(countdown);
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    onSkipIntro();
                }
            }, 1000);

            skipTimeoutRef.current = countdownInterval as any;
        }, 3000);

        return () => {
            clearTimeout(timer);
            if (skipTimeoutRef.current) {
                clearInterval(skipTimeoutRef.current);
            }
        };
    }, [onSkipIntro]);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play().catch(e => console.error("Play action failed.", e));
        } else {
            video.pause();
        }
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    const handleContainerClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.controls-bar')) return;
        setShowControls(s => {
            if (!s) resetControlsTimeout();
            return !s;
        });
    }, [resetControlsTimeout]);

    const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (video) {
            const newTime = parseFloat(e.target.value);
            video.currentTime = newTime;
            setCurrentTime(newTime);
        }
        resetControlsTimeout();
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onTimeUpdate = () => setCurrentTime(video.currentTime);
        const onDurationChange = () => setDuration(video.duration || 0);
        const onWaiting = () => setIsBuffering(true);
        const onPlaying = () => {
            setIsBuffering(false);
            resetControlsTimeout();
        };
        const onEnded = () => onIntroEnd();

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('ended', onEnded);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('ended', onEnded);
        };
    }, [resetControlsTimeout, onIntroEnd]);

    useEffect(() => {
        resetControlsTimeout();
    }, [resetControlsTimeout]);

    return (
        <div 
            ref={playerContainerRef} 
            className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden cursor-none" 
            onClick={handleContainerClick}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                muted={false}
                crossOrigin="anonymous"
                preload="auto"
            />

            {isBuffering && (
                <div className="absolute w-12 h-12 border-4 border-t-transparent border-white rounded-full animate-spin z-20 pointer-events-none"></div>
            )}

            {/* Skip Intro Button */}
            {showSkipButton && (
                <div className="absolute top-4 right-4 z-30 pointer-events-auto">
                    <button 
                        onClick={onSkipIntro}
                        className="flex items-center gap-2 px-4 py-2 bg-black/70 text-white rounded-full font-medium transition-all hover:bg-black/90"
                    >
                        <span>{t('skipIntro')}</span>
                        <span className="text-sm opacity-75">({skipCountdown}s)</span>
                    </button>
                </div>
            )}

            <div className={`absolute inset-0 bg-gradient-to-t from-black/70 to-transparent z-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'} pointer-events-none`}></div>

            <div className={`absolute inset-0 transition-opacity duration-300 z-20 ${showControls ? 'opacity-100' : 'opacity-0'} pointer-events-auto`}>
                <div className="absolute inset-0 p-3 md:p-4 flex flex-col justify-between text-white controls-bar">
                    {/* Top Controls */}
                    <div className="flex items-center justify-between">
                        <button 
                            onClick={() => isFullscreen ? toggleFullscreen() : navigate(-1)} 
                            className="w-10 h-10 text-xl pointer-events-auto"
                        >
                            <Icons.BackIcon className="w-8 h-8" />
                        </button>
                        <div className="flex items-center text-lg font-medium">
                            <span className="px-3 py-1 bg-[var(--primary)]/20 rounded-full border border-[var(--primary)]/30">
                                {t('intro')}
                            </span>
                        </div>
                    </div>

                    {/* Middle Controls (Fullscreen only) */}
                    {isFullscreen && (
                        <div className="flex items-center justify-center gap-x-12 pointer-events-auto">
                            <button onClick={togglePlay} className="text-6xl transform transition-transform">
                                {isPlaying ? <Icons.PauseIcon className="w-16 h-16" /> : <Icons.PlayIcon className="w-16 h-16" />}
                            </button>
                        </div>
                    )}

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
                                style={{ '--progress': `${(currentTime / duration) * 100}%` } as React.CSSProperties}
                            />
                        </div>

                        <div className="flex items-center justify-between mt-1">
                            <div className='flex items-center gap-x-3'>
                                <button onClick={togglePlay} className="w-8 h-8 text-xl">
                                    {isPlaying ? <Icons.PauseIcon className="w-6 h-6" /> : <Icons.PlayIcon className="w-6 h-6" />}
                                </button>
                                <button 
                                    onClick={onSkipIntro}
                                    className="px-3 py-1 text-sm bg-white/10 rounded-md transition-colors hover:bg-white/20"
                                >
                                    {t('skipIntro')}
                                </button>
                            </div>
                            <div className="flex items-center gap-x-3">
                                <button onClick={toggleFullscreen} className="w-8 h-8 text-xl">
                                    {isFullscreen ? <Icons.ExitFullscreenIcon className="w-6 h-6" /> : <Icons.EnterFullscreenIcon className="w-6 h-6" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .range-slider {
                    background: linear-gradient(to right, var(--primary) 0%, var(--primary) var(--progress), rgba(255,255,255,0.2) var(--progress));
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
};

export default IntroPlayer;

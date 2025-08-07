import React, { useEffect } from 'react';

interface IntroPreloaderProps {
    onPreloadComplete?: () => void;
}

const IntroPreloader: React.FC<IntroPreloaderProps> = ({ onPreloadComplete }) => {
    useEffect(() => {
        // Create a hidden video element to preload the intro
        const preloadVideo = document.createElement('video');
        preloadVideo.src = '/intro.mp4';
        preloadVideo.preload = 'auto';
        preloadVideo.style.display = 'none';
        preloadVideo.muted = true; // Required for autoload in many browsers
        
        // Add to DOM to trigger loading
        document.body.appendChild(preloadVideo);

        const onCanPlayThrough = () => {
            console.log('Intro video preloaded successfully');
            onPreloadComplete?.();
            preloadVideo.removeEventListener('canplaythrough', onCanPlayThrough);
        };

        const onError = () => {
            console.warn('Failed to preload intro video');
            preloadVideo.removeEventListener('error', onError);
        };

        preloadVideo.addEventListener('canplaythrough', onCanPlayThrough);
        preloadVideo.addEventListener('error', onError);

        // Start loading
        preloadVideo.load();

        // Cleanup function
        return () => {
            preloadVideo.removeEventListener('canplaythrough', onCanPlayThrough);
            preloadVideo.removeEventListener('error', onError);
            if (document.body.contains(preloadVideo)) {
                document.body.removeChild(preloadVideo);
            }
        };
    }, [onPreloadComplete]);

    return null; // This component doesn't render anything
};

export default IntroPreloader;

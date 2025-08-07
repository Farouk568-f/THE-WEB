

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import VideoPlayer from '../components/Player';
import { Movie, Episode, Season, HistoryItem } from '../types';
import { fetchFromTMDB } from '../services/apiService';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import { usePlayer, PipData } from '../contexts/PlayerContext';
import { IMAGE_BASE_URL, POSTER_SIZE, BACKDROP_SIZE, BACKDROP_SIZE_MEDIUM } from '../constants';

const SimilarItemCard: React.FC<{ item: Movie }> = ({ item }) => {
  const navigate = useNavigate();
  const type = item.media_type || (item.title ? 'movie' : 'tv');
  
  const handleClick = () => {
    navigate(`/details/${type}/${item.id}`);
  };

  if (!item.poster_path) return null;

  return (
    <div
      onClick={handleClick}
      className="flex-shrink-0 w-36 md:w-40 cursor-pointer group"
    >
      <div className="relative overflow-hidden transition-all duration-300 ease-in-out transform rounded-xl shadow-lg bg-[var(--surface)] border-2 border-transparent">
        <img
          src={`${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}`}
          srcSet={`${IMAGE_BASE_URL}w342${item.poster_path} 342w, ${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path} 500w`}
          sizes="(max-width: 767px) 144px, 160px"
          alt={item.title || item.name}
          className="object-cover w-full aspect-[2/3]"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center transition-all duration-300 opacity-0 bg-black/50">
           <i className="text-3xl text-white fa-solid fa-play"></i>
        </div>
      </div>
      <div className="pt-2">
        <h3 className="text-sm font-semibold text-white truncate">{item.title || item.name}</h3>
      </div>
    </div>
  );
};

const DUMMY_COMMENTS_DATA = {
    ar: [
        { id: 1, user: 'أحمد علي', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', text: 'فيلم رائع! أحببت القصة والمؤثرات البصرية.', time: 'منذ ساعتين' },
        { id: 2, user: 'فاطمة الزهراء', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', text: 'نهاية غير متوقعة على الإطلاق. أنصح بمشاهدته.', time: 'منذ 5 ساعات' },
        { id: 3, user: 'خالد عبدالله', avatar: 'https://randomuser.me/api/portraits/men/55.jpg', text: 'لم يعجبني كثيرا، كان مملاً في بعض الأجزاء.', time: 'منذ يوم واحد' },
    ],
    en: [
        { id: 1, user: 'Ahmed Ali', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', text: 'Great movie! I loved the story and the visual effects.', time: '2 hours ago' },
        { id: 2, user: 'Fatima Al-Zahra', avatar: 'https://randomuser.me/api/portraits/women/44.jpg', text: 'A completely unexpected ending. I recommend watching it.', time: '5 hours ago' },
        { id: 3, user: 'Khalid Abdullah', avatar: 'https://randomuser.me/api/portraits/men/55.jpg', text: "I didn't like it that much, it was boring in some parts.", time: '1 day ago' },
    ]
}

const PlayerPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { item: initialItem, type, season: initialSeason, episode: initialEpisode, currentTime, streamUrl } = location.state || {};
    const { isFavorite, toggleFavorite, setToast, activeProfile, addDownload, updateHistory } = useProfile();
    const { t, language } = useTranslation();
    const { setPipData, setPipAnchor } = usePlayer();

    const [item, setItem] = useState<Movie | null>(initialItem);
    const [currentSeason, setCurrentSeason] = useState<number | undefined>(initialSeason);
    const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(initialEpisode);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);
    const [descriptionExpanded, setDescriptionExpanded] = useState(false);
    const [isEpisodesPanelOpen, setIsEpisodesPanelOpen] = useState(false);
    const [isCommentsPanelOpen, setIsCommentsPanelOpen] = useState(false);
    const DUMMY_COMMENTS = DUMMY_COMMENTS_DATA[language];

    const formatCount = (num: number | undefined) => {
        if (num === undefined) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return num.toString();
    };


    useEffect(() => {
        setPipData(null); // Clear any existing PiP when the main player opens

        if (!initialItem) {
            navigate('/home', { replace: true });
            return;
        }

        const fetchAllData = async () => {
            setLoading(true);
            try {
                const data = streamUrl ? initialItem : await fetchFromTMDB(`/${type}/${initialItem.id}`, { append_to_response: 'recommendations,content_ratings' });
                setItem(data);
                
                if (type === 'tv') {
                    const seasonToFetch = currentSeason || (data.seasons?.find((s: Season) => s.season_number > 0 && s.episode_count > 0)?.season_number ?? 1);
                    setCurrentSeason(seasonToFetch);
                    if (data.id && seasonToFetch) {
                        const seasonData = await fetchFromTMDB(`/tv/${data.id}/season/${seasonToFetch}`);
                        setEpisodes(seasonData.episodes);
                        if (!currentEpisode) {
                           const firstEpisode = seasonData.episodes.find((ep: Episode) => ep.episode_number > 0) || seasonData.episodes[0];
                           setCurrentEpisode(firstEpisode);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch player page data:", error);
                setToast({ message: t('failedToLoadDetails'), type: 'error' });
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();

    }, [initialItem?.id, type, navigate, setPipData]);
    
     useEffect(() => {
        const video = document.querySelector('video'); // A more direct way to get the video element from the player
        return () => {
            if (video && item && video.duration > 0 && video.currentTime > 0) {
                const progress = (video.currentTime / video.duration) * 100;
                if (progress > 5 && progress < 95) { // Only save meaningful progress
                    const historyItem: HistoryItem = {
                        id: item.id,
                        type: type,
                        title: initialEpisode ? `${item.name}: S${initialSeason}E${initialEpisode.episode_number}` : (item.name || item.title),
                        itemImage: item.backdrop_path ? `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}` : '',
                        currentTime: video.currentTime,
                        duration: video.duration,
                        timestamp: Date.now(),
                        episodeId: initialEpisode?.id,
                    };
                    updateHistory(historyItem);
                }
            }
        };
    }, [item, type, initialSeason, initialEpisode, updateHistory]);


    const handleSeasonChange = async (seasonNumber: number) => {
        if (!item?.id) return;
        setCurrentSeason(seasonNumber);
        setEpisodes([]); // Clear old episodes
        try {
            const seasonData = await fetchFromTMDB(`/tv/${item.id}/season/${seasonNumber}`);
            setEpisodes(seasonData.episodes);
        } catch (error) {
            console.error("Failed to fetch season", error);
            setToast({ message: t('failedToLoadEpisodes'), type: 'error' });
        }
    };
    
    const handleEpisodeSelect = (episode: Episode) => {
        navigate('/player', { replace: true, state: { item, type, season: currentSeason, episode }});
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSelectEpisodeAndClosePanel = (episode: Episode) => {
        handleEpisodeSelect(episode);
        setIsEpisodesPanelOpen(false);
    };

    const handleEnterPip = (url: string, time: number, playing: boolean, dimensions: DOMRect) => {
        const pipState: PipData = {
            item,
            type,
            season: currentSeason,
            episode: currentEpisode,
            currentTime: time,
            isPlaying: playing,
            streamUrl: url,
        };
        setPipAnchor({
            top: dimensions.top,
            left: dimensions.left,
            width: dimensions.width,
            height: dimensions.height,
        });
        setPipData(pipState);
        navigate(-1);
    };
    
    if (loading || !item) {
        return <div className="flex items-center justify-center h-screen bg-black"><div className="w-16 h-16 border-4 border-t-transparent border-[var(--primary)] rounded-full animate-spin"></div></div>;
    }
    
    const isFav = isFavorite(item.id);
    const title = currentEpisode ? `${item.name || item.title}: E${currentEpisode.episode_number} "${currentEpisode.name}"` : (item.title || item.name);
    const overview = currentEpisode?.overview || item.overview;
    const ratingObj = item.content_ratings?.results.find(r => r.iso_3166_1 === 'US');
    
    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: title,
                text: `Watch "${title}" on CineStream!`,
                url: window.location.href,
            }).catch(err => console.log('Error sharing:', err));
        } else {
            navigator.clipboard.writeText(window.location.href);
            setToast({message: t('shareLinkCopied'), type: 'info'});
        }
    };

    const handleDownload = () => {
        addDownload({ title: title, poster: item.poster_path ? `${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}` : '' });
    };

    return (
        <div className="bg-[var(--background)] min-h-screen text-white">
            <div className="w-full aspect-video bg-black sticky top-0 z-30">
                <VideoPlayer
                    key={`${currentEpisode?.id || item.id}-${streamUrl}`}
                    item={item}
                    itemType={type}
                    initialSeason={currentSeason}
                    initialEpisode={currentEpisode}
                    initialTime={currentTime}
                    initialStreamUrl={streamUrl}
                    isFav={isFav}
                    onToggleFavorite={() => toggleFavorite(item)}
                    onShare={handleShare}
                    onDownload={handleDownload}
                    onEnterPip={handleEnterPip}
                    onEpisodesButtonClick={() => setIsEpisodesPanelOpen(true)}
                />
            </div>

            <div className="p-4 space-y-4">
                <section>
                    <h1 className="text-xl font-bold leading-tight">{title}</h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
                        <span className="flex items-center gap-1.5"><i className="text-yellow-400 fa-solid fa-star"></i>{item.vote_average.toFixed(1)}</span>
                        <span>{item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4)}</span>
                        {ratingObj?.rating && <span className='px-1.5 py-0.5 border border-white/30 text-xs rounded'>{ratingObj.rating}</span>}
                        {item.runtime ? <span>{Math.floor(item.runtime/60)}{t('hoursShort')} {item.runtime%60}{t('minutesShort')}</span> : type === 'tv' && <span>{item.number_of_seasons} {t('seasons')}</span>}
                    </div>
                </section>
                
                {overview && (
                    <section onClick={() => setDescriptionExpanded(!descriptionExpanded)} className="p-3 rounded-xl bg-[var(--surface)] cursor-pointer">
                        <p className={`text-sm text-gray-300 transition-all duration-300 ${!descriptionExpanded && 'line-clamp-3'}`}>
                            {overview}
                        </p>
                         <button className="mt-2 text-sm font-bold text-[var(--primary)]">
                            {descriptionExpanded ? t('showLess') : t('showMore')}
                        </button>
                    </section>
                )}

                <section>
                     <button 
                        onClick={() => setIsCommentsPanelOpen(true)}
                        className="w-full text-start p-4 rounded-xl bg-[var(--surface)] transition-colors"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <h3 className="font-bold text-base">{t('comments')}</h3>
                            <span className="text-gray-400 text-sm font-medium">{formatCount(1100)}</span>
                        </div>
                        {DUMMY_COMMENTS.length > 0 && (
                            <div className="flex items-center gap-3">
                                <img src={DUMMY_COMMENTS[0].avatar} alt="commenter avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                <p className="text-sm text-gray-200 truncate">{DUMMY_COMMENTS[0].text}</p>
                            </div>
                        )}
                    </button>
                </section>
                
                {item.recommendations?.results && item.recommendations.results.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold mb-4">{t('similar')}</h2>
                        <div className="flex pb-4 -mx-4 overflow-x-auto no-scrollbar sm:mx-0">
                            <div className="flex flex-nowrap gap-x-4 px-4">
                                {item.recommendations.results.slice(0, 10).map(rec => <SimilarItemCard key={rec.id} item={rec} />)}
                            </div>
                        </div>
                    </section>
                )}
            </div>
            
            {isEpisodesPanelOpen && (
                 <div className="fixed inset-0 bg-black/60 z-40 animate-fade-in" style={{animationDuration: '0.3s'}} onClick={() => setIsEpisodesPanelOpen(false)}>
                   <div 
                        className="absolute bottom-0 left-0 right-0 p-4 rounded-t-2xl glassmorphic-panel animate-[slide-in-bottom_0.3s_ease-out_forwards]"
                        style={{ maxHeight: '70vh' }}
                        onClick={e => e.stopPropagation()}
                   >
                        <div className="w-12 h-1.5 mx-auto mb-4 bg-gray-600 rounded-full"></div>
                        <div className="text-white">
                            <div className="flex items-center justify-between mb-4">
                                 <h3 className="text-xl font-bold">{t('episodes')}</h3>
                                 {item.seasons && (
                                     <div className="relative">
                                        <select 
                                            value={currentSeason}
                                            onChange={(e) => handleSeasonChange(parseInt(e.target.value))}
                                            className="ps-8 pe-4 py-2 text-white bg-white/10 border border-white/20 rounded-full appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                                        >
                                        {item.seasons?.filter(s => s.season_number > 0 && s.episode_count > 0).map(season => (
                                            <option key={season.id} value={season.season_number}>
                                                {t('season')} {season.season_number}
                                            </option>
                                        ))}
                                        </select>
                                        <div className="absolute inset-y-0 flex items-center px-2 pointer-events-none start-1">
                                            <i className="text-gray-400 fa-solid fa-chevron-down text-xs"></i>
                                        </div>
                                    </div>
                                 )}
                            </div>
                            <div className="flex flex-col gap-3 overflow-y-auto" style={{maxHeight: 'calc(70vh - 100px)'}}>
                                {episodes?.map(ep => (
                                    <div key={ep.id} onClick={() => handleSelectEpisodeAndClosePanel(ep)} 
                                        className={`flex items-start gap-4 p-2 rounded-lg cursor-pointer transition-colors duration-200 ${currentEpisode?.id === ep.id ? 'bg-[var(--primary)]/70' : 'bg-white/10'}`}>
                                        <div className="relative flex-shrink-0">
                                            <img src={ep.still_path ? `${IMAGE_BASE_URL}w300${ep.still_path}` : `${IMAGE_BASE_URL}${BACKDROP_SIZE_MEDIUM}${item.backdrop_path}`} 
                                                srcSet={ep.still_path ? `${IMAGE_BASE_URL}w185${ep.still_path} 185w, ${IMAGE_BASE_URL}w300${ep.still_path} 300w` : undefined}
                                                sizes="144px"
                                                alt={ep.name} className="object-cover w-36 h-20 rounded-md" />
                                            {currentEpisode?.id === ep.id && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-md">
                                                    <i className="text-3xl text-white fa-solid fa-volume-high"></i>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 pt-1">
                                            <h4 className="font-semibold text-sm line-clamp-2">{ep.episode_number}. {ep.name}</h4>
                                            <p className="text-xs text-gray-400 line-clamp-2 mt-1">{ep.overview}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                   </div>
                 </div>
            )}

            {isCommentsPanelOpen && (
                <div className="fixed inset-0 bg-black/60 z-40 animate-fade-in" style={{animationDuration: '0.3s'}} onClick={() => setIsCommentsPanelOpen(false)}>
                  <div 
                       className="absolute bottom-0 left-0 right-0 p-4 glassmorphic-panel rounded-t-2xl animate-[slide-in-bottom_0.3s_ease-out_forwards]"
                       style={{ maxHeight: '70vh' }}
                       onClick={e => e.stopPropagation()}
                  >
                       <div className="w-12 h-1.5 mx-auto mb-4 bg-gray-600 rounded-full"></div>
                       <div className="text-white">
                           <h3 className="text-xl font-bold mb-4">{t('comments')} ({formatCount(1100)})</h3>
                           <div className="space-y-4 overflow-y-auto" style={{maxHeight: 'calc(70vh - 100px)'}}>
                               {/* Add comment form */}
                               <div className="flex items-start gap-3">
                                   <img src={activeProfile?.avatar} alt="Your avatar" className="w-10 h-10 rounded-full object-cover" />
                                   <div className="flex-1">
                                       <textarea
                                           rows={2}
                                           placeholder={t('addComment')}
                                           className="w-full p-2 text-sm text-white bg-transparent border-b-2 border-gray-600 rounded-t-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
                                       ></textarea>
                                       <div className="flex justify-end mt-2">
                                           <button onClick={() => { setToast({message: t('commentPosted'), type: 'success'}); setIsCommentsPanelOpen(false); }} className="px-4 py-1.5 text-sm font-bold text-white bg-[var(--primary)] rounded-full transition-opacity">{t('post')}</button>
                                       </div>
                                   </div>
                               </div>

                               {/* Comments list */}
                               <div className="space-y-5 pt-4">
                                   {DUMMY_COMMENTS.map(comment => (
                                       <div key={comment.id} className="flex items-start gap-3">
                                           <img src={comment.avatar} alt={comment.user} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                                           <div className="flex-1">
                                               <div className="flex items-baseline gap-2">
                                                   <p className="font-semibold text-white">{comment.user}</p>
                                                   <p className="text-xs text-gray-500">{comment.time}</p>
                                               </div>
                                               <p className="text-sm text-gray-300 mt-1">{comment.text}</p>
                                           </div>
                                       </div>
                                   ))}
                               </div>
                           </div>
                       </div>
                  </div>
                </div>
            )}
        </div>
    );
};

export default PlayerPage;
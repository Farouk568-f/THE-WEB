import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import Layout from '../components/Layout';
import { fetchFromTMDB } from '../services/apiService';
import { Movie, FavoriteItem } from '../types';
import { IMAGE_BASE_URL, POSTER_SIZE } from '../constants';


const ItemCard: React.FC<{ item: Movie | FavoriteItem, onDelete?: (item: Movie | FavoriteItem) => void, index: number }> = ({ item, onDelete, index }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const id = item.id;
    const title = item.title || item.name;
    const posterUrl = 'poster_path' in item && item.poster_path ? `${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}` : ('poster' in item ? item.poster : undefined);
    const posterPath = 'poster_path' in item && item.poster_path ? item.poster_path : null;
    const type = 'media_type' in item && item.media_type ? item.media_type : ('type' in item ? item.type : (item.title ? 'movie' : 'tv'));
    const year = ('release_date' in item && item.release_date && item.release_date.length > 0)
        ? item.release_date.substring(0, 4)
        : (('first_air_date' in item && item.first_air_date && item.first_air_date.length > 0) ? item.first_air_date.substring(0, 4) : '');

    if (!posterUrl) return null;

    return (
        <div 
            className="w-full animate-grid-item cursor-pointer" 
            style={{ animationDelay: `${index * 30}ms` }}
            onClick={() => navigate(`/details/${type}/${id}`)}
        >
            <div className="relative overflow-hidden transition-all duration-300 ease-in-out rounded-xl shadow-lg bg-[var(--surface)] interactive-card">
                 <img
                    src={posterUrl}
                    srcSet={posterPath ? `${IMAGE_BASE_URL}w342${posterPath} 342w, ${IMAGE_BASE_URL}${POSTER_SIZE}${posterPath} 500w` : undefined}
                    sizes="(max-width: 639px) 46vw, (max-width: 767px) 30vw, (max-width: 1023px) 22vw, (max-width: 1279px) 18vw, 15vw"
                    alt={title}
                    className="object-cover w-full aspect-[2/3]"
                    loading="lazy"
                />
                 {onDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                        className="absolute z-10 flex items-center justify-center w-8 h-8 text-white transition-opacity bg-red-600 rounded-full top-2 end-2 opacity-80 hover:opacity-100"
                        aria-label={t('delete', {item: title || ''})}
                    >
                        <i className="text-sm fa-solid fa-trash-can"></i>
                    </button>
                 )}
            </div>
             <div className="pt-3">
                <h3 className="text-sm font-bold text-white truncate">{title}</h3>
                <div className="flex items-center justify-between mt-1 text-xs text-[var(--text-dark)]">
                    <span>{year}</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase border rounded-full border-white/20 bg-white/10">{t(type === 'tv' ? 'series' : 'movie')}</span>
                </div>
             </div>
        </div>
    );
};

const SkeletonCard: React.FC = () => (
    <div className="w-full animate-pulse">
        <div className="aspect-[2/3] w-full rounded-xl bg-[var(--surface)]"></div>
        <div className="w-3/4 h-4 mt-3 bg-[var(--surface)] rounded-md"></div>
        <div className="w-1/2 h-3 mt-2 bg-[var(--surface)] rounded-md"></div>
    </div>
);


const GenericPage: React.FC<{
    pageType: 'favorites' | 'downloads' | 'search' | 'all' | 'subscriptions',
    title: string
}> = ({ pageType, title }) => {
    const { getScreenSpecificData, toggleFavorite, addLastSearch, clearLastSearches, activeProfile } = useProfile();
    const { t, language } = useTranslation();
    const [content, setContent] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const { category } = useParams<{category: string}>();
    
    // Search page specific state
    const [allResults, setAllResults] = useState<Movie[]>([]);
    const [activeFilter, setActiveFilter] = useState<'all' | 'movie' | 'tv'>('all');
    const [initialContent, setInitialContent] = useState<Movie[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const [indicatorStyle, setIndicatorStyle] = useState({});

    const performSearch = useCallback(async (query: string) => {
        if (query.length < 2) {
            setAllResults([]);
            return;
        }
        setLoading(true);
        try {
            const searchRes = await fetchFromTMDB('/search/multi', { query });
            const combined = searchRes.results
                .filter((item: Movie) => item.poster_path && (item.media_type === 'movie' || item.media_type === 'tv'))
                .sort((a: Movie, b: Movie) => (b.popularity ?? 0) - (a.popularity ?? 0));

            setAllResults(combined);
            if(combined[0]) addLastSearch(combined[0]);
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setLoading(false);
        }
    }, [addLastSearch]);

    const loadContent = useCallback(async () => {
        if (pageType === 'search') {
            setIsInitialLoading(true);
            try {
                const res = await fetchFromTMDB('/trending/all/week');
                setInitialContent(res.results?.filter((item: Movie) => item.poster_path) || []);
            } catch (error) {
                 console.error(`Failed to load trending content`, error);
            } finally {
                setIsInitialLoading(false);
            }
            return;
        }

        setLoading(true);
        try {
            switch (pageType) {
                case 'favorites':
                    setContent(getScreenSpecificData('favorites', []).reverse());
                    break;
                case 'downloads':
                    setContent(getScreenSpecificData('downloads', []));
                    break;
                case 'subscriptions':
                    setContent([]); // Placeholder for subscriptions
                    break;
                case 'all':
                    if (category) {
                        let endpoint = '';
                        switch(category) {
                            case 'series':
                                endpoint = '/tv/popular';
                                break;
                            case 'trending_week':
                                endpoint = '/trending/movie/week';
                                break;
                            default:
                                endpoint = `/movie/${category}`;
                        }
                        const allRes = await fetchFromTMDB(endpoint);
                        setContent(allRes.results);
                    }
                    break;
            }
        } catch (error) {
            console.error(`Failed to load content for ${pageType}`, error);
        } finally {
            setLoading(false);
        }
    }, [pageType, category, getScreenSpecificData]);

    useEffect(() => {
        if(activeProfile) {
          loadContent();
        }
    }, [loadContent, activeProfile]);
    
    const debouncedSearch = useCallback(debounce((query: string) => performSearch(query), 500), [performSearch]);

    useEffect(() => {
        if (pageType !== 'search' || searchTerm.length < 2 || allResults.length === 0) return;
        
        const activeTabNode = tabsContainerRef.current?.querySelector<HTMLButtonElement>(`[data-tab-key="${activeFilter}"]`);
        
        if (activeTabNode) {
            setIndicatorStyle({
                left: `${activeTabNode.offsetLeft}px`,
                width: `${activeTabNode.offsetWidth}px`,
            });
        }
    }, [activeFilter, allResults, searchTerm, pageType, language]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        debouncedSearch(e.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setAllResults([]);
    };
    
    const handleFavoriteDelete = (item: Movie | FavoriteItem) => {
        toggleFavorite(item);
        setContent(prev => prev.filter(c => c.id !== item.id));
    };

    const filteredResults = useMemo(() => {
        if (activeFilter === 'all') return allResults;
        return allResults.filter(item => item.media_type === activeFilter);
    }, [allResults, activeFilter]);

    if (pageType === 'search') {

        const renderSearchContent = () => {
            if (loading) {
                return (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                );
            }
            if (searchTerm.length >= 2) {
                if (filteredResults.length === 0) {
                     return (
                        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in-up">
                            <i className="text-6xl text-gray-500 fa-solid fa-magnifying-glass"></i>
                            <h3 className="mt-6 text-xl font-bold">{t('noResultsFor', {query: searchTerm})}</h3>
                            <p className="mt-2 text-gray-400">{t('tryDifferentKeyword')}</p>
                        </div>
                    );
                }
                return (
                     <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {filteredResults.map((item, index) => <ItemCard key={item.id} item={item} index={index} />)}
                    </div>
                )
            }
            
            // Initial view when no search is active
            const recentSearches = getScreenSpecificData('lastSearches', []);
            const trendingSearches = ['أكشن', 'Comedy', 'أفلام 2024', 'خيال علمي', 'Horror', 'Netflix', 'أنيميشن', 'مغامرة'];

            const handleTrendingSearchClick = (query: string) => {
                setSearchTerm(query);
                performSearch(query);
            }

            return (
                <>
                    <div className="animate-fade-in space-y-8">
                        <div>
                            <h2 className="mb-4 text-lg font-semibold">{t('trendingSearches')}</h2>
                             <div className="flex flex-wrap items-center gap-3">
                                {trendingSearches.map((term, index) => {
                                    if (index === 0) {
                                        return (
                                            <button
                                                key={term}
                                                onClick={() => handleTrendingSearchClick(term)}
                                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-full bg-[var(--primary)] shadow-lg shadow-purple-500/20 transition-all duration-300 btn-press"
                                            >
                                                <i className="fa-solid fa-fire-flame-curved text-white"></i>
                                                <span>{term}</span>
                                            </button>
                                        )
                                    }
                                    return (
                                        <button
                                            key={term}
                                            onClick={() => handleTrendingSearchClick(term)}
                                            className="px-4 py-2 text-sm font-medium rounded-full bg-white/5 text-gray-300 transition-all duration-200 border border-white/10 hover:border-[var(--primary)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
                                        >
                                            {term}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {recentSearches.length > 0 && (
                             <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-semibold">{t('recentSearches')}</h2>
                                    <button onClick={clearLastSearches} className="text-sm font-medium text-[var(--primary)]">{t('clear')}</button>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                    {recentSearches.map((item, index) => <ItemCard key={item.id} item={item} index={index} />)}
                                </div>
                            </div>
                        )}
                        
                        <div>
                            <h2 className="mb-4 text-lg font-semibold">{t('trendingThisWeek')}</h2>
                            {isInitialLoading ? (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                    {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                                    {initialContent.map((item, index) => <ItemCard key={item.id} item={item} index={index} />)}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            );
        };
        
        const filterTabs = [
            { key: 'all', label: t('all') },
            { key: 'movie', label: t('movies') },
            { key: 'tv', label: t('series') },
        ];

        return (
             <Layout>
                <div className="p-4">
                    <h1 className="mb-4 text-3xl font-bold">{title}</h1>
                     <div className="mb-6">
                        <div className="relative">
                            <i className="absolute text-gray-400 -translate-y-1/2 fa-solid fa-search top-1/2 start-5 text-lg pointer-events-none"></i>
                            <input
                                type="text"
                                placeholder={t('searchPlaceholder')}
                                value={searchTerm}
                                onChange={handleSearchChange}
                                className="w-full ps-14 pe-12 py-4 text-white bg-[var(--surface)] border-2 border-[var(--border)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--primary)] placeholder:text-gray-500"
                            />
                            {searchTerm && (
                                <button
                                  onClick={handleClearSearch}
                                  className="absolute text-gray-400 -translate-y-1/2 top-1/2 end-5 text-lg transition-colors hover:text-white"
                                  aria-label={t('clear')}
                                >
                                  <i className="fa-solid fa-times-circle"></i>
                                </button>
                            )}
                        </div>
                    </div>

                    {searchTerm.length >= 2 && allResults.length > 0 && (
                        <div ref={tabsContainerRef} className="relative flex items-center justify-center p-1 my-6 bg-[var(--surface)] rounded-full">
                            {filterTabs.map(tab => (
                                <button
                                    key={tab.key}
                                    data-tab-key={tab.key}
                                    onClick={() => setActiveFilter(tab.key as any)}
                                    className={`flex-1 px-5 py-2.5 text-sm font-bold rounded-full transition-colors z-10 relative ${activeFilter === tab.key ? 'text-white' : 'text-gray-300 hover:text-white'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                            <div 
                                className="absolute h-[calc(100%-0.5rem)] bg-[var(--primary)] rounded-full transition-all duration-300 ease-in-out" 
                                style={indicatorStyle}
                            ></div>
                        </div>
                    )}
                    {renderSearchContent()}
                </div>
            </Layout>
        )
    }
    
    const renderContent = () => {
        if (loading) {
            return <div className="w-8 h-8 mx-auto mt-20 border-4 border-t-transparent border-[var(--primary)] rounded-full animate-spin"></div>;
        }
        if (content.length === 0) {
            const message = t('noItemsFound', { title: title });
            return <p className="mt-8 text-center text-gray-400">{message}</p>;
        }

        return (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {content.map((item, index) => {
                    if(pageType === 'downloads') {
                         return (
                            <div key={item.title} className="flex flex-col items-center animate-grid-item" style={{ animationDelay: `${index * 30}ms` }}>
                                <img src={item.poster} alt={item.title} className="w-full rounded-lg" />
                                <p className="mt-2 text-sm text-center">{item.title}</p>
                            </div>
                         );
                    }
                    return <ItemCard 
                                key={item.id} 
                                item={item} 
                                onDelete={pageType === 'favorites' ? handleFavoriteDelete : undefined} 
                                index={index}
                           />
                })}
            </div>
        )
    };
    
    return (
        <Layout>
            <div className="p-4">
                <h1 className="mb-4 text-3xl font-bold">{pageType === 'all' && category ? t('allCategory', {category: t(category as any) || category}) : title}</h1>
                {renderContent()}
            </div>
        </Layout>
    );
};

function debounce<F extends (...args: any[]) => any>(func: F, wait: number): (...args: Parameters<F>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
}


export default GenericPage;
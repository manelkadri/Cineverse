'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import Image, { type ImageLoaderProps, type ImageProps } from 'next/image';
import { isTmdbImageUrl, tmdbImageLoader, toTmdbMarker } from '@/lib/tmdb-image';

interface AppImageProps extends Omit<ImageProps, 'src' | 'alt'> {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    priority?: boolean;
    quality?: number;
    placeholder?: 'blur' | 'empty';
    blurDataURL?: string;
    fill?: boolean;
    sizes?: string;
    onClick?: () => void;
    fallbackSrc?: string;
    loading?: 'lazy' | 'eager';
    unoptimized?: boolean;
}

// TMDB's CDN is fast but individual connections occasionally stall, so a failed or stalled
// request is retried a couple of times before the branded fallback artwork is shown.
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [600, 1800];
const STALL_TIMEOUT_MS = 8000;

// 'direct' (default): the browser loads TMDB's pre-sized JPEGs straight from its CDN.
// 'optimized': route TMDB images through the Next.js image optimizer (smaller AVIF/WebP files, but a
// server-side fetch with a fixed 7 second limit). Set NEXT_PUBLIC_TMDB_IMAGE_MODE=optimized to switch.
const TMDB_DIRECT = process.env.NEXT_PUBLIC_TMDB_IMAGE_MODE !== 'optimized';

const AppImage = memo(function AppImage({
    src,
    alt,
    width,
    height,
    className = '',
    priority = false,
    quality = 85,
    placeholder = 'empty',
    blurDataURL,
    fill = false,
    sizes,
    onClick,
    fallbackSrc = '/assets/images/no_image.png',
    loading = 'lazy',
    unoptimized = false,
    ...props
}: AppImageProps) {
    const [attempt, setAttempt] = useState(0);
    const [usingFallback, setUsingFallback] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const retryTimer = useRef<number | undefined>(undefined);
    const failedAttempt = useRef(-1);

    const isTmdb = isTmdbImageUrl(src);
    const resolvedUnoptimized = unoptimized;

    useEffect(() => {
        setAttempt(0);
        setUsingFallback(false);
        setIsLoading(true);
        failedAttempt.current = -1;
        return () => window.clearTimeout(retryTimer.current);
    }, [src]);

    const fail = useCallback(() => {
        if (usingFallback || src === fallbackSrc) {
            setIsLoading(false);
            return;
        }
        if (failedAttempt.current === attempt) return; // error event and stall timer can both fire
        failedAttempt.current = attempt;
        if (isTmdb && attempt < MAX_RETRIES) {
            window.clearTimeout(retryTimer.current);
            retryTimer.current = window.setTimeout(() => setAttempt((current) => current + 1), RETRY_DELAYS_MS[attempt] ?? 2000);
            return;
        }
        setUsingFallback(true);
    }, [usingFallback, src, fallbackSrc, attempt, isTmdb]);

    const failRef = useRef(fail);
    useEffect(() => {
        failRef.current = fail;
    }, [fail]);

    // A request that never completes produces no error event for a long time, so give up after a while.
    useEffect(() => {
        if (!isTmdb || usingFallback || !isLoading) return;
        const element = imgRef.current;
        let timer: number | undefined;
        let observer: IntersectionObserver | undefined;
        const arm = () => {
            timer = window.setTimeout(() => failRef.current(), STALL_TIMEOUT_MS);
        };
        if (priority || loading === 'eager' || !element || typeof IntersectionObserver === 'undefined') {
            arm();
        } else {
            // Lazy images only start loading near the viewport, so only then does the clock start.
            observer = new IntersectionObserver((entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    observer?.disconnect();
                    arm();
                }
            }, { rootMargin: '400px' });
            observer.observe(element);
        }
        return () => {
            window.clearTimeout(timer);
            observer?.disconnect();
        };
    }, [isTmdb, usingFallback, isLoading, attempt, priority, loading]);

    const handleLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
        // next/image also reports images that failed before hydration as loaded; check the pixels.
        if (event.currentTarget.naturalWidth === 0) {
            fail();
            return;
        }
        setIsLoading(false);
    }, [fail]);

    const tmdbLoader = useCallback(
        ({ src: loaderSrc, width: loaderWidth }: ImageLoaderProps) => tmdbImageLoader(loaderSrc, loaderWidth, attempt),
        [attempt]
    );

    const imageClassName = useMemo(() => {
        const classes = [className];
        if (isLoading) classes.push('bg-card');
        if (onClick) classes.push('cursor-pointer hover:opacity-90 transition-opacity duration-200');
        return classes.filter(Boolean).join(' ');
    }, [className, isLoading, onClick]);

    const imageProps = useMemo(() => {
        const useTmdbLoader = TMDB_DIRECT && isTmdb && !usingFallback && !resolvedUnoptimized;
        // Optimizer mode has no loader to carry the cache-busting parameter, so retries add it to the source URL.
        const retrySrc = !TMDB_DIRECT && isTmdb && attempt > 0 ? `${src}?retry=${attempt}` : src;
        const baseProps: Omit<ImageProps, 'width' | 'height' | 'fill'> = {
            src: usingFallback ? fallbackSrc : useTmdbLoader ? toTmdbMarker(src) : retrySrc,
            alt,
            className: imageClassName,
            quality,
            placeholder,
            unoptimized: resolvedUnoptimized,
            onError: fail,
            onLoad: handleLoad,
            onClick,
        };

        if (useTmdbLoader) baseProps.loader = tmdbLoader;

        if (priority) {
            baseProps.priority = true;
        } else {
            baseProps.loading = loading;
        }

        if (blurDataURL && placeholder === 'blur') {
            baseProps.blurDataURL = blurDataURL;
        }

        return baseProps;
    }, [src, attempt, usingFallback, isTmdb, fallbackSrc, alt, imageClassName, quality, placeholder, blurDataURL, resolvedUnoptimized, priority, loading, fail, handleLoad, onClick, tmdbLoader]);

    if (fill) {
        return (
            <Image
                {...imageProps}
                ref={imgRef}
                alt={alt}
                fill
                sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
                style={{ objectFit: 'cover' }}
                {...props}
            />
        );
    }

    return (
        <Image
            {...imageProps}
            ref={imgRef}
            alt={alt}
            width={width || 400}
            height={height || 300}
            sizes={sizes}
            {...props}
        />
    );
});

AppImage.displayName = 'AppImage';

export default AppImage;

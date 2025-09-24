'use client';

/**
 * Advanced Property Gallery Component
 * Provides comprehensive image gallery with lightbox, lazy loading, 
 * virtual scrolling, and accessibility features
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Share,
  Heart,
  HeartOff,
  Grid3X3,
  Maximize,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  MoreHorizontal,
  Eye,
  Camera,
  MapPin,
  Calendar,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import { Listing } from '@/lib/types';
import { cn } from '@/lib/utils';
import { trackUserAction } from '@/lib/analytics';
import { toast } from '@/lib/use-toast';
import { flexLivingComponents } from '@/lib/theme';

// Types
interface PropertyGalleryProps {
  listing: Listing;
  images?: string[];
  className?: string;
  showThumbnails?: boolean;
  autoPlay?: boolean;
  showMetadata?: boolean;
  allowDownload?: boolean;
  allowShare?: boolean;
}

interface ImageData {
  src: string;
  alt: string;
  caption?: string;
  metadata?: {
    room?: string;
    description?: string;
    photographer?: string;
    date?: string;
    dimensions?: { width: number; height: number };
  };
}

interface LightboxState {
  isOpen: boolean;
  currentIndex: number;
  zoom: number;
  rotation: number;
  position: { x: number; y: number };
  isFullscreen: boolean;
}

// Custom hook for image lazy loading
const useImageLazyLoading = (images: string[]) => {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            if (src && !loadedImages.has(src) && !loadingImages.has(src)) {
              setLoadingImages(prev => new Set(prev).add(src));
              
              const imageLoader = new window.Image();
              imageLoader.onload = () => {
                setLoadedImages(prev => new Set(prev).add(src));
                setLoadingImages(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(src);
                  return newSet;
                });
              };
              imageLoader.onerror = () => {
                setLoadingImages(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(src);
                  return newSet;
                });
              };
              imageLoader.src = src;
            }
          }
        });
      },
      { rootMargin: '50px' }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [loadedImages, loadingImages]);

  const registerImage = useCallback((element: HTMLImageElement | null) => {
    if (element && observerRef.current) {
      observerRef.current.observe(element);
    }
  }, []);

  return { loadedImages, loadingImages, registerImage };
};

// Custom hook for keyboard navigation
const useKeyboardNavigation = (
  isOpen: boolean, 
  currentIndex: number, 
  totalImages: number,
  onNext: () => void,
  onPrevious: () => void,
  onClose: () => void
) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          onPrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          onNext();
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'Home':
          event.preventDefault();
          // Go to first image (implement if needed)
          break;
        case 'End':
          event.preventDefault();
          // Go to last image (implement if needed)
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, totalImages, onNext, onPrevious, onClose]);
};

export function PropertyGallery({
  listing,
  images: customImages,
  className,
  showThumbnails = true,
  autoPlay = false,
  showMetadata = true,
  allowDownload = true,
  allowShare = true,
}: PropertyGalleryProps) {
  // Use listing images or custom images
  const images = customImages || listing.images || [];
  
  // Convert images to ImageData format
  const imageData: ImageData[] = images.map((src, index) => ({
    src,
    alt: `${listing.name} - Image ${index + 1}`,
    caption: `${listing.name} property image`,
    metadata: {
      room: index === 0 ? 'Exterior' : `Room ${index}`,
      description: `Beautiful view of ${listing.name}`,
    },
  }));

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxState, setLightboxState] = useState<LightboxState>({
    isOpen: false,
    currentIndex: 0,
    zoom: 1,
    rotation: 0,
    position: { x: 0, y: 0 },
    isFullscreen: false,
  });
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [slideshowInterval, setSlideshowInterval] = useState<NodeJS.Timeout | null>(null);
  const [gridView, setGridView] = useState(false);

  // Refs
  const mainImageRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);

  // Custom hooks
  const { loadedImages, loadingImages, registerImage } = useImageLazyLoading(images);

  // Keyboard navigation
  useKeyboardNavigation(
    lightboxState.isOpen,
    lightboxState.currentIndex,
    images.length,
    () => handleNext(true),
    () => handlePrevious(true),
    () => closeLightbox()
  );

  // Handlers
  const openLightbox = useCallback((index: number) => {
    setLightboxState({
      isOpen: true,
      currentIndex: index,
      zoom: 1,
      rotation: 0,
      position: { x: 0, y: 0 },
      isFullscreen: false,
    });
    
    trackUserAction('property_gallery_lightbox_opened', 'gallery', {
      imageIndex: index,
      totalImages: images.length,
    });
  }, [images.length]);

  const closeLightbox = useCallback(() => {
    setLightboxState(prev => ({ ...prev, isOpen: false }));
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
      setSlideshowInterval(null);
      setIsSlideshow(false);
    }
  }, [slideshowInterval]);

  const handleNext = useCallback((isLightbox = false) => {
    const nextIndex = isLightbox 
      ? (lightboxState.currentIndex + 1) % images.length
      : (currentIndex + 1) % images.length;
    
    if (isLightbox) {
      setLightboxState(prev => ({ 
        ...prev, 
        currentIndex: nextIndex,
        zoom: 1,
        rotation: 0,
        position: { x: 0, y: 0 }
      }));
    } else {
      setCurrentIndex(nextIndex);
    }
    
    trackUserAction('property_gallery_next', 'gallery', { newIndex: nextIndex });
  }, [currentIndex, lightboxState.currentIndex, images.length]);

  const handlePrevious = useCallback((isLightbox = false) => {
    const prevIndex = isLightbox 
      ? (lightboxState.currentIndex - 1 + images.length) % images.length
      : (currentIndex - 1 + images.length) % images.length;
    
    if (isLightbox) {
      setLightboxState(prev => ({ 
        ...prev, 
        currentIndex: prevIndex,
        zoom: 1,
        rotation: 0,
        position: { x: 0, y: 0 }
      }));
    } else {
      setCurrentIndex(prevIndex);
    }
    
    trackUserAction('property_gallery_previous', 'gallery', { newIndex: prevIndex });
  }, [currentIndex, lightboxState.currentIndex, images.length]);

  const handleThumbnailClick = useCallback((index: number) => {
    setCurrentIndex(index);
    trackUserAction('property_gallery_thumbnail_click', 'gallery', { index });
  }, []);

  const handleZoom = useCallback((delta: number) => {
    setLightboxState(prev => ({
      ...prev,
      zoom: Math.max(0.5, Math.min(3, prev.zoom + delta)),
      position: delta < 0 ? { x: 0, y: 0 } : prev.position, // Reset position when zooming out
    }));
  }, []);

  const handleRotate = useCallback(() => {
    setLightboxState(prev => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
    }));
  }, []);

  const toggleFavorite = useCallback((index: number) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(index)) {
        newFavorites.delete(index);
        toast({ title: 'Removed from favorites', variant: 'default' });
      } else {
        newFavorites.add(index);
        toast({ title: 'Added to favorites', variant: 'default' });
      }
      return newFavorites;
    });
    
    trackUserAction('property_gallery_favorite_toggle', 'gallery', { index });
  }, []);

  const startSlideshow = useCallback(() => {
    if (isSlideshow) {
      if (slideshowInterval) clearInterval(slideshowInterval);
      setIsSlideshow(false);
      setSlideshowInterval(null);
    } else {
      const interval = setInterval(() => {
        handleNext(true);
      }, 3000);
      setSlideshowInterval(interval);
      setIsSlideshow(true);
    }
    
    trackUserAction('property_gallery_slideshow_toggle', 'gallery', { enabled: !isSlideshow });
  }, [isSlideshow, slideshowInterval, handleNext]);

  const downloadImage = useCallback(async (index: number) => {
    try {
      const response = await fetch(images[index]);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${listing.name}-image-${index + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: 'Image downloaded', variant: 'default' });
      trackUserAction('property_gallery_download', 'gallery', { index });
    } catch (error) {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  }, [images, listing.name]);

  const shareImage = useCallback(async (index: number) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: listing.name,
          text: `Check out this image from ${listing.name}`,
          url: images[index],
        });
        trackUserAction('property_gallery_share', 'gallery', { index, method: 'native' });
      } catch (error) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(images[index]);
        toast({ title: 'Image URL copied to clipboard', variant: 'default' });
        trackUserAction('property_gallery_share', 'gallery', { index, method: 'clipboard' });
      }
    } else {
      await navigator.clipboard.writeText(images[index]);
      toast({ title: 'Image URL copied to clipboard', variant: 'default' });
      trackUserAction('property_gallery_share', 'gallery', { index, method: 'clipboard' });
    }
  }, [images, listing.name]);

  // Auto-play slideshow effect
  useEffect(() => {
    if (autoPlay && !lightboxState.isOpen) {
      const interval = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % images.length);
      }, 4000);
      
      return () => clearInterval(interval);
    }
  }, [autoPlay, lightboxState.isOpen, images.length]);

  if (images.length === 0) {
    return (
      <div className={cn(
        'relative bg-muted rounded-lg overflow-hidden',
        'flex items-center justify-center min-h-64',
        className
      )}>
        <div className="text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-2" />
          <p>No images available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Gallery */}
      <div className="relative">
        {/* Main Image Display */}
        <div 
          ref={mainImageRef}
          className={cn(
            'relative bg-black rounded-lg overflow-hidden group cursor-pointer',
            'aspect-video md:aspect-[16/10]',
          )}
          style={flexLivingComponents.propertyGallery}
          onClick={() => openLightbox(currentIndex)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative w-full h-full"
            >
              <Image
                src={images[currentIndex]}
                alt={imageData[currentIndex].alt}
                fill
                className="object-cover"
                priority={currentIndex === 0}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
              />
              
              {/* Image Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute bottom-4 left-4 right-4">
                  {showMetadata && (
                    <div className="text-white">
                      <h3 className="font-semibold text-lg">{imageData[currentIndex].caption}</h3>
                      {imageData[currentIndex].metadata?.room && (
                        <p className="text-sm opacity-90">{imageData[currentIndex].metadata.room}</p>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="absolute top-4 right-4 flex space-x-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="bg-black/50 hover:bg-black/70 text-white border-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(currentIndex);
                          }}
                        >
                          {favorites.has(currentIndex) ? (
                            <Heart className="h-4 w-4 fill-current" />
                          ) : (
                            <HeartOff className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {favorites.has(currentIndex) ? 'Remove from favorites' : 'Add to favorites'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  <Button
                    variant="secondary"
                    size="icon"
                    className="bg-black/50 hover:bg-black/70 text-white border-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGridView(!gridView);
                    }}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="secondary"
                    size="icon"
                    className="bg-black/50 hover:bg-black/70 text-white border-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLightbox(currentIndex);
                    }}
                  >
                    <Maximize className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Loading Spinner */}
              {loadingImages.has(images[currentIndex]) && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          {/* Image Counter */}
          <div className="absolute bottom-4 right-4">
            <Badge variant="secondary" className="bg-black/50 text-white border-0">
              {currentIndex + 1} / {images.length}
            </Badge>
          </div>
        </div>

        {/* Gallery Controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              <Camera className="h-3 w-3 mr-1" />
              {images.length} Photos
            </Badge>
            {listing.address && (
              <Badge variant="outline">
                <MapPin className="h-3 w-3 mr-1" />
                {listing.city}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {allowShare && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => shareImage(currentIndex)}
                    >
                      <Share className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share image</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {allowDownload && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadImage(currentIndex)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download image</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnails */}
      {showThumbnails && !gridView && images.length > 1 && (
        <div ref={thumbnailsRef} className="relative">
          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-thin">
            {images.map((image, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all',
                  index === currentIndex 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-transparent hover:border-muted-foreground/50'
                )}
                onClick={() => handleThumbnailClick(index)}
              >
                <Image
                  ref={registerImage}
                  data-src={image}
                  src={loadedImages.has(image) ? image : '/placeholder-image.jpg'}
                  alt={`Thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
                
                {favorites.has(index) && (
                  <div className="absolute top-1 right-1">
                    <Heart className="h-3 w-3 text-red-500 fill-current" />
                  </div>
                )}
                
                {loadingImages.has(image) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                    <Loader2 className="h-3 w-3 animate-spin" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Grid View */}
      {gridView && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          {images.map((image, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
              onClick={() => openLightbox(index)}
            >
              <Image
                src={image}
                alt={`Gallery image ${index + 1}`}
                fill
                className="object-cover transition-transform group-hover:scale-110"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />
              
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Eye className="h-6 w-6 text-white" />
              </div>
              
              {favorites.has(index) && (
                <div className="absolute top-2 right-2">
                  <Heart className="h-4 w-4 text-red-500 fill-current" />
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Lightbox */}
      <Dialog open={lightboxState.isOpen} onOpenChange={closeLightbox}>
        <DialogContent className="max-w-screen-xl max-h-screen p-0 bg-black border-0">
          <div className="relative w-full h-[90vh] flex items-center justify-center">
            {/* Lightbox Image */}
            <div 
              className="relative max-w-full max-h-full overflow-hidden cursor-move"
              style={{
                transform: `scale(${lightboxState.zoom}) rotate(${lightboxState.rotation}deg) translate(${lightboxState.position.x}px, ${lightboxState.position.y}px)`,
                transformOrigin: 'center center',
              }}
            >
              <Image
                src={images[lightboxState.currentIndex]}
                alt={imageData[lightboxState.currentIndex].alt}
                width={1200}
                height={800}
                className="max-w-full max-h-full object-contain"
                priority
              />
            </div>

            {/* Lightbox Controls */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              <div className="flex items-center space-x-2">
                <Badge className="bg-black/50 text-white border-0">
                  {lightboxState.currentIndex + 1} / {images.length}
                </Badge>
                {showMetadata && imageData[lightboxState.currentIndex].metadata?.room && (
                  <Badge variant="outline" className="bg-black/50 text-white border-white/20">
                    {imageData[lightboxState.currentIndex].metadata.room}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={startSlideshow}
                  className="bg-black/50 hover:bg-black/70 text-white border-0"
                >
                  {isSlideshow ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleZoom(-0.25)}
                  disabled={lightboxState.zoom <= 0.5}
                  className="bg-black/50 hover:bg-black/70 text-white border-0"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleZoom(0.25)}
                  disabled={lightboxState.zoom >= 3}
                  className="bg-black/50 hover:bg-black/70 text-white border-0"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRotate}
                  className="bg-black/50 hover:bg-black/70 text-white border-0"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-black/50 hover:bg-black/70 text-white border-0"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {allowDownload && (
                      <DropdownMenuItem onClick={() => downloadImage(lightboxState.currentIndex)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                    )}
                    {allowShare && (
                      <DropdownMenuItem onClick={() => shareImage(lightboxState.currentIndex)}>
                        <Share className="h-4 w-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => toggleFavorite(lightboxState.currentIndex)}>
                      {favorites.has(lightboxState.currentIndex) ? (
                        <>
                          <HeartOff className="h-4 w-4 mr-2" />
                          Remove from favorites
                        </>
                      ) : (
                        <>
                          <Heart className="h-4 w-4 mr-2" />
                          Add to favorites
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={closeLightbox}
                  className="bg-black/50 hover:bg-black/70 text-white border-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0 z-10"
                  onClick={() => handlePrevious(true)}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white border-0 z-10"
                  onClick={() => handleNext(true)}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            {/* Image Metadata */}
            {showMetadata && imageData[lightboxState.currentIndex].metadata && (
              <div className="absolute bottom-4 left-4 right-4 z-10">
                <div className="bg-black/50 rounded-lg p-4 text-white max-w-md">
                  <h3 className="font-semibold">{imageData[lightboxState.currentIndex].caption}</h3>
                  {imageData[lightboxState.currentIndex].metadata.description && (
                    <p className="text-sm opacity-90 mt-1">
                      {imageData[lightboxState.currentIndex].metadata.description}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

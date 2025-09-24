'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { notFound, useRouter } from 'next/navigation';
import Image from 'next/image';
import Head from 'next/head';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ReviewCard } from '@/components/ReviewCard';
import { PropertyGallery } from '@/components/PropertyGallery';
import { LoadingSystem } from '@/components/LoadingSystem';
import { 
  useApprovedReviews, 
  useListing, 
  useLocalStorage, 
  usePerformanceMonitoring 
} from '@/lib/hooks';
import { trackUserAction, trackPerformanceMetric } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { flexLivingComponents } from '@/lib/theme';
import { toast } from '@/lib/use-toast';
import { 
  Star, 
  MapPin, 
  Bed, 
  Bath, 
  Users, 
  Wifi, 
  Car,
  Coffee,
  ArrowLeft,
  TrendingUp,
  Share2,
  Heart,
  MessageSquare,
  Filter,
  ChevronLeft,
  ChevronRight,
  Camera,
  Calendar,
  Globe,
  Shield,
  Award,
  Zap,
  Home,
  Building,
  Trees,
  Sparkles,
  ExternalLink,
  Copy,
  Facebook,
  Twitter,
  Mail,
  SearchX
} from 'lucide-react';

// Enhanced interfaces
interface PropertyPageProps {
  params: {
    slug: string;
  };
}

interface ReviewFilters {
  rating?: number | null;
  category?: string;
  sortBy?: 'newest' | 'oldest' | 'rating_high' | 'rating_low';
  searchQuery?: string;
}

interface SharingOptions {
  url: string;
  title: string;
  description: string;
}

interface RelatedProperty {
  id: string;
  name: string;
  image: string;
  rating: number;
  reviews: number;
  slug: string;
}

// Enhanced animations with FlexLiving styling
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const slideInLeft = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.5 }
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.4 }
};

// Enhanced amenity mapping with icons and categories
const amenityIcons: Record<string, { icon: React.ComponentType<any>, category: string, color: string }> = {
  wifi: { icon: Wifi, category: 'Connectivity', color: 'text-blue-500' },
  parking: { icon: Car, category: 'Transport', color: 'text-green-500' },
  kitchen: { icon: Coffee, category: 'Kitchen', color: 'text-orange-500' },
  'full kitchen': { icon: Coffee, category: 'Kitchen', color: 'text-orange-500' },
  'air conditioning': { icon: Sparkles, category: 'Comfort', color: 'text-cyan-500' },
  heating: { icon: Zap, category: 'Comfort', color: 'text-red-500' },
  'washing machine': { icon: Home, category: 'Laundry', color: 'text-purple-500' },
  tv: { icon: Globe, category: 'Entertainment', color: 'text-indigo-500' },
  'hot tub': { icon: Trees, category: 'Outdoor', color: 'text-teal-500' },
  pool: { icon: Trees, category: 'Outdoor', color: 'text-blue-500' },
  gym: { icon: Building, category: 'Fitness', color: 'text-gray-500' },
  'security system': { icon: Shield, category: 'Safety', color: 'text-red-500' },
};

// Review category breakdown
const reviewCategories = [
  { key: 'cleanliness_rating', label: 'Cleanliness', icon: Sparkles },
  { key: 'communication_rating', label: 'Communication', icon: MessageSquare },
  { key: 'checkin_rating', label: 'Check-in', icon: Home },
  { key: 'accuracy_rating', label: 'Accuracy', icon: Award },
  { key: 'location_rating', label: 'Location', icon: MapPin },
  { key: 'value_rating', label: 'Value', icon: TrendingUp }
];

// Social sharing platforms
const sharingPlatforms = [
  {
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600 hover:bg-blue-700',
    getUrl: (options: SharingOptions) => 
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(options.url)}`
  },
  {
    name: 'Twitter',
    icon: Twitter,
    color: 'bg-sky-500 hover:bg-sky-600',
    getUrl: (options: SharingOptions) => 
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(options.url)}&text=${encodeURIComponent(options.title)}`
  },
  {
    name: 'Email',
    icon: Mail,
    color: 'bg-gray-600 hover:bg-gray-700',
    getUrl: (options: SharingOptions) => 
      `mailto:?subject=${encodeURIComponent(options.title)}&body=${encodeURIComponent(`${options.description}\n\n${options.url}`)}`
  },
  {
    name: 'Copy Link',
    icon: Copy,
    color: 'bg-green-600 hover:bg-green-700',
    action: 'copy'
  }
];

export default function PropertyPage({ params }: PropertyPageProps) {
  const router = useRouter();
  
  // Core state
  const [reviewFilters, setReviewFilters] = useState<ReviewFilters>({});
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [currentTab, setCurrentTab] = useState('overview');
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [isLiked, setIsLiked] = useLocalStorage(`property-liked-${params.slug}`, false);
  
  // Performance monitoring
  const performanceMetrics = usePerformanceMonitoring();

  // Enhanced data hooks
  const { 
    data: listing, 
    isLoading: listingLoading, 
    error: listingError 
  } = useListing(params.slug);
  
  const { 
    data: reviews, 
    isLoading: reviewsLoading
  } = useApprovedReviews({
    listingId: listing?.id,
    ...reviewFilters
  });

  // Derived state and calculations
  const averageRating = useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    return reviews.reduce((sum, review) => sum + review.overall_rating, 0) / reviews.length;
  }, [reviews]);

  const categoryRatings = useMemo(() => {
    if (!reviews || reviews.length === 0) return {};
    
    const ratings: Record<string, number> = {};
    reviewCategories.forEach(category => {
      const categoryReviews = reviews.filter(review => review[category.key as keyof typeof review] && review[category.key as keyof typeof review] as number > 0);
      if (categoryReviews.length > 0) {
        ratings[category.key] = categoryReviews.reduce((sum, review) => 
          sum + (review[category.key as keyof typeof review] as number), 0) / categoryReviews.length;
      }
    });
    return ratings;
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (!reviews) return [];
    
    // Helper function for safe date conversion with fallback
    const toMs = (d?: string) => d ? new Date(d).getTime() : 0;
    
    return reviews.filter(review => {
      if (reviewFilters.rating && review.overall_rating !== reviewFilters.rating) return false;
      if (reviewFilters.searchQuery) {
        const query = reviewFilters.searchQuery.toLowerCase();
        return (review.review_text || '').toLowerCase().includes(query) ||
               (review.guest_name || '').toLowerCase().includes(query);
      }
      return true;
    }).sort((a, b) => {
      switch (reviewFilters.sortBy) {
        case 'rating_high':
          return b.overall_rating - a.overall_rating;
        case 'rating_low':
          return a.overall_rating - b.overall_rating;
        case 'oldest':
          return toMs(a.submission_date) - toMs(b.submission_date);
        default: // 'newest'
          return toMs(b.submission_date) - toMs(a.submission_date);
      }
    });
  }, [reviews, reviewFilters]);

  const relatedProperties: RelatedProperty[] = useMemo(() => {
    // Mock related properties - in real app would come from API
    return [
      {
        id: '1',
        name: 'Modern Downtown Loft',
        image: '/api/placeholder/300/200',
        rating: 4.8,
        reviews: 124,
        slug: 'modern-downtown-loft'
      },
      {
        id: '2', 
        name: 'Cozy Garden Apartment',
        image: '/api/placeholder/300/200',
        rating: 4.6,
        reviews: 89,
        slug: 'cozy-garden-apartment'
      },
      {
        id: '3',
        name: 'Luxury Penthouse Suite',
        image: '/api/placeholder/300/200', 
        rating: 4.9,
        reviews: 203,
        slug: 'luxury-penthouse-suite'
      }
    ];
  }, []);

  const sharingOptions: SharingOptions = useMemo(() => ({
    url: typeof window !== 'undefined' ? window.location.href : '',
    title: `${listing?.name} | FlexLiving`,
    description: listing?.description || 'Beautiful property hosted on FlexLiving'
  }), [listing]);

  // Event handlers
  const handleShare = (platform: typeof sharingPlatforms[0]) => {
    if (platform.action === 'copy') {
      navigator.clipboard.writeText(sharingOptions.url);
      toast({
        title: 'Link copied!',
        description: 'Property link has been copied to clipboard.',
      });
    } else if (platform.getUrl) {
      window.open(platform.getUrl(sharingOptions), '_blank', 'noopener,noreferrer');
    }
    
    trackUserAction('property_shared', 'property_page', {
      platform: platform.name,
      property: listing?.slug
    });
    
    setShowShareDialog(false);
  };

  const handleLikeToggle = () => {
    setIsLiked(!isLiked);
    trackUserAction(isLiked ? 'property_unliked' : 'property_liked', 'property_page', {
      property: listing?.slug
    });
    
    toast({
      title: isLiked ? 'Removed from favorites' : 'Added to favorites',
      description: isLiked 
        ? 'Property removed from your favorites.' 
        : 'Property added to your favorites.',
    });
  };

  const handleReviewFilterChange = (newFilters: ReviewFilters) => {
    setReviewFilters(newFilters);
    trackUserAction('review_filters_applied', 'property_page', {
      filters: Object.keys(newFilters),
      property: listing?.slug
    });
  };


  // Performance tracking
  useEffect(() => {
    if (listing) {
      trackUserAction('property_viewed', 'property_page', {
        property: listing.slug,
        rating: averageRating,
        reviewCount: reviews?.length || 0
      });
      
      // Track page load performance
      if (!listingLoading) {
        trackPerformanceMetric({
          name: 'property_page_load',
          value: performance.now(),
          unit: 'ms',
          data: { property: listing.slug }
        });
      }
    }
  }, [listing, listingLoading, averageRating, reviews?.length]);

  // Error handling
  if (listingError || (!listingLoading && !listing)) {
    notFound();
  }

  // Loading state
  if (listingLoading) {
    return (
      <div className="space-y-8">
        <LoadingSystem type="property" />
      </div>
    );
  }

  return (
    <>
      {/* SEO Meta Tags */}
      <Head>
        <title>{listing?.name} | FlexLiving Properties</title>
        <meta name="description" content={listing?.description} />
        <meta property="og:title" content={`${listing?.name} | FlexLiving`} />
        <meta property="og:description" content={listing?.description} />
        {listing?.images?.[0] && (
          <meta property="og:image" content={listing.images[0]} />
        )}
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <div className="space-y-8">
        {/* Hero Section with Enhanced Gallery */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          className="relative"
        >
          {listing?.images && listing.images.length > 0 ? (
            <div className="relative">
              <PropertyGallery
                listing={listing}
                images={listing.images}
              />
              
              {/* Floating Action Buttons */}
              <div className="absolute top-4 right-4 flex space-x-2">
                <Button
                  size="sm"
                  variant={isLiked ? "default" : "secondary"}
                  onClick={handleLikeToggle}
                  className={cn(
                    "backdrop-blur-sm",
                    isLiked && "bg-red-500 hover:bg-red-600 text-white"
                  )}
                >
                  <Heart className={cn("h-4 w-4 mr-1", isLiked && "fill-current")} />
                  {isLiked ? 'Saved' : 'Save'}
                </Button>
                
                <Button
                  size="sm"
                  variant="secondary" 
                  onClick={() => setShowShareDialog(true)}
                  className="backdrop-blur-sm"
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </div>

              {/* Property Title Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent">
                <div className="p-6">
                  <motion.div variants={slideInLeft} initial="initial" animate="animate">
                    <h1 className="text-3xl md:text-5xl font-bold text-white mb-2 gradient-text">
                    {listing.name}
                  </h1>
                    <div className="flex items-center text-white/90 mb-3">
                      <MapPin className="h-5 w-5 mr-2" />
                      <span className="text-lg">{listing.address}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        <span className="text-xl font-bold text-white">
                          {averageRating.toFixed(1)}
                        </span>
                        <span className="text-white/80">
                          ({reviews?.length || 0} reviews)
                        </span>
                      </div>
                      <Badge variant="secondary" className="bg-white/20 text-white">
                        <Award className="h-3 w-3 mr-1" />
                        Superhost
                      </Badge>
                  </div>
                  </motion.div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
              <Camera className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </motion.div>

        {/* Main Content Tabs */}
        <motion.div variants={scaleIn} initial="initial" animate="animate">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
            <div className="sticky top-16 z-10 bg-background/80 backdrop-blur-sm border-b pb-4 mb-6">
              <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="reviews">
                  Reviews
                  {reviews && reviews.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {reviews.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="location">Location</TabsTrigger>
              </TabsList>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Property Details */}
                <div className="lg:col-span-2 space-y-6">
                  <motion.div variants={scaleIn}>
                    <Card className="p-6" style={flexLivingComponents.managerCard}>
                      <div className="space-y-6">
                      <div>
                          <h2 className="text-2xl font-bold mb-2">{listing?.name}</h2>
                          <p className="text-muted-foreground leading-relaxed">
                            {listing?.description}
                          </p>
                    </div>

                    {/* Property Features */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {listing?.bedrooms && (
                            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                              <Bed className="h-6 w-6 text-primary mb-2" />
                              <span className="font-semibold">{listing.bedrooms}</span>
                              <span className="text-xs text-muted-foreground">Bedrooms</span>
                        </div>
                      )}
                      {listing?.bathrooms && (
                            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                              <Bath className="h-6 w-6 text-primary mb-2" />
                              <span className="font-semibold">{listing.bathrooms}</span>
                              <span className="text-xs text-muted-foreground">Bathrooms</span>
                        </div>
                      )}
                      {listing?.max_guests && (
                            <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                              <Users className="h-6 w-6 text-primary mb-2" />
                              <span className="font-semibold">{listing.max_guests}</span>
                              <span className="text-xs text-muted-foreground">Guests</span>
                            </div>
                          )}
                          <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                            <Star className="h-6 w-6 text-yellow-500 mb-2" />
                            <span className="font-semibold">{averageRating.toFixed(1)}</span>
                            <span className="text-xs text-muted-foreground">Rating</span>
                          </div>
                    </div>

                        {/* Enhanced Amenities */}
                    {listing?.amenities && listing.amenities.length > 0 && (
                      <div>
                            <h3 className="font-semibold mb-4 flex items-center">
                              <Sparkles className="h-5 w-5 mr-2 text-primary" />
                              Amenities & Features
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {listing.amenities.map((amenity) => {
                                const amenityData = amenityIcons[amenity.toLowerCase()];
                                const IconComponent = amenityData?.icon || Home;
                            return (
                                  <div key={amenity} className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                                    <IconComponent className={cn("h-5 w-5", amenityData?.color || "text-muted-foreground")} />
                                    <div>
                                      <span className="font-medium">{amenity}</span>
                                      {amenityData && (
                                        <p className="text-xs text-muted-foreground">
                                          {amenityData.category}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                      </div>
                    </Card>
                  </motion.div>
                  </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Rating Breakdown */}
                  <motion.div variants={slideInLeft}>
                    <Card style={flexLivingComponents.managerCard}>
                      <CardHeader>
                        <CardTitle className="flex items-center text-lg">
                          <Star className="h-5 w-5 mr-2 text-yellow-500" />
                          Guest Reviews
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-center p-4 bg-primary/5 rounded-lg">
                          <div className="text-3xl font-bold text-primary mb-1">
                            {averageRating.toFixed(1)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Based on {reviews?.length || 0} reviews
                          </div>
                        </div>

                        {/* Category Breakdown */}
                        <div className="space-y-3">
                          {reviewCategories.map(category => (
                            <div key={category.key} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <div className="flex items-center">
                                  <category.icon className="h-4 w-4 mr-2" />
                                  <span>{category.label}</span>
                                </div>
                                <span className="font-medium">
                                  {categoryRatings[category.key]?.toFixed(1) || 'N/A'}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full transition-all duration-500"
                                  style={{ 
                                    width: `${((categoryRatings[category.key] || 0) / 5) * 100}%` 
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Quick Actions */}
                  <motion.div variants={slideInLeft}>
                    <Card style={flexLivingComponents.managerCard}>
                      <CardHeader>
                        <CardTitle className="text-lg">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Button 
                          onClick={() => setCurrentTab('reviews')} 
                          className="w-full justify-start"
                          variant="outline"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          View All Reviews
                        </Button>
                        <Button 
                          onClick={() => setShowShareDialog(true)}
                          className="w-full justify-start"
                          variant="outline"
                        >
                          <Share2 className="h-4 w-4 mr-2" />
                          Share Property
                        </Button>
                        <Button 
                          onClick={handleLikeToggle}
                          className="w-full justify-start"
                          variant={isLiked ? "default" : "outline"}
                        >
                          <Heart className={cn("h-4 w-4 mr-2", isLiked && "fill-current")} />
                          {isLiked ? 'Remove from Favorites' : 'Save to Favorites'}
                        </Button>
              </CardContent>
            </Card>
          </motion.div>
                </div>
              </div>
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews" className="space-y-6">
              {/* Review Filters */}
              <motion.div variants={fadeInUp}>
                <Card className="p-4" style={flexLivingComponents.managerCard}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Filter className="h-4 w-4" />
                        <span className="text-sm font-medium">Filter Reviews:</span>
                      </div>
                      <Select 
                        value={reviewFilters.rating?.toString() || 'all'}
                        onValueChange={(value) => 
                          handleReviewFilterChange({ 
                            ...reviewFilters, 
                            rating: value === 'all' ? null : parseInt(value)
                          })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Rating" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Ratings</SelectItem>
                          <SelectItem value="5">5 Stars</SelectItem>
                          <SelectItem value="4">4 Stars</SelectItem>
                          <SelectItem value="3">3 Stars</SelectItem>
                          <SelectItem value="2">2 Stars</SelectItem>
                          <SelectItem value="1">1 Star</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Select 
                        value={reviewFilters.sortBy || 'newest'}
                        onValueChange={(value) => 
                          handleReviewFilterChange({ 
                            ...reviewFilters, 
                            sortBy: value as ReviewFilters['sortBy']
                          })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest First</SelectItem>
                          <SelectItem value="oldest">Oldest First</SelectItem>
                          <SelectItem value="rating_high">Highest Rating</SelectItem>
                          <SelectItem value="rating_low">Lowest Rating</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex-1 max-w-sm">
                      <Input
                        placeholder="Search reviews..."
                        value={reviewFilters.searchQuery || ''}
                        onChange={(e) => 
                          handleReviewFilterChange({ 
                            ...reviewFilters, 
                            searchQuery: e.target.value 
                          })
                        }
                        className="w-full"
                      />
            </div>
          </div>
                </Card>
              </motion.div>

              {/* Reviews Grid */}
          {reviewsLoading ? (
                <LoadingSystem type="reviews" />
              ) : filteredReviews && filteredReviews.length > 0 ? (
            <motion.div
              variants={staggerChildren}
              initial="initial"
              animate="animate"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                  {filteredReviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  variants={fadeInUp}
                      transition={{ delay: index * 0.05 }}
                    >
                      <ReviewCard 
                        review={review} 
                        showActions={false}
                        showCategoryBreakdown
                        showGuestVerification
                        showSocialProof
                      />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                    <SearchX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No reviews found</h3>
                <p className="text-muted-foreground">
                      Try adjusting your filters to see more reviews.
                </p>
              </CardContent>
            </Card>
          )}

            </TabsContent>

            {/* Location Tab */}
            <TabsContent value="location" className="space-y-6">
              <motion.div variants={fadeInUp}>
                <Card style={flexLivingComponents.managerCard}>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <MapPin className="h-12 w-12 mx-auto text-primary mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Property Location</h3>
                      <p className="text-muted-foreground mb-4">{listing?.address}</p>
                      <Button variant="outline" asChild>
                        <Link 
                          href={`https://maps.google.com/maps?q=${encodeURIComponent(listing?.address || '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View on Google Maps
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Related Properties */}
        {relatedProperties.length > 0 && (
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">More Properties Like This</h2>
              <Button variant="outline" asChild>
                <Link href="/properties">
                  View All Properties
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedProperties.map((property, index) => (
                <motion.div
                  key={property.id}
                  variants={fadeInUp}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card 
                    className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105"
                    style={flexLivingComponents.managerCard}
                    onClick={() => router.push(`/property/${property.slug}`)}
                  >
                    <div className="relative h-48">
                      <Image
                        src={property.image}
                        alt={property.name}
                        fill
                        className="object-cover rounded-t-lg"
                      />
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-white/90">
                          <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                          {property.rating}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-1">{property.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {property.reviews} reviews
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Share Dialog */}
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share this Property</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              {sharingPlatforms.map(platform => (
                <Button
                  key={platform.name}
                  variant="outline"
                  onClick={() => handleShare(platform)}
                  className={cn("h-12 justify-start", platform.color, "text-white")}
                >
                  <platform.icon className="h-4 w-4 mr-2" />
                  {platform.name}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Performance Metrics (Development) */}
        {process.env.NODE_ENV === 'development' && performanceMetrics && (
          <div className="fixed bottom-4 left-4 text-xs text-muted-foreground bg-background/80 backdrop-blur p-2 rounded">
            Renders: {performanceMetrics.renderCount} | Avg: {Math.round(performanceMetrics.averageRenderTime)}ms
          </div>
        )}
      </div>
    </>
  );
}

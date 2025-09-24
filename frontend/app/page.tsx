'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  MessageSquare, 
  BarChart3, 
  Star, 
  Building, 
  ArrowRight, 
  Sparkles 
} from 'lucide-react';
import Link from 'next/link';

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

const cardVariants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.5 }
  },
  hover: { 
    scale: 1.02,
    transition: { duration: 0.2 }
  }
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/30">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-purple-500/5 blur-3xl animate-pulse-slow" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-blue-500/3 blur-3xl animate-pulse-slow" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex items-center space-x-2"
            >
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold gradient-text">FlexApp</h1>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <ThemeToggle />
            </motion.div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 text-center">
          <motion.div
            variants={staggerChildren}
            initial="initial"
            animate="animate"
            className="max-w-4xl mx-auto"
          >
            <motion.h1
              variants={fadeInUp}
              className="text-4xl md:text-6xl font-bold mb-6 gradient-text"
            >
              Reviews Dashboard
            </motion.h1>
            
            <motion.p
              variants={fadeInUp}
              className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Modern, intuitive review management for property managers. 
              Seamlessly integrate with Hostaway and manage all your reviews from one place.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Button asChild size="lg" className="button-scale">
                <Link href="/manager" className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Manager Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              
              <Button asChild variant="outline" size="lg" className="button-scale">
                <Link href="/property/demo-property" className="flex items-center space-x-2">
                  <Building className="h-5 w-5" />
                  <span>View Property Demo</span>
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16">
          <motion.div
            variants={staggerChildren}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
          >
            <motion.div variants={cardVariants} whileHover="hover">
              <Card className="card-hover glass h-full">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Review Management</CardTitle>
                  <CardDescription>
                    Comprehensive review approval workflow with real-time updates and bulk actions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Bulk approval actions</li>
                    <li>• Advanced filtering</li>
                    <li>• Real-time notifications</li>
                    <li>• Approval history tracking</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants} whileHover="hover">
              <Card className="card-hover glass h-full">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                    <Star className="h-6 w-6 text-green-500" />
                  </div>
                  <CardTitle>Rating Analytics</CardTitle>
                  <CardDescription>
                    Detailed analytics and insights into your property ratings and guest feedback
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Category-wise ratings</li>
                    <li>• Trend analysis</li>
                    <li>• Performance metrics</li>
                    <li>• Guest satisfaction scores</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={cardVariants} whileHover="hover">
              <Card className="card-hover glass h-full">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                    <Building className="h-6 w-6 text-purple-500" />
                  </div>
                  <CardTitle>Hostaway Integration</CardTitle>
                  <CardDescription>
                    Seamless integration with Hostaway API for automatic review synchronization
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Automatic sync</li>
                    <li>• Property metadata</li>
                    <li>• Channel management</li>
                    <li>• Multi-listing support</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-4 py-8 mt-16">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center text-muted-foreground"
          >
            <p>&copy; 2024 FlexLiving. Built with Next.js, shadcn/ui, and modern web technologies.</p>
          </motion.div>
        </footer>
      </div>
    </div>
  );
}

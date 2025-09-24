'use client'

import { motion } from 'framer-motion'

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-4">
        <motion.div
          className="relative"
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <div className="h-12 w-12 rounded-full border-4 border-primary/20">
            <div className="h-full w-full rounded-full border-4 border-l-primary border-r-transparent border-t-transparent border-b-transparent" />
          </div>
        </motion.div>
        
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.2,
            duration: 0.8,
          }}
        >
          <h2 className="text-lg font-medium text-foreground">Loading...</h2>
          <p className="text-sm text-muted-foreground">Please wait while we load your content</p>
        </motion.div>
      </div>
    </div>
  )
}

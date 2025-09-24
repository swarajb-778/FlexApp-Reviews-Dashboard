/**
 * FlexLiving Brand Theme Configuration
 * Ensures consistent styling across all components with FlexLiving's brand identity
 */

export const flexLivingTheme = {
  // FlexLiving Brand Colors
  colors: {
    // Primary brand colors
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6', // Main brand blue
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },
    
    // Secondary accent colors
    accent: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e', // FlexLiving green
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
    
    // Status colors for approval workflow
    status: {
      pending: {
        bg: '#fef3c7',
        border: '#f59e0b',
        text: '#92400e',
        icon: '#f59e0b',
      },
      approved: {
        bg: '#d1fae5',
        border: '#10b981',
        text: '#065f46',
        icon: '#10b981',
      },
      rejected: {
        bg: '#fee2e2',
        border: '#ef4444',
        text: '#991b1b',
        icon: '#ef4444',
      },
    },
    
    // Rating colors
    rating: {
      star: '#fbbf24',
      starFilled: '#f59e0b',
      excellent: '#10b981', // 4.5-5 stars
      good: '#3b82f6', // 3.5-4.4 stars
      average: '#f59e0b', // 2.5-3.4 stars
      poor: '#ef4444', // 1-2.4 stars
    },
    
    // Channel specific colors
    channels: {
      airbnb: '#FF5A5F',
      booking: '#003580',
      vrbo: '#1E3A8A',
      expedia: '#FFD500',
      direct: '#10B981',
      default: '#6b7280',
    },
  },
  
  // Typography scales
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
    
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    },
    
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  
  // Spacing system
  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem',  // 8px
    md: '1rem',    // 16px
    lg: '1.5rem',  // 24px
    xl: '2rem',    // 32px
    '2xl': '2.5rem', // 40px
    '3xl': '3rem',   // 48px
  },
  
  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    default: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  
  // Shadows
  boxShadow: {
    xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    default: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    md: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    lg: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    xl: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    
    // Custom FlexLiving shadows
    card: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -1px rgb(0 0 0 / 0.06)',
    cardHover: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05)',
    modal: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  },
  
  // Animation presets
  animation: {
    duration: {
      fast: '150ms',
      normal: '300ms',
      slow: '500ms',
    },
    
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
    
    keyframes: {
      fadeIn: {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
      fadeInUp: {
        '0%': { opacity: '0', transform: 'translateY(20px)' },
        '100%': { opacity: '1', transform: 'translateY(0)' },
      },
      scaleIn: {
        '0%': { opacity: '0', transform: 'scale(0.95)' },
        '100%': { opacity: '1', transform: 'scale(1)' },
      },
      slideInRight: {
        '0%': { opacity: '0', transform: 'translateX(20px)' },
        '100%': { opacity: '1', transform: 'translateX(0)' },
      },
    },
  },
  
  // Component variants
  components: {
    // Button variants
    button: {
      primary: {
        bg: 'var(--primary-500)',
        text: 'white',
        hover: 'var(--primary-600)',
        active: 'var(--primary-700)',
      },
      secondary: {
        bg: 'var(--accent-500)',
        text: 'white',
        hover: 'var(--accent-600)',
        active: 'var(--accent-700)',
      },
      outline: {
        bg: 'transparent',
        text: 'var(--primary-500)',
        border: 'var(--primary-500)',
        hover: 'var(--primary-50)',
      },
      ghost: {
        bg: 'transparent',
        text: 'var(--foreground)',
        hover: 'var(--muted)',
      },
    },
    
    // Card variants
    card: {
      default: {
        bg: 'var(--card)',
        border: 'var(--border)',
        shadow: 'var(--shadow-card)',
        hover: 'var(--shadow-card-hover)',
      },
      elevated: {
        bg: 'var(--card)',
        border: 'var(--border)',
        shadow: 'var(--shadow-lg)',
      },
    },
    
    // Badge variants for approval status
    badge: {
      pending: {
        bg: 'var(--status-pending-bg)',
        text: 'var(--status-pending-text)',
        border: 'var(--status-pending-border)',
      },
      approved: {
        bg: 'var(--status-approved-bg)',
        text: 'var(--status-approved-text)',
        border: 'var(--status-approved-border)',
      },
      rejected: {
        bg: 'var(--status-rejected-bg)',
        text: 'var(--status-rejected-text)',
        border: 'var(--status-rejected-border)',
      },
    },
  },
  
  // Responsive breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  // Z-index scale
  zIndex: {
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },
}

// CSS Custom Properties generator
export const generateCSSVariables = (theme = flexLivingTheme) => {
  const cssVars: Record<string, string> = {}
  
  // Colors
  Object.entries(theme.colors.primary).forEach(([key, value]) => {
    cssVars[`--primary-${key}`] = value
  })
  
  Object.entries(theme.colors.accent).forEach(([key, value]) => {
    cssVars[`--accent-${key}`] = value
  })
  
  Object.entries(theme.colors.status).forEach(([status, colors]) => {
    Object.entries(colors).forEach(([prop, value]) => {
      cssVars[`--status-${status}-${prop}`] = value
    })
  })
  
  // Rating colors
  Object.entries(theme.colors.rating).forEach(([key, value]) => {
    cssVars[`--rating-${key}`] = value
  })
  
  // Channel colors
  Object.entries(theme.colors.channels).forEach(([key, value]) => {
    cssVars[`--channel-${key}`] = value
  })
  
  // Shadows
  Object.entries(theme.boxShadow).forEach(([key, value]) => {
    cssVars[`--shadow-${key}`] = value
  })
  
  return cssVars
}

// Theme switching utilities
export type ThemeMode = 'light' | 'dark' | 'system'

export const getThemeFromSystem = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const applyTheme = (mode: ThemeMode) => {
  if (typeof document === 'undefined') return
  
  const root = document.documentElement
  const actualTheme = mode === 'system' ? getThemeFromSystem() : mode
  
  root.classList.remove('light', 'dark')
  root.classList.add(actualTheme)
  
  // Apply CSS custom properties
  const cssVars = generateCSSVariables()
  Object.entries(cssVars).forEach(([property, value]) => {
    root.style.setProperty(property, value)
  })
}

// Utility functions for theme-based styling
export const getStatusColor = (approved: boolean | null) => {
  if (approved === true) return flexLivingTheme.colors.status.approved
  if (approved === false) return flexLivingTheme.colors.status.rejected
  return flexLivingTheme.colors.status.pending
}

export const getRatingColor = (rating: number) => {
  if (rating >= 4.5) return flexLivingTheme.colors.rating.excellent
  if (rating >= 3.5) return flexLivingTheme.colors.rating.good
  if (rating >= 2.5) return flexLivingTheme.colors.rating.average
  return flexLivingTheme.colors.rating.poor
}

export const getChannelColor = (channel: string) => {
  const channelKey = channel.toLowerCase() as keyof typeof flexLivingTheme.colors.channels
  return flexLivingTheme.colors.channels[channelKey] || flexLivingTheme.colors.channels.default
}

// Animation utilities
export const createAnimation = (
  name: keyof typeof flexLivingTheme.animation.keyframes,
  duration = flexLivingTheme.animation.duration.normal,
  easing = flexLivingTheme.animation.easing.easeInOut
) => {
  return {
    animation: `${name} ${duration} ${easing}`,
  }
}

// Responsive utilities
export const createResponsiveValue = (
  values: Record<keyof typeof flexLivingTheme.breakpoints, string>
) => {
  const breakpoints = flexLivingTheme.breakpoints
  let css = ''
  
  Object.entries(values).forEach(([breakpoint, value]) => {
    const bp = breakpoint as keyof typeof breakpoints
    css += `@media (min-width: ${breakpoints[bp]}) { ${value} }\n`
  })
  
  return css
}

// FlexLiving specific component styling
export const flexLivingComponents = {
  // Manager dashboard card styling
  managerCard: {
    background: 'var(--card)',
    borderRadius: flexLivingTheme.borderRadius.lg,
    boxShadow: flexLivingTheme.boxShadow.card,
    border: '1px solid var(--border)',
    padding: flexLivingTheme.spacing.lg,
    transition: `box-shadow ${flexLivingTheme.animation.duration.normal} ${flexLivingTheme.animation.easing.easeInOut}`,
    '&:hover': {
      boxShadow: flexLivingTheme.boxShadow.cardHover,
    },
  },
  
  // Review card styling
  reviewCard: {
    background: 'var(--card)',
    borderRadius: flexLivingTheme.borderRadius.md,
    boxShadow: flexLivingTheme.boxShadow.card,
    border: '1px solid var(--border)',
    padding: flexLivingTheme.spacing.md,
    transition: `all ${flexLivingTheme.animation.duration.normal} ${flexLivingTheme.animation.easing.easeInOut}`,
    '&:hover': {
      boxShadow: flexLivingTheme.boxShadow.cardHover,
      transform: 'translateY(-2px)',
    },
  },
  
  // Property gallery styling
  propertyGallery: {
    borderRadius: flexLivingTheme.borderRadius.xl,
    overflow: 'hidden',
    boxShadow: flexLivingTheme.boxShadow.lg,
  },
  
  // Approval workflow styling
  approvalButton: {
    approved: {
      backgroundColor: flexLivingTheme.colors.status.approved.bg,
      color: flexLivingTheme.colors.status.approved.text,
      borderColor: flexLivingTheme.colors.status.approved.border,
    },
    rejected: {
      backgroundColor: flexLivingTheme.colors.status.rejected.bg,
      color: flexLivingTheme.colors.status.rejected.text,
      borderColor: flexLivingTheme.colors.status.rejected.border,
    },
    pending: {
      backgroundColor: flexLivingTheme.colors.status.pending.bg,
      color: flexLivingTheme.colors.status.pending.text,
      borderColor: flexLivingTheme.colors.status.pending.border,
    },
  },
}

export default flexLivingTheme

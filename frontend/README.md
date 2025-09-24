# FlexApp Frontend

A modern, responsive React/Next.js frontend for the FlexApp reviews management system. Built with Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui, and Aceternity UI components.

## 🚀 Features

- **Modern Tech Stack**: Next.js 14+ with App Router, React 18+, TypeScript
- **Beautiful UI**: shadcn/ui components with Aceternity UI enhancements
- **Dark/Light Theme**: Seamless theme switching with system preference detection
- **Real-time Updates**: React Query for efficient data fetching and caching
- **Responsive Design**: Mobile-first approach with modern animations
- **Type Safety**: Full TypeScript integration with comprehensive type definitions
- **Performance Optimized**: Code splitting, lazy loading, and optimized bundling

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── globals.css        # Global styles and CSS variables
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx          # Home page
│   ├── manager/           # Manager dashboard
│   └── property/         # Property pages
├── components/            # Reusable React components
│   ├── ui/               # shadcn/ui components
│   ├── ReviewCard.tsx    # Individual review display
│   ├── ReviewsTable.tsx  # Reviews management table
│   ├── FiltersPanel.tsx  # Advanced filtering
│   ├── ThemeToggle.tsx   # Theme switching
│   ├── PageLoader.tsx    # Loading states
│   └── Header.tsx        # Navigation header
├── lib/                  # Utilities and configurations
│   ├── api.ts           # API client with axios
│   ├── hooks.ts         # React Query hooks
│   ├── types.ts         # TypeScript interfaces
│   ├── utils.ts         # Utility functions
│   └── constants.ts     # Application constants
├── public/              # Static assets
├── next.config.js      # Next.js configuration
├── tailwind.config.ts  # Tailwind CSS config
└── tsconfig.json      # TypeScript configuration
```

## 🛠️ Installation

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env.local
   ```
   
   Update the environment variables:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at [http://localhost:3000](http://localhost:3000).

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting issues
- `npm run type-check` - Run TypeScript compiler check
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## 🎨 UI Components

### Core Components

- **ReviewCard**: Displays individual reviews with ratings, guest info, and approval actions
- **ReviewsTable**: Comprehensive table with sorting, filtering, and bulk actions
- **FiltersPanel**: Advanced filtering with date ranges, ratings, and status options
- **ThemeToggle**: Dark/light mode switching with smooth transitions
- **PageLoader**: Modern loading states with animations

### shadcn/ui Integration

All UI components are built on top of shadcn/ui for consistency and accessibility:
- Button, Card, Table, Input, Select
- Dialog, Toast, Tooltip, Badge
- Dropdown Menu, Sheet, Separator
- And more...

## 🌐 API Integration

The frontend integrates with the backend through a comprehensive API client:

```typescript
// Example API usage
import { api } from '@/lib/api';

// Fetch reviews
const reviews = await api.getReviews({ 
  page: 1, 
  limit: 10, 
  approved: true 
});

// Approve a review
await api.approveReview('review-id', { approved: true });
```

### React Query Hooks

```typescript
// Custom hooks for data fetching
import { useReviews, useApproveReview } from '@/lib/hooks';

function ReviewsPage() {
  const { data: reviews, isLoading } = useReviews();
  const approveReview = useApproveReview();
  
  // Component logic...
}
```

## 🎯 Key Features

### Manager Dashboard
- Comprehensive review management interface
- Real-time statistics and analytics
- Bulk approval/rejection actions
- Advanced filtering and search
- Sortable table with pagination

### Property Pages
- Beautiful property detail views
- Approved reviews display
- Rating breakdowns and statistics
- Responsive image galleries

### Theme System
- Automatic dark/light mode detection
- Smooth theme transitions
- Persistent theme preferences
- System theme synchronization

### Performance
- React Query for efficient caching
- Optimistic UI updates
- Code splitting and lazy loading
- Image optimization with Next.js

## 🔗 Backend Integration

The frontend is designed to work seamlessly with the FlexApp backend:

- **Reviews API**: Full CRUD operations with approval workflow
- **Listings API**: Property metadata and management
- **Hostaway Integration**: Automatic review synchronization
- **Real-time Updates**: WebSocket support for live updates

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Docker Deployment
```bash
docker build -t flexapp-frontend .
docker run -p 3000:3000 flexapp-frontend
```

### Environment Variables
```env
NEXT_PUBLIC_API_URL=https://api.youromain.com
NODE_ENV=production
```

## 🧪 Development

### Code Quality
- ESLint configuration with Next.js and TypeScript rules
- Prettier for consistent code formatting
- TypeScript strict mode enabled
- Git hooks for pre-commit linting

### Component Development
- Storybook integration (optional)
- Component testing with Jest and Testing Library
- Visual regression testing
- Accessibility testing with axe-core

## 📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**API Connection Issues**
```bash
# Check if backend is running
curl http://localhost:3001/api/health
```

**Build Errors**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

**Type Errors**
```bash
# Check TypeScript configuration
npm run type-check
```

### Getting Help

- Check the [Issues](../../../issues) page for known problems
- Review the backend API documentation
- Consult the Next.js and React Query documentation

---

Built with ❤️ using Next.js, TypeScript, and modern web technologies.

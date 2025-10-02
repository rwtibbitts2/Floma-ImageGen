# Enterprise Image Generation Tool

## Overview

This is an enterprise-grade batch image generation application built with React and Express.js. The application enables professional users to generate multiple AI-powered images at scale using OpenAI's image generation API. It features a workflow-first design inspired by professional creative tools like Figma and Adobe Creative Suite, focusing on batch processing with style consistency across generated images.

The application provides a comprehensive workflow for managing image styles, inputting visual concepts in bulk, configuring generation settings, tracking batch progress in real-time, and organizing results in a professional gallery interface. It also includes an AI-powered concept generator that analyzes reference images and marketing content to produce creative visual concepts for marketing campaigns.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### October 2, 2025

**Style Consistency Fix** - Resolved issue where images generated in the image generator differed from style extractor previews:
- Created shared `buildStyleDescription()` utility in `shared/utils.ts` to ensure consistent style description generation across frontend and backend
- Updated `StyleWorkspace.tsx` to use the shared utility when saving styles, preserving all extracted style attributes (colors, techniques, composition, lighting, mood, etc.)
- Previously, saved styles only included style name and description, losing detailed attributes
- Now saved styles include comprehensive style data, ensuring generated images match preview quality

**Transparency Support Fix** - Fixed transparency toggle not working consistently:
- Root cause: The transparency setting from generation settings was never being passed to the image generation function
- Additionally, prompts didn't explicitly instruct the AI to create transparent backgrounds
- Fixed `generateImagesAsync` to pass `settings.transparency` parameter to `buildImageParams`
- Added explicit transparency instruction to prompts when enabled: "Background: Transparent, no background, isolated subject"
- Applied fix to both main image generation and style preview endpoints
- Transparency now works reliably when using the gpt-image-1 model with the toggle enabled

**Cache Invalidation Fix** - Fixed issue where saved styles reverted to original state:
- Added proper `queryClient.invalidateQueries()` calls in save mutation's `onSuccess` callback
- Ensured cache invalidation uses both the returned data ID and current styleId for reliability
- Included `generatedConcept` field in update payload to preserve AI-generated concepts

## System Architecture

**Frontend Architecture**
- Built with React 18 using TypeScript for type safety
- Component-based architecture using shadcn/ui design system with Radix UI primitives
- Styling implemented with Tailwind CSS using a custom design system with light/dark mode support
- State management handled through React hooks and React Query for server state
- Routing implemented with Wouter for lightweight client-side navigation
- Form handling using React Hook Form with Zod validation schemas

**Backend Architecture**
- Express.js server with TypeScript providing RESTful API endpoints
- Modular route registration system with centralized error handling
- Storage abstraction layer supporting both memory-based and database implementations
- Session-based architecture prepared for user authentication
- Development environment includes Vite integration with hot module replacement

**Database Design**
- PostgreSQL database with Drizzle ORM for type-safe database operations
- Core entities: ImageStyles (reusable prompt templates), GenerationJobs (batch operations), GeneratedImages (individual results), ConceptLists (AI-generated marketing concepts)
- Schema supports tracking generation progress, status management, image metadata, and concept list management
- Migration system using Drizzle Kit for database version control

**Component Architecture**
- Modular UI components including StyleSelector, VisualConceptsInput, GenerationSettings, BatchProgressTracker, ResultsGallery, and ConceptGeneratorModal
- Each component follows single responsibility principle with clear prop interfaces
- Real-time progress tracking with thumbnail previews during batch generation
- Professional workflow components designed for repeated enterprise use
- Multi-step modals for AI-powered style extraction and concept generation workflows

**Design System**
- Custom Tailwind configuration with enterprise-focused color palette
- Consistent spacing system using standardized units (2, 4, 6, 8, 12)
- Typography hierarchy using Inter font family for professional appearance
- Component variants supporting both light and dark themes
- Professional button styles with subtle elevation effects on interaction

## External Dependencies

**UI Framework Dependencies**
- Radix UI primitives for accessible component foundations
- Tailwind CSS for utility-first styling approach
- Lucide React for consistent iconography
- React Hook Form with Hookform Resolvers for form validation

**Data Management**
- TanStack React Query for server state management and caching
- Drizzle ORM for type-safe database operations
- Zod for runtime type validation and schema definition
- Date-fns for date manipulation utilities

**Database Infrastructure**
- PostgreSQL as primary database (via DATABASE_URL environment variable)
- Neon Database serverless driver for cloud database connectivity
- Connect-pg-simple for PostgreSQL session store integration

**Development Tools**
- Vite for fast development server and build tooling
- ESBuild for production bundle optimization
- TypeScript for static type checking across full stack
- PostCSS with Autoprefixer for CSS processing

**Build and Deployment**
- Package.json scripts for development, building, and production deployment
- Environment-specific configuration supporting both development and production modes
- Replit-specific development tools including error modal and cartographer plugins
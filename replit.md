# Enterprise Image Generation Tool

## Overview

This is an enterprise-grade batch image generation application built with React and Express.js. The application enables professional users to generate multiple AI-powered images at scale using OpenAI's image generation API. It features a workflow-first design inspired by professional creative tools like Figma and Adobe Creative Suite, focusing on batch processing with style consistency across generated images.

The application provides a comprehensive workflow for managing image styles, inputting visual concepts in bulk, configuring generation settings, tracking batch progress in real-time, and organizing results in a professional gallery interface. It also includes an AI-powered concept generator that analyzes reference images and marketing content to produce creative visual concepts for marketing campaigns.

## User Preferences

Preferred communication style: Simple, everyday language.

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
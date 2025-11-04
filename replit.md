# Enterprise Image Generation Tool

## Overview

This is an enterprise-grade batch image generation application built with React and Express.js. The application enables professional users to generate multiple AI-powered images at scale using OpenAI's image generation API. It features a **three-prompt architecture** where reference images are analyzed to extract three distinct system prompts: Style, Composition, and Concept.

The application provides a comprehensive workflow for managing image styles through independent prompt refinement, inputting visual concepts in bulk, configuring generation settings, tracking batch progress in real-time, and organizing results in a professional gallery interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### November 4, 2025

**Three-Prompt Architecture Implementation** - Complete architectural refactor to modular prompt system:
- Replaced single-prompt extraction with three independent prompt types extracted from reference images
- Database schema updated: stylePrompt, compositionPrompt, conceptPrompt replace old aiStyleData/conceptPatternData fields
- Extraction endpoint now makes THREE parallel GPT-4 Vision calls to generate:
  - **Style Prompt**: System instructions for visual appearance (lighting, colors, materials, rendering)
  - **Composition Prompt**: System instructions for spatial organization (layout, perspective, depth, balance)
  - **Concept Prompt**: System instructions for concept ideation (metaphors, subject generation, brand tone)
- StyleWorkspace UI replaced with tabbed interface for independent prompt viewing and refinement
- Each tab allows conversational refinement of its specific prompt (200-350 words each)
- AIStyleExtractorModal streamlined to extract and display all three prompts with optional user context
- Image generation combines all three prompts as system instructions for consistent output
- Refinement endpoint accepts promptType parameter to refine specific prompts independently

## System Architecture

### Three-Prompt System

The core architecture is built around three specialized system prompts extracted from reference images:

**1. Style Prompt (Visual Appearance)**
- Defines rendering aesthetics: lighting principles, material properties, color characteristics
- Specifies post-processing style and tone keywords (cinematic, soft, luminous, etc.)
- Generated as 200-300 words of concise, declarative instructions

**2. Composition Prompt (Spatial Organization)**
- Defines spatial layout rules: viewpoint, symmetry, depth, flow
- Specifies density, negative space, rhythm, and subject archetypes
- Generated as 200-300 words focused on layout principles

**3. Concept Prompt (Subject Ideation)**
- Guides creative concept generation from marketing materials
- Defines brand tone, stylistic boundaries, and metaphorical approaches
- Provides output format guidelines for visual concepts
- Generated as 250-350 words of creative direction

### Extraction Workflow

1. User uploads reference image to AIStyleExtractorModal
2. Optionally adds context about brand, aesthetic, or media type
3. System makes THREE parallel GPT-4 Vision API calls analyzing the image
4. Each call generates focused system instructions for its domain
5. User reviews and edits all three prompts before saving
6. Saved style contains all three prompts as independent fields

### Refinement Workflow

1. User navigates to StyleWorkspace with saved style
2. Tabbed interface displays Style / Composition / Concept tabs
3. Each tab shows current prompt in read-only textarea
4. User provides conversational feedback in refinement textarea
5. "Refine" button sends feedback + current prompt to GPT-4
6. System returns refined prompt maintaining 200-350 word constraint
7. Refinement can be repeated iteratively for each prompt independently

### Image Generation Workflow

1. User selects style (containing three prompts) in main generator
2. Enters visual concepts in bulk
3. System combines all three prompts into system instructions:
   ```
   System instructions:
   [stylePrompt]
   [compositionPrompt]
   [conceptPrompt]
   
   Subject: [visual concept]
   ```
4. Images generated using combined prompt maintain consistency across style, composition, and concept

**Frontend Architecture**
- Built with React 18 using TypeScript for type safety
- Component-based architecture using shadcn/ui design system with Radix UI primitives
- Tabbed interface using Shadcn Tabs component for prompt organization
- Styling implemented with Tailwind CSS using a custom design system with light/dark mode support
- State management handled through React hooks and React Query for server state
- Routing implemented with Wouter for lightweight client-side navigation
- Form handling using React Hook Form with Zod validation schemas

**Backend Architecture**
- Express.js server with TypeScript providing RESTful API endpoints
- Modular route registration system with centralized error handling
- Storage abstraction layer supporting both memory-based and database implementations
- Parallel GPT-4 Vision API calls using Promise.all() for efficient extraction
- Session-based architecture with JWT authentication
- Development environment includes Vite integration with hot module replacement

**Database Design**
- PostgreSQL database with Drizzle ORM for type-safe database operations
- Core entities: ImageStyles (three-prompt templates), GenerationJobs (batch operations), GeneratedImages (individual results), ConceptLists (AI-generated marketing concepts)
- ImageStyles schema: stylePrompt, compositionPrompt, conceptPrompt, referenceImageUrl, previewImageUrl, name
- Schema supports tracking generation progress, status management, image metadata, and concept list management
- Migration system using Drizzle Kit for database version control

**Component Architecture**
- StyleWorkspace: Tabbed interface for viewing and refining three prompts independently
- AIStyleExtractorModal: Streamlined extraction flow with single optional context input
- StyleSelector: Dropdown for selecting saved styles in main generator
- VisualConceptsInput: Bulk concept entry for batch generation
- GenerationSettings: Model, quality, size, transparency configuration
- BatchProgressTracker: Real-time progress tracking with thumbnail previews
- ResultsGallery: Professional gallery interface for generated images
- ConceptGeneratorModal: AI-powered marketing concept generation from reference images and copy

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

**AI Integration**
- OpenAI API for GPT-4 Vision (prompt extraction) and image generation
- Parallel API calls for efficient multi-prompt extraction
- Combined prompt system for consistent generation output

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

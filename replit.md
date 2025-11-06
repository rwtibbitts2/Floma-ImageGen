# Enterprise Image Generation Tool

## Overview

This is an enterprise-grade batch image generation application built with React and Express.js. The application enables professional users to generate multiple AI-powered images at scale using OpenAI's image generation API. It features a **three-prompt architecture** where reference images are analyzed to extract three distinct system prompts: Style, Composition, and Concept.

The application provides a comprehensive workflow for managing image styles through independent prompt refinement, inputting visual concepts in bulk, configuring generation settings, tracking batch progress in real-time, and organizing results in a professional gallery interface.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### November 6, 2025

**Modular Media Adapter System** - Added media-specific adjustment architecture:
- Created `mediaAdapters` database table with vocabulary, lighting, surface, and conceptual adjustment fields
- Added `mediaAdapterId` foreign key to `imageStyles` to track which adapter was used during extraction
- Implemented complete CRUD API endpoints for managing media adapters with authentication and validation
- Seeded four baseline adapters with detailed specifications:
  - **Photography**: Grounded, realistic imagery using light, material, and framing as metaphors
  - **Illustration**: Stylized 2D artwork using color, shape, and simplification for conceptual clarity
  - **3D Render**: Physically based dimensional imagery using materials and lighting for depth
  - **Product/UI Design**: Digital interface imagery emphasizing clarity, hierarchy, and layering
- Enforced single-default adapter invariant: exactly one default adapter at all times through atomic updates
- Updated extraction endpoint to accept `mediaAdapterId` parameter and inject adapter-specific adjustments into style and concept prompts
- Architecture pattern: **Core Prompt + Media Adapter → Final System Prompt**

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

### Modular Media Adapter System

The system uses a **Core Prompt + Media Adapter** architecture where media-specific adjustments modify the base extraction behavior:

**Architecture Pattern**: `Core Prompts + Media Adapter → Final System Prompt`

**Media Adapters** define domain-specific vocabulary, lighting, surface, and conceptual adjustments:
- **Vocabulary Adjustments**: Media-specific terminology and language constraints
- **Lighting Adjustments**: How light behaves in the medium (photographic, stylized, technical)
- **Surface Adjustments**: Material rendering and texture characteristics for the medium
- **Conceptual Adjustments**: Composition rules, concept constraints, and realism level

**Four Baseline Adapters**:
1. **Photography** (default): Optical capture, natural light, tactile realism, rule-of-thirds composition
2. **Illustration**: Graphic forms, flat/simplified lighting, smooth fills, symbolic abstractions
3. **3D Render**: PBR materials, technical lighting, cinematic perspectives, geometric metaphors
4. **Product/UI Design**: Interface elements, gradient depth lighting, modular grids, data metaphors

**Adapter Workflow**:
1. During extraction, user selects (or defaults to) a media adapter
2. Adapter adjustments are injected into the extraction prompts sent to GPT-4 Vision
3. Resulting core prompts are media-specific and maintain adapter constraints
4. At image generation, adapter is referenced to ensure final output maintains media coherence

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
- Core entities: ImageStyles (three-prompt templates), MediaAdapters (media-specific adjustments), GenerationJobs (batch operations), GeneratedImages (individual results), ConceptLists (AI-generated marketing concepts)
- ImageStyles schema: stylePrompt, compositionPrompt, conceptPrompt, mediaAdapterId (FK), referenceImageUrl, previewImageUrl, name
- MediaAdapters schema: name, description, vocabularyAdjustments, lightingAdjustments, surfaceAdjustments, conceptualAdjustments, isDefault
- Single-default invariant enforced: exactly one adapter flagged as default at all times via atomic updates
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

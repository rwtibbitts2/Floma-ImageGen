# Enterprise Image Generation Tool

## Overview

This enterprise-grade batch image generation application, built with React and Express.js, enables professional users to generate multiple AI-powered images at scale using OpenAI's image generation API. Its core innovation is a **three-prompt architecture** that analyzes reference images to extract distinct Style, Composition, and Concept prompts. The application provides a comprehensive workflow for managing image styles through independent prompt refinement, inputting visual concepts in bulk, configuring generation settings, tracking batch progress in real-time, and organizing results in a professional gallery interface. The business vision is to empower enterprises with efficient and consistent AI image generation, streamlining creative workflows and ensuring brand coherence across diverse visual content.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles

The application employs a **Modular Media Adapter System** and a **Three-Prompt Architecture** to achieve highly customized and consistent AI image generation.

-   **Modular Media Adapter System**: Uses a "Core Prompt + Media Adapter → Final System Prompt" architecture. Media Adapters define domain-specific adjustments (vocabulary, lighting, surface, conceptual) that modify base prompt extraction and generation. Baseline Adapters include Photography, Illustration, 3D Render, and Product/UI Design.
-   **Three-Prompt Architecture**: Extracts three independent, specialized system prompts from reference images:
    1.  **Style Prompt**: Defines visual appearance (lighting, colors, materials, rendering aesthetics).
    2.  **Composition Prompt**: Defines spatial organization (layout, perspective, depth, balance), with structured JSON for detailed frameworks.
    3.  **Concept Prompt**: Guides creative concept generation and subject ideation (brand tone, metaphorical approaches), with structured JSON output for detailed conceptual frameworks.

### Key Features and Implementations

-   **Extraction Workflow**: Users upload a reference image, and the system makes three parallel GPT-4 Vision API calls to generate the Style, Composition, and Concept prompts.
-   **Refinement Workflow**: A tabbed interface in the StyleWorkspace allows iterative, conversational refinement of each prompt independently. When the concept prompt is refined, test concepts are automatically regenerated using the new prompt to maintain consistency.
-   **Image Generation Workflow**: Combines the selected Style, Composition, and user's Concept prompts into a single system instruction for OpenAI's image generation API, using framework instructions where available.
-   **Test Concept Generation**: During extraction, 3 example concepts are automatically generated using the concept prompt and `concept_output_schema`, utilizing the full `conceptFramework` JSON for precision. Test concepts use the structured format with `visual_concept` and `core_graphic` properties for consistency with bulk concept generation. When the concept prompt is refined, test concepts automatically regenerate to reflect the updated guidance.
-   **Componentized System Prompts Architecture**: Migrated from hardcoded prompts to a database-backed system with admin management, allowing rapid iteration on extraction quality and A/B testing different prompt strategies. This includes a `concept_output_schema` for consistent, structured concept output.

### Technical Architecture

-   **Frontend**: React 18 with TypeScript, component-based using shadcn/ui and Radix UI primitives. Styling with Tailwind CSS, state management with React hooks and React Query, and routing with Wouter.
-   **Backend**: Express.js server with TypeScript, providing RESTful API endpoints, modular route registration, and centralized error handling. Employs session-based architecture with JWT authentication.
-   **Database**: PostgreSQL with Drizzle ORM for type-safe operations. Key entities include ImageStyles (for the three prompts), SystemPrompts (database-backed extraction prompts), MediaAdapters, GenerationJobs, GeneratedImages, and ConceptLists. Enforces single-default invariant for MediaAdapters and single-active-per-type constraint for SystemPrompts.
-   **Component Architecture**: Includes StyleWorkspace, AIStyleExtractorModal, StyleSelector, VisualConceptsInput, BatchProgressTracker, ResultsGallery, and ConceptGeneratorModal.
-   **Design System**: Custom Tailwind configuration with an enterprise-focused color palette, consistent spacing, Inter font family, and light/dark mode support.

## External Dependencies

-   **UI Framework Dependencies**: Radix UI, Tailwind CSS, Lucide React, React Hook Form (with Hookform Resolvers).
-   **Data Management**: TanStack React Query, Drizzle ORM, Zod, Date-fns.
-   **AI Integration**: OpenAI API (for GPT-4 Vision and image generation).
-   **Database Infrastructure**: PostgreSQL (via DATABASE_URL), Neon Database serverless driver, Connect-pg-simple.
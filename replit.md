# Enterprise Image Generation Tool

## Overview

This enterprise-grade batch image generation application, built with React and Express.js, enables professional users to generate multiple AI-powered images at scale using OpenAI's image generation API. Its core innovation is a **three-prompt architecture** that analyzes reference images to extract distinct Style, Composition, and Concept prompts. The application provides a comprehensive workflow for managing image styles through independent prompt refinement, inputting visual concepts in bulk, configuring generation settings, tracking batch progress in real-time, and organizing results in a professional gallery interface. The business vision is to empower enterprises with efficient and consistent AI image generation, streamlining creative workflows and ensuring brand coherence across diverse visual content.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### November 6, 2025

**Structured JSON Prompt Extraction System** - Updated composition and concept extraction to use comprehensive JSON schemas:

**Composition Prompt Enhancement**:
- Replaced simple text-based composition extraction with structured JSON schema approach
- Extracts detailed composition framework with 10 specialized fields: subject archetype, frame geometry, camera/perspective, spatial balance, focal structure, directional flow, depth/layers, negative space/density, motion/energy, and arrangement guidelines
- Each framework field provides 1-3 sentences of focused analysis
- Final output: comprehensive 200-350 word `final_instruction_prompt` synthesizing all compositional insights

**Concept Prompt Enhancement**:
- Replaced simple text-based concept extraction with comprehensive JSON schema approach  
- Extracts detailed concept framework with 6 specialized fields: subject approach, representation style, brand tone alignment, thematic scope, visual devices, and ideation guidelines
- Each framework field provides 1-3 sentences of focused analysis
- Final output: comprehensive 200-350 word `final_instruction_prompt` synthesizing all conceptual insights

**Technical Implementation**:
- Both prompts use `response_format: { type: "json_object" }` for structured GPT-4 output
- Increased max_tokens to 1500 to accommodate comprehensive JSON responses
- Robust JSON parsing extracts `final_instruction_prompt` field as the stored prompt
- Graceful fallbacks if JSON parsing fails
- Framework names logged for debugging and validation

**Test Concept Generation Feature**:
- Added `testConcepts` jsonb array field to `imageStyles` database schema
- Automatically generates 3 test concepts during extraction using the concept prompt
- Test concepts displayed with navigation in extraction modal and workspace
- Regenerate button allows re-generating concepts after prompt refinement
- Security fix: sanitized OpenAI responses to prevent API key exposure

**Enhanced Test Concept Regeneration with Full Framework**:
- Updated regenerate-test-concepts endpoint to accept and utilize the full `conceptFramework` JSON
- When regenerating concepts, the system now leverages all structured framework fields (subject_approach, representation_style, brand_tone_alignment, visual_devices, ideation_guidelines) for more precise concept generation
- Frontend StyleWorkspace persists both `conceptFramework` and `compositionFramework` state and includes them in save operations
- Graceful fallback to text-based prompt if structured framework is not available
- Enables more consistent and aligned concept generation after prompt refinement

## System Architecture

### Core Design Principles

The application employs a **Modular Media Adapter System** and a **Three-Prompt Architecture** to achieve highly customized and consistent AI image generation.

**Modular Media Adapter System**:
This system uses a "Core Prompt + Media Adapter → Final System Prompt" architecture. Media Adapters define domain-specific adjustments (vocabulary, lighting, surface, conceptual) that modify the base prompt extraction and generation behavior.
-   **Baseline Adapters**: Photography, Illustration, 3D Render, and Product/UI Design.
-   **Workflow**: Users select a media adapter, whose adjustments are injected into extraction prompts and then referenced during image generation to ensure media coherence.

**Three-Prompt Architecture**:
The system extracts three independent, specialized system prompts from reference images:
1.  **Style Prompt**: Defines visual appearance (lighting, colors, materials, rendering aesthetics).
2.  **Composition Prompt**: Defines spatial organization (layout, perspective, depth, balance).
3.  **Concept Prompt**: Guides creative concept generation and subject ideation (brand tone, metaphorical approaches). This prompt includes structured JSON output for detailed conceptual frameworks.

### Key Features and Implementations

*   **Extraction Workflow**: Users upload a reference image, and the system makes three parallel GPT-4 Vision API calls to generate the Style, Composition, and Concept prompts.
*   **Refinement Workflow**: A tabbed interface in the StyleWorkspace allows iterative, conversational refinement of each prompt independently.
*   **Image Generation Workflow**: The system combines the selected Style, Composition, and Concept prompts with the user's visual concept into a single system instruction for OpenAI's image generation API.
*   **Test Concept Generation**: During extraction, 3 example concepts are automatically generated and displayed for immediate validation of the concept prompt.

### Technical Architecture

*   **Frontend**: React 18 with TypeScript, component-based using shadcn/ui and Radix UI primitives. Styling with Tailwind CSS, state management with React hooks and React Query, and routing with Wouter.
*   **Backend**: Express.js server with TypeScript, providing RESTful API endpoints, modular route registration, and centralized error handling. Employs session-based architecture with JWT authentication.
*   **Database**: PostgreSQL with Drizzle ORM for type-safe operations. Key entities include ImageStyles (for the three prompts), MediaAdapters, GenerationJobs, GeneratedImages, and ConceptLists. A single-default invariant is enforced for MediaAdapters.
*   **Component Architecture**: Includes StyleWorkspace, AIStyleExtractorModal, StyleSelector, VisualConceptsInput, BatchProgressTracker, ResultsGallery, and ConceptGeneratorModal.
*   **Design System**: Custom Tailwind configuration with an enterprise-focused color palette, consistent spacing, Inter font family, and light/dark mode support.

## External Dependencies

*   **UI Framework Dependencies**: Radix UI, Tailwind CSS, Lucide React, React Hook Form (with Hookform Resolvers).
*   **Data Management**: TanStack React Query, Drizzle ORM, Zod, Date-fns.
*   **AI Integration**: OpenAI API (for GPT-4 Vision and image generation).
*   **Database Infrastructure**: PostgreSQL (via DATABASE_URL), Neon Database serverless driver, Connect-pg-simple.
*   **Development Tools**: Vite, ESBuild, TypeScript, PostCSS with Autoprefixer.
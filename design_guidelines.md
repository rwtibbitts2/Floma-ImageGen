# Design Guidelines: Enterprise Image Generation Tool

## Design Approach
**Reference-Based Approach**: Drawing inspiration from professional creative tools like Figma, Adobe Creative Suite, and Notion for their clean, utility-focused interfaces that prioritize workflow efficiency over visual flair.

## Design Principles
- **Workflow-First**: Every element serves the batch generation workflow
- **Professional Efficiency**: Minimize cognitive load for repeated use
- **Enterprise Polish**: Clean, trustworthy interface for business use

## Core Design Elements

### Color Palette
**Light Mode:**
- Primary: 220 85% 10% (deep professional blue)
- Surface: 220 20% 98% (subtle warm white)
- Accent: 160 60% 45% (success green for completed generations)
- Border: 220 15% 85% (subtle gray)

**Dark Mode:**
- Primary: 220 85% 65% (bright blue)
- Surface: 220 15% 8% (dark charcoal)
- Accent: 160 50% 55% (muted success green)
- Border: 220 10% 25% (dark border)

### Typography
- **Primary**: Inter (clean, professional)
- **Monospace**: JetBrains Mono (for JSON/technical content)
- Hierarchy: text-xs to text-2xl with consistent font-weight-medium for headers

### Layout System
**Tailwind Spacing**: Consistent use of units 2, 4, 6, 8, 12 for all margins, padding, and gaps
- Tight spacing (p-2, gap-2) for form controls
- Medium spacing (p-4, gap-4) for card content
- Generous spacing (p-8, gap-12) for major sections

### Component Library
**Primary Components:**
- **Style Manager**: Dropdown with JSON file selection and preview
- **Visual Concepts Input**: Textarea with JSON validation and item count
- **Generation Settings Panel**: Organized form with quality, size, aspect ratio controls
- **Batch Progress Tracker**: Real-time progress with thumbnail previews
- **Results Gallery**: Grid layout with download options

**Secondary Components:**
- Clean form inputs with subtle borders
- Professional buttons with minimal hover states
- Status indicators using color-coded badges
- Collapsible sections for advanced settings

### Interface Layout
**Three-Panel Layout:**
1. **Left Sidebar** (w-80): Style management and settings
2. **Main Content** (flex-1): Visual concepts input and generation controls
3. **Right Panel** (w-96): Progress tracking and results preview

**Key Interactions:**
- Single-click style selection updates entire interface
- Drag-and-drop JSON file upload for styles
- Real-time validation of JSON inputs
- Batch generation with pause/resume controls

### Visual Hierarchy
- Primary actions use solid buttons with primary colors
- Secondary actions use subtle outline buttons
- Status information uses muted text colors
- Error states use warm red (0 65% 55%) with clear messaging

**No Hero Images**: This is a utility tool focused on workflow efficiency rather than marketing appeal.
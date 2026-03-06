# Questiz: Step-by-Step Codex Development Plan

> Django + React + PostgreSQL + shadcn/ui
> SurveyShare feature parity with enhanced reporting and visualization
> Authentication already handled in existing boilerplate

---

## Library Stack Reference

Before starting, install these across the project. Every phase references them.

### Backend (Python / Django)

| Library | Purpose | Install |
|---------|---------|---------|
| `djangorestframework` | API layer (serializers, viewsets, permissions, pagination) | `pip install djangorestframework` |
| `django-filter` | Querystring filtering on API endpoints | `pip install django-filter` |
| `django-cors-headers` | CORS for React frontend | `pip install django-cors-headers` |
| `Pillow` | Image handling (logos, image questions) | `pip install Pillow` |
| `qrcode[pil]` | QR code generation for distribution | `pip install "qrcode[pil]"` |
| `weasyprint` | PDF report generation (HTML/CSS to PDF) | `pip install weasyprint` |
| `openpyxl` | Excel (.xlsx) export with formatting and charts | `pip install openpyxl` |
| `python-pptx` | PowerPoint (.pptx) export with charts | `pip install python-pptx` |
| `celery[redis]` | Async tasks (email sending, report generation) | `pip install "celery[redis]"` |
| `django-celery-beat` | Scheduled tasks (survey launch, reminders) | `pip install django-celery-beat` |
| `django-storages` + `boto3` | File storage (S3 or local) | `pip install django-storages boto3` |
| `shortuuid` | Short unique IDs for survey public URLs | `pip install shortuuid` |
| `django-import-export` | Admin-level data import/export | `pip install django-import-export` |

### Frontend (React / TypeScript)

| Library | Purpose | Install |
|---------|---------|---------|
| `recharts` | Primary charting: bar, pie, line, area, radar, scatter, funnel, composed charts | `npm i recharts` |
| `@nivo/heatmap` `@nivo/waffle` `@nivo/treemap` | Advanced viz: heatmaps, waffle charts, treemaps for matrix/cross-tab data | `npm i @nivo/heatmap @nivo/waffle @nivo/treemap @nivo/core` |
| `d3-cloud` + `react-d3-cloud` | Word clouds for open-ended text analysis | `npm i react-d3-cloud` |
| `@dnd-kit/core` `@dnd-kit/sortable` | Drag-and-drop survey builder | `npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` |
| `react-hook-form` + `zod` | Form management and validation (builder + respondent) | `npm i react-hook-form zod @hookform/resolvers` |
| `@tanstack/react-query` | Server state, caching, optimistic updates | `npm i @tanstack/react-query` |
| `@tanstack/react-table` | Data tables for individual responses, cross-tab views | `npm i @tanstack/react-table` |
| `react-colorful` | Color picker for theme editor | `npm i react-colorful` |
| `html2canvas` | Client-side chart screenshot for quick PNG export | `npm i html2canvas` |
| `lucide-react` | Icons (likely already in shadcn boilerplate) | `npm i lucide-react` |
| `sonner` | Toast notifications | `npm i sonner` |
| `zustand` | Lightweight client state for builder canvas | `npm i zustand` |
| `react-share` | Social sharing buttons (Facebook, Twitter/X, LinkedIn, email) | `npm i react-share` |
| `qrcode.react` | Client-side QR code rendering with download | `npm i qrcode.react` |

### Why this charting combination?

**Recharts** is the primary engine. It is React-native (JSX components, not imperative), composable (mix chart types in `<ComposedChart>`), responsive out of the box, and integrates cleanly with Tailwind/shadcn theming via CSS variables. It covers 80% of the visualization needs: bar charts, pie charts, donut charts, line charts, area charts, stacked bar charts, radar charts, scatter plots, and funnel charts.

**Nivo** fills the gaps Recharts cannot. Heatmaps for matrix/grid question analysis, waffle charts for proportional display (a better visual alternative to pie charts for large datasets), and treemaps for hierarchical category breakdowns. Nivo renders via SVG with gorgeous defaults and supports theming objects that can mirror your shadcn palette.

**react-d3-cloud** handles word clouds for open-ended text responses. It is lightweight, renders via SVG, and allows font size scaling by word frequency.

This combination gives users the flexibility to pick the best visualization for each question type, which is the core differentiator you want.

---

## Database Schema Design

Study this schema before starting any phase. Every phase builds on it.

```
┌──────────────────────────────────────────────────────────────┐
│  SURVEY MANAGEMENT                                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  User (from auth boilerplate)                                │
│    ├─── Workspace (team grouping, optional)                  │
│    └─── Survey                                               │
│           ├── id, title, description, status                 │
│           │   (draft/active/paused/closed)                   │
│           ├── slug (shortuuid, public URL)                   │
│           ├── theme (JSONField: colors, font, logo_url)      │
│           ├── settings (JSONField: progress_bar,             │
│           │   numbering, save_continue, multi_response,      │
│           │   close_date, close_message, response_limit)     │
│           ├── welcome_page (JSONField: enabled, title, desc) │
│           ├── thank_you_page (JSONField: enabled, title,     │
│           │   desc, redirect_url, show_results)              │
│           ├── created_at, updated_at                         │
│           │                                                  │
│           ├─── Page                                          │
│           │     ├── id, survey_id, title, description        │
│           │     ├── order (PositiveIntegerField)             │
│           │     ├── skip_logic (JSONField, nullable)         │
│           │     │   {action: "skip_to_page"|"end_survey",    │
│           │     │    target_page_id: uuid}                   │
│           │     │                                            │
│           │     └─── Question                                │
│           │           ├── id, page_id, order                 │
│           │           ├── question_type (CharField choices)  │
│           │           │   "multiple_choice_single"           │
│           │           │   "multiple_choice_multi"            │
│           │           │   "dropdown"                         │
│           │           │   "short_text"                       │
│           │           │   "long_text"                        │
│           │           │   "yes_no"                           │
│           │           │   "rating_scale"                     │
│           │           │   "star_rating"                      │
│           │           │   "nps"                              │
│           │           │   "constant_sum"                     │
│           │           │   "date_time"                        │
│           │           │   "matrix"                           │
│           │           │   "ranking"                          │
│           │           │   "image_choice"                     │
│           │           │   "file_upload"                      │
│           │           │   "demographics"                     │
│           │           │   "section_heading"                  │
│           │           │   "instructional_text"               │
│           │           │                                      │
│           │           ├── text (question title)              │
│           │           ├── description (optional help text)   │
│           │           ├── required (BooleanField)            │
│           │           ├── settings (JSONField)               │
│           │           │   {randomize_choices: bool,          │
│           │           │    allow_other: bool,                │
│           │           │    allow_comment: bool,              │
│           │           │    min_value: int, max_value: int,   │
│           │           │    step: int, labels: {},            │
│           │           │    validation: {type, pattern, msg}, │
│           │           │    image_url: str}                   │
│           │           │                                      │
│           │           ├── skip_logic (JSONField, nullable)   │
│           │           │   [{condition: {choice_id: uuid},    │
│           │           │     action: "skip_to_page",          │
│           │           │     target: uuid}]                   │
│           │           │                                      │
│           │           └─── Choice                            │
│           │                 ├── id, question_id, order       │
│           │                 ├── text, image_url (nullable)   │
│           │                 ├── is_other (BooleanField)      │
│           │                 └── score (IntegerField,         │
│           │                     nullable, for rating/NPS)    │
│           │                                                  │
│           ├─── Collector                                     │
│           │     ├── id, survey_id, type                      │
│           │     │   (web_link/email/embed/social/qr)         │
│           │     ├── name, status (open/closed)               │
│           │     ├── settings (JSONField)                     │
│           │     │   {password: str, allow_multiple: bool,    │
│           │     │    close_date: datetime, response_limit:   │
│           │     │    int, anonymize: bool}                   │
│           │     └── created_at                               │
│           │                                                  │
│           └─── EmailInvitation                               │
│                 ├── id, collector_id, email, status           │
│                 │   (pending/sent/opened/completed/bounced)  │
│                 ├── sent_at, opened_at, completed_at         │
│                 └── token (unique, for tracking)             │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  RESPONSE DATA                                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  SurveyResponse                                              │
│    ├── id, survey_id, collector_id (nullable)                │
│    ├── respondent_email (nullable, if tracked)               │
│    ├── status (in_progress / completed)                      │
│    ├── ip_address, user_agent                                │
│    ├── started_at, completed_at, last_active_at              │
│    ├── duration_seconds (computed on completion)             │
│    ├── current_page_id (for save & continue)                 │
│    ├── resume_token (for save & continue URL)                │
│    │                                                         │
│    └─── Answer                                               │
│          ├── id, response_id, question_id                    │
│          ├── choice_ids (ArrayField of UUIDs, for selected)  │
│          ├── text_value (TextField, for open-ended)          │
│          ├── numeric_value (DecimalField, for ratings/NPS)   │
│          ├── date_value (DateTimeField, for date questions)  │
│          ├── file_url (for file uploads)                     │
│          ├── matrix_data (JSONField, for matrix grids)       │
│          │   {row_id: {col_id: value}}                       │
│          ├── ranking_data (JSONField, for ranking)           │
│          │   [choice_id_rank1, choice_id_rank2, ...]         │
│          ├── constant_sum_data (JSONField)                   │
│          │   {choice_id: numeric_value}                      │
│          ├── other_text (for "Other" option text)            │
│          ├── comment_text (for optional comment box)         │
│          └── answered_at                                     │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  REPORTING                                                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  SavedReport                                                 │
│    ├── id, survey_id, user_id, name                          │
│    ├── config (JSONField)                                    │
│    │   {filters: [], question_ids: [],                       │
│    │    chart_overrides: {q_id: {type, colors, options}},    │
│    │    layout: "summary"|"custom",                          │
│    │    cross_tabs: [{row_q_id, col_q_id}]}                 │
│    ├── is_shared (BooleanField), share_password              │
│    └── created_at, updated_at                                │
│                                                              │
│  ExportJob                                                   │
│    ├── id, survey_id, user_id                                │
│    ├── format (pdf/xlsx/pptx/csv)                            │
│    ├── config (JSONField: filters, questions, report_id)     │
│    ├── status (pending/processing/completed/failed)          │
│    ├── file_url, error_message                               │
│    └── created_at, completed_at                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Models and Survey CRUD API

> Foundation. No frontend yet. Build all models, migrations, serializers, and viewsets.
> Test with DRF Browsable API or curl.

### Step 1.1 — Django App Structure

```
Prompt for Codex:

Create a Django app called `surveys` inside the existing project. Set up the
following model files, each in a separate module under `surveys/models/`:

- __init__.py (imports all models)
- survey.py — Survey model with fields: id (UUIDField primary key), user (FK
  to AUTH_USER_MODEL), title, description, slug (unique, default=shortuuid),
  status (choices: draft/active/paused/closed, default=draft), theme (JSONField
  default=dict), settings (JSONField default=dict), welcome_page (JSONField
  default=dict), thank_you_page (JSONField default=dict), created_at, updated_at.
  Add a Meta ordering by -created_at.

- page.py — Page model: id (UUID), survey (FK cascade), title (blank), 
  description (blank), order (PositiveIntegerField), skip_logic (JSONField 
  null=True blank=True). Meta: ordering = ['order'], unique_together = 
  ['survey', 'order'].

- question.py — Question model: id (UUID), page (FK cascade), question_type 
  (CharField max_length=30 with choices for all 17 types listed in schema), 
  text (TextField), description (TextField blank), required (BooleanField 
  default=False), order (PositiveIntegerField), settings (JSONField default=dict),
  skip_logic (JSONField null=True blank=True). Meta: ordering = ['order'].

- choice.py — Choice model: id (UUID), question (FK cascade), text, image_url
  (URLField blank null), is_other (BooleanField default=False), order 
  (PositiveIntegerField), score (IntegerField null blank). Meta: ordering = 
  ['order'].

Use UUIDField with default=uuid.uuid4 for all primary keys. Register all models
in admin.py with appropriate list_display and list_filter. Run makemigrations 
and migrate.
```

### Step 1.2 — Response and Answer Models

```
Prompt for Codex:

In the surveys app, add two more model files:

- response.py — SurveyResponse model: id (UUID), survey (FK cascade), 
  collector (FK SET_NULL null blank), respondent_email (EmailField blank null),
  status (choices: in_progress/completed, default=in_progress), ip_address 
  (GenericIPAddressField blank null), user_agent (TextField blank), started_at
  (auto_now_add), completed_at (DateTimeField null blank), last_active_at 
  (DateTimeField auto_now), duration_seconds (PositiveIntegerField null blank),
  current_page (FK to Page SET_NULL null blank), resume_token (CharField 
  max_length=32 unique default=shortuuid). Index on [survey, status] and 
  [survey, completed_at].

- answer.py — Answer model: id (UUID), response (FK cascade related_name=
  'answers'), question (FK cascade), choice_ids (JSONField default=list), 
  text_value (TextField blank), numeric_value (DecimalField max_digits=10 
  decimal_places=2 null blank), date_value (DateTimeField null blank), 
  file_url (URLField blank), matrix_data (JSONField null blank), ranking_data
  (JSONField null blank), constant_sum_data (JSONField null blank), other_text
  (TextField blank), comment_text (TextField blank), answered_at (auto_now).
  Meta: unique_together = ['response', 'question'].

Run makemigrations and migrate.
```

### Step 1.3 — Collector and Distribution Models

```
Prompt for Codex:

Add to the surveys app:

- collector.py — Collector model: id (UUID), survey (FK cascade), type 
  (choices: web_link/email/embed/social/qr), name (CharField), status 
  (choices: open/closed, default=open), settings (JSONField default=dict),
  created_at (auto_now_add). The settings JSONField stores: password (str),
  allow_multiple (bool), close_date (datetime str), response_limit (int),
  anonymize (bool).

- email_invitation.py — EmailInvitation model: id (UUID), collector (FK 
  cascade), email (EmailField), status (choices: pending/sent/opened/
  completed/bounced, default=pending), sent_at, opened_at, completed_at 
  (all DateTimeField null blank), token (CharField max_length=32 unique 
  default=shortuuid).

- report.py — SavedReport model: id (UUID), survey (FK cascade), user (FK),
  name (CharField), config (JSONField default=dict), is_shared (BooleanField
  default=False), share_password (CharField blank null max_length=128),
  created_at, updated_at.

- export_job.py — ExportJob model: id (UUID), survey (FK cascade), user (FK),
  format (choices: pdf/xlsx/pptx), config (JSONField default=dict), status
  (choices: pending/processing/completed/failed, default=pending), file_url
  (URLField blank), error_message (TextField blank), created_at (auto_now_add),
  completed_at (DateTimeField null blank).

Register in admin. Run makemigrations and migrate.
```

### Step 1.4 — DRF Serializers and ViewSets

```
Prompt for Codex:

Create surveys/serializers/ directory with separate files:

- survey_serializers.py:
  SurveyListSerializer (id, title, slug, status, response_count annotated, 
  created_at, updated_at).
  SurveyDetailSerializer (all fields + nested pages with questions and choices).
  SurveyCreateUpdateSerializer (title, description, theme, settings, 
  welcome_page, thank_you_page).

- page_serializers.py:
  PageSerializer (all fields + nested questions with choices via 
  QuestionWithChoicesSerializer). Include create/update that handles 
  reordering.

- question_serializers.py:
  QuestionSerializer (all fields + nested choices).
  QuestionCreateSerializer with writable nested choices — override create() 
  and update() to handle bulk choice creation/update.

- choice_serializers.py:
  ChoiceSerializer (all fields).

- response_serializers.py:
  SurveyResponseSerializer for list view (id, status, started_at, 
  completed_at, duration_seconds, respondent_email).
  SurveyResponseDetailSerializer with nested answers.
  SubmitAnswerSerializer for the public survey-taking endpoint.

- collector_serializers.py:
  CollectorSerializer (all fields).

Create surveys/views/ directory with:

- survey_views.py — SurveyViewSet (ModelViewSet) filtered to request.user,
  with list/create/retrieve/update/destroy. Add a @action for `duplicate` 
  that deep-copies a survey with all pages, questions, choices. Add a 
  @action for `publish` (status -> active) and `close` (status -> closed).

- page_views.py — PageViewSet nested under survey 
  (/api/surveys/{survey_pk}/pages/). Support reorder via PATCH with 
  bulk order updates.

- question_views.py — QuestionViewSet nested under page 
  (/api/surveys/{survey_pk}/pages/{page_pk}/questions/). Include 
  bulk reorder action.

- response_views.py — Two viewsets:
  1. SurveyResponseViewSet (for survey owner: list, retrieve responses with 
     filtering by status, collector, date range).
  2. PublicSurveyView (no auth required): GET retrieves survey structure by 
     slug for respondents. POST submits answers. PUT updates in-progress 
     response (save & continue).

- collector_views.py — CollectorViewSet nested under survey.

Wire all routes in surveys/urls.py using DRF nested routers 
(drf-nested-routers or manual URL patterns). Include in project urls.py 
under /api/.
```

### Step 1.5 — Test the Foundation

```
Prompt for Codex:

Write tests in surveys/tests/:

- test_survey_crud.py: Create, list, retrieve, update, delete survey. 
  Test that users only see their own surveys. Test duplicate action 
  deep-copies everything.

- test_question_types.py: Create one question of each type with 
  appropriate choices and settings. Verify serialization roundtrip.

- test_public_survey.py: Publish a survey, fetch by slug without auth, 
  submit a complete response, verify Answer records created correctly.

- test_save_continue.py: Start a response, save partial answers, resume 
  via token, complete the response.

Run all tests and fix any failures.
```

---

## Phase 2: Survey Builder Frontend

> The drag-and-drop builder interface. This is the most complex UI piece.

### Step 2.1 — Survey Dashboard Page

```
Prompt for Codex:

Create a SurveyDashboard page component at src/pages/SurveyDashboard.tsx.

Use the existing shadcn components (Card, Button, Badge, DropdownMenu, 
Input, Dialog). Fetch surveys from GET /api/surveys/ using @tanstack/
react-query.

Layout:
- Top bar: "My Surveys" title + "Create Survey" button (opens a Dialog 
  with title + description fields).
- Search input with debounced filtering.
- Grid of Cards (responsive: 1 col mobile, 2 col tablet, 3 col desktop). 
  Each card shows: title, status badge (Draft=gray, Active=green, 
  Paused=yellow, Closed=red), response count, created date, and a 
  DropdownMenu with actions (Edit, Duplicate, Share, Delete).
- Clicking a card navigates to /surveys/:id/edit (the builder).
- Empty state with illustration prompt when no surveys exist.

Use sonner for success/error toasts on create/duplicate/delete actions.
```

### Step 2.2 — Builder Layout Shell

```
Prompt for Codex:

Create the SurveyBuilder page at src/pages/SurveyBuilder.tsx. This is a 
three-panel layout:

- Left sidebar (280px, collapsible): Question type palette. Group the 17 
  types into categories using shadcn Accordion:
  "Basic" — Multiple Choice (Single), Multiple Choice (Multi), Dropdown, 
  Short Text, Long Text, Yes/No.
  "Rating & Scale" — Star Rating, Rating Scale, NPS, Constant Sum.
  "Advanced" — Matrix, Ranking, Image Choice, File Upload, Date/Time, 
  Demographics.
  "Structure" — Section Heading, Instructional Text.
  
  Each item is a draggable element using @dnd-kit. Show an icon (from 
  lucide-react) + label for each type.

- Center canvas (flex-grow): The survey preview area. This is a 
  droppable zone using @dnd-kit/sortable. It renders the list of pages, 
  each containing its questions in order. Clicking a question selects it 
  (highlight border). A floating "Add Page" button sits between pages.

- Right sidebar (320px, collapsible): Context-sensitive settings panel.
  When no question is selected, show survey-level settings (title, 
  description, theme, progress bar toggle, numbering style).
  When a question is selected, show its settings (text, description, 
  required toggle, type-specific options, choices editor, skip logic 
  config).

Use zustand for builder state: selectedQuestionId, pages (with nested 
questions), isDirty flag. Auto-save via debounced PATCH to API every 
3 seconds when isDirty is true.

Top bar of builder: Survey title (editable inline), status badge, 
"Preview" button, "Publish" button, and a back arrow to dashboard.
```

### Step 2.3 — Drag-and-Drop Question Management

```
Prompt for Codex:

Implement the drag-and-drop system for the survey builder canvas:

1. Dragging from the left palette into the canvas creates a new question.
   Use @dnd-kit DragOverlay for a ghost preview while dragging. On drop, 
   POST to /api/surveys/{id}/pages/{page_id}/questions/ with the new 
   question type, default text "Untitled Question", and the correct order 
   based on drop position.

2. Dragging within the canvas reorders questions. Support both intra-page 
   reorder and cross-page moves. On drop, PATCH the order field for 
   affected questions. Use @dnd-kit/sortable with SortableContext per page.

3. Each question card on the canvas shows:
   - Drag handle (GripVertical icon) on the left
   - Question type icon + type label badge
   - Question text (click to edit inline)
   - Required indicator (red asterisk if required)
   - Collapse/expand toggle for answer choices preview
   - Delete button (with confirmation Dialog)
   - Duplicate button

4. Page separators between pages with: page title (editable), drag handle 
   for page reorder, delete page button, and a "+" button to insert a 
   new page.

Make sure all drag-and-drop operations feel smooth with proper transition 
animations (transform, opacity on drag start).
```

### Step 2.4 — Question Settings Panel (Right Sidebar)

```
Prompt for Codex:

Build the question settings panel (right sidebar) as a dynamic form using 
react-hook-form. The panel content changes based on the selected 
question's type.

Create a component QuestionSettingsPanel.tsx that receives the selected 
question and renders:

Common settings (all types):
- Question text (Textarea)
- Description / help text (Textarea, collapsible)
- Required toggle (Switch)
- "Allow comment" toggle (Switch) — adds an optional comment box

Type-specific settings — create a sub-component for each:

MultipleChoiceSettings:
- Choices list with inline edit, reorder (drag), delete, "Add choice" button
- "Add Other option" toggle
- "Randomize choice order" toggle
- For multi-select: min/max selections (number inputs)

RatingSettings (shared by star_rating, rating_scale, nps):
- Scale range (min/max number inputs)
- Step size
- Label for low end and high end
- For star_rating: number of stars (3/5/7/10 select)

MatrixSettings:
- Rows editor (add/remove/reorder row labels)
- Columns editor (add/remove/reorder column labels)
- Type per cell: radio (single per row) or checkbox (multi per row)

ConstantSumSettings:
- Items list editor
- Target sum (number input)
- Display mode: numbers or percentages

DateTimeSettings:
- Date only / Time only / Both (radio group)
- Min and max date

DemographicsSettings:
- Field toggles: Name, Email, Phone, Address, City, State, Zip, Country

RankingSettings:
- Items list editor (add/remove/reorder)

ImageChoiceSettings:
- Choices with image upload + caption
- Grid columns (2/3/4)
- Single or multi select

FileUploadSettings:
- Allowed file types checkboxes (PDF, PNG, JPG, DOC)
- Max file size (MB)

All changes auto-save via the debounced zustand -> API sync.
```

### Step 2.5 — Skip Logic Configuration UI

```
Prompt for Codex:

Add a "Logic" tab to the question settings panel (alongside the existing 
"Settings" tab). This tab lets users configure skip logic for the 
selected question.

The Logic tab UI:
- A toggle "Enable skip logic" (Switch)
- When enabled, show a rule builder. For each answer choice in the 
  question (only for closed-ended types), show a row:
  
  "If respondent selects [Choice Text] → then [Action Dropdown]"
  
  Action Dropdown options:
  - "Continue to next page" (default, no logic needed)
  - "Skip to page: [Page Dropdown]" (list all pages after the current one)
  - "End survey" 
  - "Disqualify (end with custom message)"

- For rating/NPS types, support range-based conditions:
  "If score is [operator] [value] → then [action]"
  Operators: equals, less than, greater than, between

- A "Default" row at the bottom: "For all other answers → [Action]"

Store the logic configuration in the question's skip_logic JSONField as:
[
  {
    "condition": {"choice_id": "uuid"} or {"operator": "gt", "value": 7},
    "action": "skip_to_page" | "end_survey" | "disqualify",
    "target": "page_uuid" (if skip_to_page)
  }
]

Also add page-level skip logic on the page separator component:
- "After this page, always skip to: [Page Dropdown]" 
  (unconditional page skip)
  
Store in page's skip_logic JSONField.
```

### Step 2.6 — Survey Preview Mode

```
Prompt for Codex:

Create a SurveyPreview component that renders the survey exactly as a 
respondent would see it. Trigger it from the "Preview" button in the 
builder top bar. Open it in a dialog/sheet overlay or a new route 
/surveys/:id/preview.

The preview should:
- Render one page at a time with Next/Previous navigation buttons
- Show the welcome page if enabled
- Show a progress bar at the top (percentage based on pages)
- Render each question type with its actual input controls (radio buttons, 
  checkboxes, text inputs, star ratings, sliders, etc.)
- Execute skip logic in real time: when you select an answer that triggers 
  a skip, the Next button should jump to the target page
- Show the thank-you page on completion
- Display a banner "PREVIEW MODE — responses are not saved"
- Include a device toggle (Desktop / Tablet / Mobile) that constrains 
  the preview width to simulate responsive behavior

Reuse the same question renderer components that the public survey-taking 
page will use (build them as shared components in src/components/survey/).
```

---

## Phase 3: Public Survey-Taking Experience

> The respondent-facing interface. Clean, fast, focused.

### Step 3.1 — Public Survey Page

```
Prompt for Codex:

Create the public survey-taking page at route /s/:slug. This page fetches 
the survey by slug from GET /api/surveys/public/:slug/ (no auth required).

Build shared question renderer components in src/components/survey/
renderers/:
- MultipleChoiceSingleRenderer.tsx — radio group using shadcn RadioGroup
- MultipleChoiceMultiRenderer.tsx — checkbox group using shadcn Checkbox
- DropdownRenderer.tsx — shadcn Select component
- ShortTextRenderer.tsx — shadcn Input with validation
- LongTextRenderer.tsx — shadcn Textarea with character count
- YesNoRenderer.tsx — two large buttons (Yes/No) or three if Maybe
- StarRatingRenderer.tsx — clickable star icons with hover preview
- RatingScaleRenderer.tsx — numbered button row with endpoint labels
- NPSRenderer.tsx — 0-10 button row with colored segments
- ConstantSumRenderer.tsx — input fields per item with running total 
  and validation (must equal target sum)
- DateTimeRenderer.tsx — shadcn date picker / time input
- MatrixRenderer.tsx — table with radio or checkbox per cell, mobile-
  responsive flip (stacks rows as cards on small screens)
- RankingRenderer.tsx — @dnd-kit sortable list for drag reorder
- ImageChoiceRenderer.tsx — image grid with selection overlay
- FileUploadRenderer.tsx — file drop zone with type/size validation
- DemographicsRenderer.tsx — structured form fields per enabled field
- SectionHeadingRenderer.tsx — display-only heading text
- InstructionalTextRenderer.tsx — display-only rich text block

Create a QuestionRenderer.tsx wrapper that takes a question object and 
delegates to the correct renderer based on question_type.

The survey page:
- Shows welcome page first if enabled
- Renders one page at a time
- Validates required fields before allowing Next
- Highlights validation errors with red borders and messages
- Processes skip logic on Next button click to determine target page
- Shows progress bar (shadcn Progress component)
- Supports "Save & Continue": stores resume_token in URL, shows a 
  "Save and finish later" link that copies the resume URL
- On final page, show Submit button that POSTs all answers
- Show thank-you page after successful submission
- Apply survey theme (colors, fonts) via CSS variables
```

### Step 3.2 — Save and Continue / Resume

```
Prompt for Codex:

Implement save and continue functionality:

Backend:
- When a response is first created (first page submitted), generate a 
  resume_token and return it in the API response.
- PUT /api/surveys/public/:slug/responses/:resume_token/ saves partial 
  answers and updates current_page and last_active_at.
- GET /api/surveys/public/:slug/responses/:resume_token/ returns the 
  in-progress response with all answers so far, so the frontend can 
  pre-populate fields.

Frontend:
- After the first page submission, append ?resume=TOKEN to the URL.
- On page load, if ?resume param exists, fetch the existing response 
  and restore all answers.
- Show a toast "Your progress has been saved" on each page transition.
- The "Save and finish later" button copies the full resume URL to 
  clipboard with a toast confirmation.
- When the survey is completed, clear the resume param.
```

### Step 3.3 — Response Tracking and Multiple Response Prevention

```
Prompt for Codex:

Implement response controls:

Backend:
- On response submission, store ip_address (from request.META 
  REMOTE_ADDR / HTTP_X_FORWARDED_FOR) and user_agent.
- If collector settings has allow_multiple=False, check for existing 
  completed response from same IP. If found, return 403 with 
  "You have already completed this survey."
- Also set a cookie `questiz_responded_{survey_slug}=true` on completion 
  response. Frontend checks this cookie before loading the survey.
- If collector has response_limit set, check total completed count. 
  If at limit, return a "This survey is no longer accepting responses" 
  message.
- If collector has close_date set and it has passed, return a "closed" 
  message.
- If survey status is not "active", return appropriate message.

Frontend:
- Check the cookie on page load. If set, show "already completed" 
  message instead of the survey.
- Handle all 403/410 status codes with friendly messages.
- On successful submission, set the cookie (30 day expiry).
```

---

## Phase 4: Distribution System

### Step 4.1 — Collector Management

```
Prompt for Codex:

Create a distribution/sharing page at /surveys/:id/distribute. This page 
is tabbed with sections for each collector type.

"Web Link" tab:
- Show the public survey URL: {domain}/s/{slug}
- "Copy Link" button using navigator.clipboard
- Custom slug editor (if available on plan)
- Toggle for password protection (shows password input)
- Response limit input
- Close date picker

"Email" tab:
- Email list textarea (one email per line) with bulk paste support
- Email invitation template preview with survey title and custom message
- "Send Invitations" button that POSTs to /api/surveys/{id}/collectors/
  {collector_id}/send-emails/
- Invitation status table: email, status badge, sent_at, opened_at
- "Send Reminder" button for pending/sent-but-not-completed invitations

"Embed" tab:
- Toggle between iframe embed and popup embed
- Generated code snippet in a code block with "Copy Code" button
- iframe: <iframe src="{url}" width="100%" height="600" frameborder="0">
- popup: JavaScript snippet that opens survey in a modal overlay
- Live preview of the embed below the code

"Social" tab:
- Share buttons using react-share: Facebook, Twitter/X, LinkedIn, Email
- Each button pre-fills the survey URL and a default share message
- Click tracking note: UTM parameters are auto-appended 
  (?utm_source=facebook etc.)

"QR Code" tab:
- QR code rendered using qrcode.react at large size
- Color picker to customize QR foreground color (react-colorful)
- "Download PNG" button using html2canvas to capture the QR element
- "Download SVG" button using the SVG output from qrcode.react
- Print-friendly layout option
```

### Step 4.2 — Email Backend with Celery

```
Prompt for Codex:

Set up Celery with Redis for async email delivery:

1. Configure Celery in the Django project (celery.py, __init__.py).
2. Create surveys/tasks.py with:
   
   - send_survey_invitation(invitation_id): 
     Fetches the EmailInvitation, sends email using Django's send_mail 
     with an HTML template containing: survey title, custom message, 
     personalized link with tracking token, unsubscribe footer. Updates 
     invitation status to "sent" and sent_at.
   
   - send_bulk_invitations(collector_id, emails):
     Creates EmailInvitation records for each email, then dispatches 
     individual send_survey_invitation tasks.
   
   - send_reminder(collector_id):
     Finds all invitations with status "sent" (not opened/completed), 
     re-sends the email with a "Reminder:" subject prefix.

3. Create a tracking pixel endpoint at /api/track/open/:token/ that 
   returns a 1x1 transparent GIF and updates the invitation status to 
   "opened" with opened_at timestamp.

4. On survey completion, if the response has a matching invitation token, 
   update the invitation status to "completed" with completed_at.

Create the email HTML template at surveys/templates/emails/
invitation.html. Use Django template language. Keep it clean and 
responsive (600px table-based layout for email clients).
```

---

## Phase 5: Analytics Engine (Backend)

> This is where the heavy focus on reporting begins. Build all the aggregation
> logic on the backend so the frontend has clean, structured data to visualize.

### Step 5.1 — Aggregation API

```
Prompt for Codex:

Create surveys/services/analytics.py with an AnalyticsService class that 
generates aggregated data for each question type. The service takes a 
survey_id and optional filters (date range, collector_id, completion 
status) and returns structured analytics data.

Methods:

get_summary(survey_id, filters) -> dict:
  Returns: total_responses, completed_count, in_progress_count, 
  completion_rate, average_duration_seconds, responses_over_time 
  (list of {date, count} for daily response volume).

get_question_analytics(question_id, filters) -> dict:
  Based on question type, returns different structures:

  For multiple_choice_single / multiple_choice_multi / dropdown / 
  yes_no / image_choice:
    {
      type: "categorical",
      total_responses: int,
      choices: [
        {choice_id, text, count, percentage, is_other: bool}
      ],
      other_responses: [str] (if allow_other),
      comments: [str] (if allow_comment)
    }

  For star_rating / rating_scale / nps:
    {
      type: "numeric",
      total_responses: int,
      mean: float, median: float, mode: float,
      std_deviation: float, min: float, max: float,
      distribution: [{value, count, percentage}],
      nps_score: int (only for NPS: %promoters - %detractors),
      nps_segments: {promoters: int, passives: int, detractors: int}
    }

  For short_text / long_text:
    {
      type: "text",
      total_responses: int,
      responses: [{text, responded_at}],
      word_frequencies: [{word, count}] (top 100, exclude stop words),
      avg_word_count: float
    }

  For matrix:
    {
      type: "matrix",
      total_responses: int,
      rows: [{row_label, columns: [{col_label, count, percentage}]}],
      row_averages: [{row_label, avg_score}] (if numeric columns)
    }

  For ranking:
    {
      type: "ranking",
      total_responses: int,
      items: [{choice_id, text, avg_rank, rank_distribution: 
        [{rank, count}]}]
    }

  For constant_sum:
    {
      type: "constant_sum",
      total_responses: int,
      items: [{choice_id, text, mean_value, total_value, percentage}]
    }

  For date_time:
    {
      type: "temporal",
      total_responses: int,
      distribution: [{date_bucket, count}] (auto-bucket by day/week/month)
    }

  For demographics:
    {
      type: "demographics",
      fields: {field_name: [{value, count, percentage}]}
    }

  For file_upload:
    {
      type: "files",
      total_responses: int,
      files: [{file_url, file_type, answered_at}]
    }

Use Django ORM aggregation (Count, Avg, StdDev, Min, Max) with 
.values().annotate() for efficient database-level computation. 
For word frequencies, use Python collections.Counter on text_value 
with a stop words list.

Create the API endpoints:
- GET /api/surveys/{id}/analytics/summary/
- GET /api/surveys/{id}/analytics/questions/{question_id}/
- GET /api/surveys/{id}/analytics/questions/ (returns all at once)

All endpoints accept query params: date_from, date_to, collector_id, 
status (completed/in_progress).
```

### Step 5.2 — Cross-Tabulation API

```
Prompt for Codex:

Add a cross-tabulation method to AnalyticsService:

get_cross_tabulation(survey_id, row_question_id, col_question_id, 
  filters) -> dict:

This compares how respondents answered two different questions. Returns:
{
  row_question: {id, text, type},
  col_question: {id, text, type},
  matrix: [
    {
      row_label: str,
      cells: [{col_label: str, count: int, percentage: float}],
      row_total: int
    }
  ],
  col_totals: [{col_label, total}],
  grand_total: int,
  chi_square: {statistic: float, p_value: float, significant: bool}
}

For the chi-square test, use scipy.stats.chi2_contingency on the 
contingency table. Mark significant if p_value < 0.05.

Works with any two categorical questions (multiple choice, dropdown, 
yes/no, NPS segments, rating buckets). For numeric questions, bucket 
them first (e.g., NPS into Detractor/Passive/Promoter, ratings into 
Low/Medium/High).

API endpoint:
GET /api/surveys/{id}/analytics/crosstab/?row={q_id}&col={q_id}
```

### Step 5.3 — Individual Response API

```
Prompt for Codex:

Create endpoints for viewing individual responses:

- GET /api/surveys/{id}/responses/ — paginated list with sorting 
  (by started_at, completed_at, duration). Include basic answer 
  summaries in the list (first 3 answers truncated). Support filtering 
  by: status, collector_id, date range, specific answer to a question 
  (e.g., ?q={question_id}&answer={choice_id} to find everyone who 
  selected a specific choice).

- GET /api/surveys/{id}/responses/{response_id}/ — full detail with 
  all answers, each joined with question text and choice texts for 
  display.

- DELETE /api/surveys/{id}/responses/{response_id}/ — delete a single 
  response (for data cleanup).

- POST /api/surveys/{id}/responses/bulk-delete/ — delete multiple 
  responses by ID list.

Add response count annotation to SurveyListSerializer so the dashboard 
shows counts efficiently.
```

### Step 5.4 — Response Filtering Service

```
Prompt for Codex:

Create surveys/services/filters.py with a ResponseFilterService that 
applies complex filters to the response queryset. This powers both 
the analytics and the individual response views.

Supported filter types:

1. Date range: filter by completed_at between date_from and date_to
2. Collector: filter by collector_id
3. Completion status: completed or in_progress
4. Answer filter: "show responses where question X was answered with 
   choice Y" — supports multiple answer filters combined with AND logic
5. Duration filter: responses that took longer/shorter than N seconds
6. Text search: full-text search across all text_value and other_text 
   answers for a keyword

The service returns a filtered queryset that can be passed to 
AnalyticsService methods. This means all charts and aggregations 
update based on the active filters.

API: All analytics endpoints accept a `filters` query parameter as a 
JSON-encoded string:
?filters={"date_from":"2026-01-01","collector_id":"uuid",
"answer_filters":[{"question_id":"uuid","choice_id":"uuid"}]}
```

---

## Phase 6: Visualization and Reporting Frontend

> The crown jewel. This is where users spend the most time.
> Every design decision here should prioritize flexibility and visual clarity.

### Step 6.1 — Analytics Dashboard Shell

```
Prompt for Codex:

Create the analytics page at /surveys/:id/analyze. This is the main 
reporting interface.

Layout:
- Sticky top bar: Survey title, total responses count, completion rate 
  percentage, average duration. A "Filter" button that opens a 
  FilterDrawer. An "Export" dropdown button with PDF/XLSX/PPTX options.
  A "Share Results" button. A "Save Report" button.

- Filter bar (collapsible): When active, shows a horizontal strip of 
  active filter chips. Each chip has an X to remove. Chips for: date 
  range, collector, status, answer-based filters. "Add Filter" button 
  opens the FilterDrawer with a step-by-step filter builder:
  Step 1: Pick filter type (Date/Collector/Status/Question Answer/Duration)
  Step 2: Configure the filter (date picker, dropdown, question selector)
  Step 3: Apply → chip appears in the filter bar.
  
  All analytics data on the page re-fetches when filters change using 
  @tanstack/react-query with the filters as query key dependencies.

- Main content: Scrollable list of QuestionAnalyticsCard components, 
  one per question (excluding structural elements). Each card is a 
  self-contained visualization unit.

- Side panel toggle: "Cross-Tab" button opens a side panel for cross-
  tabulation analysis (select two questions, see the matrix).

Fetch data from GET /api/surveys/{id}/analytics/questions/ with active 
filters. Show a loading skeleton (shadcn Skeleton) while fetching.
```

### Step 6.2 — Question Analytics Card Component

```
Prompt for Codex:

Build QuestionAnalyticsCard.tsx — the core visualization component. Each 
card displays analytics for one question with full chart customization.

Card structure:
- Header: Question text, question type badge, response count ("N=142")
- Chart area: The primary visualization (auto-selected based on type, 
  user can override)
- Data table: Toggleable table below the chart showing raw numbers
- Toolbar (horizontal, below header):
  - Chart type switcher: icon buttons to toggle between applicable chart 
    types for this question. Highlight the active one. Use the mapping:

    categorical questions → Bar (default), Pie, Donut, Horizontal Bar
    numeric/rating → Bar (default), Line, Area, Gauge (for NPS)
    text → Word Cloud (default), Response List
    matrix → Heatmap (default), Stacked Bar, Grouped Bar
    ranking → Horizontal Bar (default), Table
    constant_sum → Stacked Bar (default), Pie, Bar
    date → Line (default), Bar (histogram)

  - "Show Table" toggle (shows/hides the data table beneath the chart)
  - "Show Labels" toggle (shows/hides value labels on the chart)
  - Color scheme dropdown: 6 preset palettes (Default Blue, Warm, Cool, 
    Monochrome, Pastel, Vibrant) — changes the chart colors
  - "⋮" more menu: Download as PNG, Full screen view

- Data table (when visible): Using @tanstack/react-table with columns 
  for label, count, percentage. Sortable by any column. For numeric 
  questions, add columns for mean, median, std dev.

Each card should maintain its own local state for chart type selection,
table visibility, and color scheme. These preferences are stored in 
the SavedReport config when the user clicks "Save Report".
```

### Step 6.3 — Recharts Implementations

```
Prompt for Codex:

Create chart wrapper components in src/components/charts/ that 
standardize Recharts usage with shadcn theme integration:

QBarChart.tsx:
- Wraps Recharts BarChart with ResponsiveContainer
- Props: data (array), dataKey, nameKey, colors (array), showLabels, 
  orientation (vertical/horizontal), stacked (boolean)
- Uses CSS variable colors from shadcn theme: 
  hsl(var(--primary)), hsl(var(--chart-1)) through hsl(var(--chart-5))
- Animated entry with Recharts' default animation
- Tooltip with shadcn-styled card (custom Tooltip content component)
- For horizontal: use Recharts BarChart with layout="vertical"

QPieChart.tsx:
- Wraps Recharts PieChart with ResponsiveContainer
- Props: data, dataKey, nameKey, colors, donut (boolean), showLabels
- Donut mode: set innerRadius to 60%
- Center label for donut showing total or key metric
- Custom legend at the bottom with colored dots

QLineChart.tsx:
- Wraps Recharts LineChart with ResponsiveContainer
- Props: data, lines (array of {dataKey, color, name}), showDots, 
  curved (boolean), showArea (boolean)
- Supports multi-line for trend comparison
- Area fill with gradient when showArea=true

QGaugeChart.tsx:
- Custom semi-circle gauge for NPS score display
- Use Recharts PieChart with startAngle=180, endAngle=0
- Three segments: red (0-6 detractors), yellow (7-8 passives), 
  green (9-10 promoters)
- Center text showing NPS score with +/- prefix

QFunnelChart.tsx:
- Wraps Recharts FunnelChart for response funnel visualization
- Props: data (array of {name, value, fill})

QRadarChart.tsx:
- Wraps Recharts RadarChart for multi-dimensional ratings
- Props: data, metrics (array of {dataKey, name})
- Useful for comparing multiple rating questions at once

All chart components should:
- Accept a `colorScheme` prop that maps to predefined color arrays
- Be wrapped in ResponsiveContainer with width="100%" height={300}
- Use consistent tooltip styling (shadcn Card with shadow)
- Support an `onDownload` callback that triggers html2canvas capture
- Have smooth animation on mount and data change
```

### Step 6.4 — Nivo Advanced Visualizations

```
Prompt for Codex:

Create advanced chart components using Nivo for visualizations that 
Recharts does not handle well:

QHeatmap.tsx:
- Uses @nivo/heatmap (HeatMap component)
- Props: data (rows x cols matrix), xLabels, yLabels, colorScheme
- For matrix question analysis: rows are question items, columns are 
  scale points, cell color intensity = response count
- Tooltip shows: "Row Label × Column Label: N responses (X%)"
- Theme integration: pass nivo theme object that reads shadcn CSS vars

QWaffleChart.tsx:
- Uses @nivo/waffle (Waffle component)
- Props: data (array of {id, label, value, color}), total
- Alternative to pie chart for proportional data — better when there 
  are many small segments
- Each cell in the 10x10 grid represents 1% of total
- Great for yes/no or NPS segment display

QTreemap.tsx:
- Uses @nivo/treemap (Treemap component)
- Props: data (hierarchical {name, children: [{name, value}]})
- For demographic breakdowns and multi-level categorical analysis
- Color by category, size by response count

All Nivo components should:
- Use a shared nivo theme object (create src/lib/nivo-theme.ts) that 
  maps shadcn CSS variable colors to Nivo's theme format
- Be wrapped in a div with fixed height for consistent layout
- Support the same colorScheme prop as Recharts components
```

### Step 6.5 — Word Cloud Component

```
Prompt for Codex:

Create QWordCloud.tsx using react-d3-cloud:

Props: words (array of {text, value}), maxWords (default 80), 
colorScheme, onWordClick (callback)

Configuration:
- Font size scale: d3 scaleLinear mapping word frequency to font size 
  range (14px to 72px)
- Rotation: random choice between 0° and 90° (weighted toward 0°)
- Font: inherit from shadcn theme (font-sans)
- Colors: cycle through the active color scheme palette
- Padding: 3px between words

Interaction:
- Hover on a word: show tooltip with exact count
- Click on a word: trigger onWordClick which filters the response list 
  to show only responses containing that word

The word cloud renders in a fixed 100% width container with 350px 
height. Include a "min frequency" slider below the cloud that filters 
out low-frequency words (controlled via a shadcn Slider component).
```

### Step 6.6 — Cross-Tabulation View

```
Prompt for Codex:

Build a CrossTabPanel.tsx component that renders as a side sheet or 
full-width section on the analytics page.

UI:
- Two dropdown selects: "Row Question" and "Column Question", each 
  listing all categorical questions in the survey
- Once both are selected, fetch data from the crosstab API endpoint
- Render results as:

  1. A styled data table (@tanstack/react-table) with:
     - Row headers = answers to row question
     - Column headers = answers to column question
     - Cell values showing count and percentage (toggle between them)
     - Row totals and column totals
     - Conditional cell coloring: heatmap-style background where darker 
       = higher percentage (use a blue gradient)
     - Footer row showing chi-square statistic, p-value, and a 
       significance badge (green "Significant" if p < 0.05, gray 
       "Not significant" otherwise)

  2. A visualization toggle to switch between:
     - Table view (default)
     - Stacked bar chart (using QBarChart with stacked=true)
     - Heatmap (using QHeatmap)

- "Add to Report" button that saves this cross-tab configuration to 
  the current saved report.
```

### Step 6.7 — Individual Response Browser

```
Prompt for Codex:

Create a ResponseBrowser.tsx page/tab at /surveys/:id/analyze/responses 
(or as a tab alongside the summary analytics).

Layout:
- Left panel (list): Paginated list of responses using 
  @tanstack/react-table with columns: #, Status badge, Date, Duration, 
  Collector, Email (if tracked). Sortable by any column. Search bar 
  for filtering by email or text content.

- Right panel (detail): When a response is selected from the list, show 
  the full response detail:
  - Header: Response ID, timestamp, duration, IP, collector name, status
  - Question-answer pairs rendered vertically:
    For each question (in survey order), show:
    - Question text in muted/bold style
    - Answer rendered appropriately:
      * Choice questions: selected choice(s) highlighted in a chip/badge
      * Text: the text content
      * Rating/NPS: star display or number with a colored indicator
      * Matrix: mini table of selections
      * Ranking: numbered list
      * File: link to download
    - "Other" text and comments shown beneath if present
  
  - Footer: "Delete Response" button (with confirmation dialog)

- Bulk actions: Checkboxes on the list for selecting multiple responses.
  Bulk action bar appears at top: "Delete Selected (N)" button.

Response detail should be printable: include a "Print" button that opens 
window.print() with a print-optimized CSS stylesheet.
```

### Step 6.8 — Summary Statistics Header

```
Prompt for Codex:

Create an AnalyticsSummaryBar.tsx that renders at the top of the 
analytics page. This is a horizontal row of key metrics.

Fetch data from GET /api/surveys/{id}/analytics/summary/.

Display these metrics as stat cards (shadcn Card, compact):
1. Total Responses — large number with a trend sparkline (last 14 days 
   using Recharts LineChart, tiny, 80px wide, no axis)
2. Completion Rate — percentage with a mini circular progress indicator 
   (use a tiny Recharts RadialBarChart or CSS ring)
3. Average Duration — formatted as "Xm Ys" 
4. Responses Today — number with comparison to yesterday (green arrow 
   up or red arrow down)
5. Drop-off Rate — percentage of started but not completed responses

Make the sparkline and mini charts respond to the global date filter. 
When filters are active, show a subtle "(filtered)" label next to the 
total to indicate partial data.
```

---

## Phase 7: Report Export Engine

> Backend services that generate downloadable PDF, XLSX, and PPTX files.
> All exports run asynchronously via Celery.

### Step 7.1 — Export Job Flow

```
Prompt for Codex:

Create the export workflow:

1. Frontend: User clicks an export option (PDF/XLSX/PPTX) from the 
   export dropdown on the analytics page. This POSTs to 
   /api/surveys/{id}/exports/ with:
   {
     "format": "pdf",
     "config": {
       "filters": { current active filters },
       "question_ids": [ list of questions to include, or null for all ],
       "chart_types": { question_id: "bar"|"pie"|etc, overrides },
       "report_id": "uuid" (if exporting a saved report),
       "include_cross_tabs": [{ row_q_id, col_q_id }],
       "include_individual_responses": false,
       "branding": { logo_url, company_name, color }
     }
   }

2. Backend: The view creates an ExportJob record (status=pending), 
   dispatches a Celery task, and returns the job ID immediately.

3. Frontend: Polls GET /api/surveys/{id}/exports/{job_id}/ every 
   2 seconds. Shows a progress indicator (shadcn Progress in a toast).
   When status=completed, triggers download from file_url.
   When status=failed, shows error message.

4. Celery task: Calls the appropriate generator (PDF/XLSX/PPTX), 
   uploads the file to storage, updates the ExportJob with file_url 
   and status=completed.

Create surveys/tasks/export_tasks.py with:
- generate_pdf_report(export_job_id)
- generate_xlsx_report(export_job_id)
- generate_pptx_report(export_job_id)

Each task loads the ExportJob, fetches analytics data using 
AnalyticsService (with filters from config), and generates the file.
```

### Step 7.2 — PDF Export with WeasyPrint

```
Prompt for Codex:

Create surveys/services/exports/pdf_export.py:

class PDFExportService:
    def generate(self, survey, analytics_data, config) -> bytes:

This service:
1. Renders an HTML template (surveys/templates/exports/report.html) with 
   the analytics data using Django's template engine.
2. Converts the HTML to PDF using WeasyPrint.

The HTML template should produce a professional report:
- Cover page: Survey title, description, date range, total responses, 
  generated date, company logo if provided in branding config.
- Executive summary: Key metrics in a 2x2 grid (total responses, 
  completion rate, avg duration, date range).
- For each question:
  - Question text as heading
  - Data table with response counts and percentages
  - Chart rendered as an SVG embedded in the HTML. Since WeasyPrint 
    renders HTML/CSS, generate SVGs on the backend using a Python SVG 
    library. Use a simple approach:
    * For bar charts: generate horizontal bars using HTML div elements 
      with width percentages and background colors (CSS-based charts 
      that WeasyPrint renders perfectly)
    * For pie charts: use SVG path elements (or inline SVG)
    * This avoids needing a headless browser for chart rendering
- Cross-tabulation tables if included in config
- Footer with page numbers

Create a CSS file at surveys/static/exports/report.css with print-
optimized styles: A4 page size, proper margins, page break management 
(avoid breaking inside a question block), professional typography.
```

### Step 7.3 — Excel Export with openpyxl

```
Prompt for Codex:

Create surveys/services/exports/xlsx_export.py:

class XLSXExportService:
    def generate(self, survey, analytics_data, config) -> bytes:

Generate a multi-sheet workbook:

Sheet 1 "Summary":
- Survey metadata (title, date range, total responses)
- Key metrics table
- For each question: a formatted data table with:
  - Merged cell header with question text (bold, colored background)
  - Column headers: Option, Count, Percentage
  - Data rows with right-aligned numbers
  - Percentage formatted as "XX.X%"
  - Conditional formatting: data bars in the Count column using 
    openpyxl.formatting.rule.DataBarRule
  - Auto-column-width fitting

Sheet 2 "Raw Responses":
- One row per response, one column per question
- Header row with question text (frozen pane)
- Cell values: selected choice text(s), numeric values, or text
- Date formatting for date columns
- Auto-filter enabled on the header row

Sheet 3+ "Cross Tabs" (if included):
- One sheet per cross-tabulation
- Full matrix with row/column totals
- Conditional formatting: color scale (green to red) on cell values
- Chi-square results row at the bottom

Styling:
- Use a consistent color scheme: header rows with survey brand color 
  (or default blue), alternating row shading, borders on data cells
- Number formatting: integers for counts, one decimal for percentages
- Sheet tab colors matching the section type
```

### Step 7.4 — PowerPoint Export with python-pptx

```
Prompt for Codex:

Create surveys/services/exports/pptx_export.py:

class PPTXExportService:
    def generate(self, survey, analytics_data, config) -> bytes:

Generate a presentation:

Slide 1 — Title slide:
- Survey title (large, centered)
- Subtitle: date range, total responses
- Company logo if provided (positioned top-right)

Slide 2 — Executive Summary:
- 4 large metric boxes: Total Responses, Completion Rate, Avg Duration, 
  Response Period
- Use python-pptx shapes (rounded rectangles) with colored fills

Slides 3+ — One slide per question:
- Title: Question text
- Left side (60% width): Chart generated using python-pptx's chart 
  module:
  * For categorical: BarChart or PieChart (python-pptx has native 
    chart support via add_chart)
  * For numeric: BarChart showing distribution
  * For text questions: simple table of top responses
  * Apply the survey brand color to chart series
- Right side (40% width): Key stats text box:
  * Total responses to this question
  * Top answer with percentage
  * For ratings: mean score displayed large

Cross-tab slides (if included):
- Title: "Cross-tabulation: Q1 × Q2"
- Full table with percentage coloring

Final slide:
- "Thank you" or "Generated by Questiz" with date

Use a consistent slide master: white background, thin colored bar at 
the bottom of each slide, page numbers in footer.
```

---

## Phase 8: Saved Reports and Custom Dashboards

### Step 8.1 — Save and Load Reports

```
Prompt for Codex:

Implement the saved reports system:

Backend:
- SavedReport model already exists. Add endpoints:
  - POST /api/surveys/{id}/reports/ — save current analytics config
  - GET /api/surveys/{id}/reports/ — list saved reports
  - GET /api/surveys/{id}/reports/{report_id}/ — load a report config
  - PUT /api/surveys/{id}/reports/{report_id}/ — update
  - DELETE /api/surveys/{id}/reports/{report_id}/ — delete

The config JSONField stores:
{
  "filters": { active filters },
  "question_ids": [ which questions to show, null = all ],
  "chart_overrides": {
    "question_uuid": { 
      "chart_type": "pie", 
      "color_scheme": "warm",
      "show_table": true,
      "show_labels": false 
    }
  },
  "cross_tabs": [
    {"row_question_id": "uuid", "col_question_id": "uuid"}
  ],
  "layout": "summary"
}

Frontend:
- "Save Report" button on analytics page opens a dialog:
  Name input, save button. Saves the current state of all 
  QuestionAnalyticsCard preferences (chart types, color schemes, 
  visibility) plus active filters.
- "Load Report" dropdown next to it: lists saved reports, clicking one 
  applies all the stored config to the analytics page.
- "Share Report" toggle on a saved report: generates a public URL 
  /reports/:report_uuid that shows a read-only analytics view. 
  Optional password protection.
```

### Step 8.2 — Shared Report Public View

```
Prompt for Codex:

Create a public report view page at /reports/:uuid (no auth required).

This page:
- Fetches the SavedReport by UUID (if is_shared=true)
- If share_password is set, show a password input first
- Renders the analytics dashboard in read-only mode:
  - Same QuestionAnalyticsCard components but without the chart type 
    switcher or customization options
  - Applied filters shown as read-only chips
  - Cross-tabulation views if included
  - No export or edit buttons
  - Survey title and "Powered by Questiz" footer
  
- Responsive: works on mobile for quick sharing via link

The analytics data is fetched from a public API endpoint:
GET /api/reports/:uuid/data/ (no auth, validates share password 
via query param or session)
```

---

## Phase 9: Survey Theming and Branding

### Step 9.1 — Theme Editor

```
Prompt for Codex:

Create a theme editor panel accessible from the survey builder's 
right sidebar (under a "Design" tab).

Theme configuration stored in survey.theme JSONField:
{
  "primary_color": "#1a56db",
  "background_color": "#ffffff",
  "text_color": "#1e293b",
  "font_family": "Inter" | "Roboto" | "Open Sans" | "Lato" | "Merriweather",
  "button_style": "rounded" | "square" | "pill",
  "progress_bar_color": "#1a56db",
  "logo_url": null | "url",
  "logo_position": "left" | "center" | "right",
  "background_image_url": null | "url",
  "question_spacing": "compact" | "comfortable" | "spacious"
}

Theme editor UI:
- Color pickers (react-colorful) for: primary, background, text
- Font family dropdown (5 Google Fonts preloaded)
- Button style radio group with visual previews
- Logo upload with position selector
- Background image upload with opacity slider
- Spacing radio group
- 6 preset themes as clickable thumbnail cards: "Default", "Corporate",
  "Minimal", "Warm", "Dark", "Playful"
- Live preview: the center canvas updates in real time as theme changes

The public survey page reads the theme and applies it via CSS custom 
properties injected into a <style> tag at the page root.
```

---

## Phase 10: Polish, Testing, and Performance

### Step 10.1 — API Performance Optimization

```
Prompt for Codex:

Optimize the analytics queries for large response sets:

1. Add database indexes:
   - Answer: composite index on (question_id, response_id)
   - Answer: index on choice_ids using GIN (for JSONB array containment)
   - SurveyResponse: composite index on (survey_id, status, completed_at)

2. Create a materialized view or caching layer for analytics:
   - Use Django's cache framework with Redis
   - Cache analytics results with key: 
     f"analytics:{survey_id}:{question_id}:{filter_hash}"
   - TTL: 60 seconds (short, because data changes with new responses)
   - Invalidate cache on new response submission via a post_save signal

3. For surveys with >10,000 responses, switch to database-level 
   aggregation exclusively (no Python-level processing). Make sure all 
   AnalyticsService methods use .values().annotate() patterns.

4. Add pagination to the individual response list API (default 50 per 
   page) using DRF's CursorPagination (more efficient than offset for 
   large datasets).

5. Add select_related and prefetch_related to all querysets that access 
   related models (survey -> pages -> questions -> choices in a single 
   query chain).
```

### Step 10.2 — Frontend Performance

```
Prompt for Codex:

Optimize the frontend for analytics pages with many questions:

1. Lazy-load chart components: Use React.lazy + Suspense for each chart 
   type. Only load the Nivo bundle if the survey has matrix questions.

2. Virtualize the question analytics list: If a survey has >20 questions, 
   use react-window or @tanstack/virtual to only render visible cards.

3. Implement skeleton loading: Each QuestionAnalyticsCard shows a 
   shimmer skeleton (shadcn Skeleton) while its data loads. Load cards 
   independently so faster queries render first.

4. Debounce filter changes: When users change filters, debounce the 
   API re-fetch by 300ms to avoid rapid-fire requests during interaction.

5. Memoize chart rendering: Wrap chart components in React.memo with 
   custom comparison functions that check data array length and content 
   hash, not reference equality.

6. Prefetch analytics on survey navigation: When user navigates to the 
   analytics page, prefetch summary data and the first 5 question 
   analytics in parallel using react-query's prefetchQuery.
```

### Step 10.3 — End-to-End Testing

```
Prompt for Codex:

Write comprehensive tests:

Backend (pytest-django):
- test_analytics_service.py: 
  Create a survey with one of each question type, submit 50 fake 
  responses using factory_boy, then verify each analytics method 
  returns correct aggregations. Test that filters correctly narrow 
  results.

- test_cross_tabulation.py:
  Create two multiple-choice questions, submit responses with known 
  distributions, verify the cross-tab matrix is correct and chi-square 
  is calculated.

- test_export_pdf.py:
  Trigger PDF export, verify the returned bytes are a valid PDF 
  (check first bytes for %PDF header), verify it is non-empty.

- test_export_xlsx.py:
  Trigger Excel export, load the bytes with openpyxl, verify sheet 
  names, row counts, and data values match expected aggregations.

- test_skip_logic.py:
  Create a survey with skip logic, simulate a response submission 
  path, verify that skipped questions are not required in validation.

Frontend (Vitest + Testing Library):
- QuestionAnalyticsCard.test.tsx: 
  Render with mock categorical data, verify bar chart renders, toggle 
  to pie chart, verify pie chart renders, toggle show table, verify 
  table appears with correct values.

- FilterDrawer.test.tsx:
  Open drawer, add a date filter, verify filter chip appears, verify 
  react-query refetches with updated params.

- SurveyBuilder.test.tsx:
  Render builder, drag a question type from palette to canvas, verify 
  question card appears. Select it, verify settings panel shows. 
  Edit question text, verify debounced save triggers API call.
```

---

## Phase Execution Order (Summary)

For Codex, execute the phases in this order. Each phase is a 
self-contained milestone you can test before moving to the next.

```
Phase 1  →  Models, migrations, CRUD API, tests
             (1-2 days, foundation everything builds on)

Phase 2  →  Survey builder frontend (builder UI, dnd, settings, logic)
             (3-4 days, most complex frontend piece)

Phase 3  →  Public survey-taking experience (respondent page, renderers)
             (2-3 days, reuses components from Phase 2 preview)

Phase 4  →  Distribution system (collectors, email, QR, embed, social)
             (1-2 days, backend-heavy with Celery setup)

Phase 5  →  Analytics engine backend (aggregation, cross-tab, filters)
             (2-3 days, critical for Phase 6)

Phase 6  →  Visualization frontend (charts, word clouds, dashboard)
             (3-4 days, heaviest frontend work, the product's showcase)

Phase 7  →  Export engine (PDF, XLSX, PPTX via Celery)
             (2-3 days, backend-heavy)

Phase 8  →  Saved reports and sharing
             (1-2 days, builds on Phase 6 + 7)

Phase 9  →  Theming and branding
             (1 day)

Phase 10 →  Performance optimization and testing
             (2-3 days, ongoing throughout but dedicated sprint at end)
```

Total estimated: 18-27 working days for a solo developer using Codex.

---

## Key Conventions for Codex Prompts

When using Codex on this project, include these instructions at 
the start of your session:

```
Project context:
- Django 5.x backend with DRF at /backend
- React 18+ with TypeScript and shadcn/ui at /frontend
- PostgreSQL database
- All model PKs are UUIDField
- API prefix: /api/
- Use @tanstack/react-query for all data fetching
- Use react-hook-form + zod for all forms
- Use zustand for builder canvas state only
- Charts: recharts (primary), @nivo (heatmap/waffle/treemap), 
  react-d3-cloud (word clouds)
- Follow existing code patterns in the boilerplate
- Write type-safe code: no `any` types in TypeScript
- All API responses should follow: {data: T} for success, 
  {error: string, detail: string} for errors
```

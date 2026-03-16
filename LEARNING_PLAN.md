# Questiz Full-Stack Learning Plan
## From C/C++ to Django + React in the Age of AI

> **Your starting point:** C/C++ fundamentals, OOP, relational databases
> **Target:** Understand and contribute to a real Django + React + PostgreSQL application
> **AI-era approach:** Learn enough to *direct* AI tools, read code confidently, and debug intelligently

---

## How to Use This Plan

Read each section top to bottom. Every concept is explained in terms of what you already know from C/C++. Code examples come directly from *this project's actual files*, not made-up examples.

Use AI (Claude Code) to:
- Generate boilerplate once you understand the concept
- Explain error messages
- Suggest implementations you then *review and understand*

---

## Part 1: Python — The Language Beneath Django

### 1.1 Python vs C/C++ Mental Model

| C/C++ concept | Python equivalent | Key difference |
|---|---|---|
| `int x = 5;` | `x = 5` | No type declaration, no semicolon |
| `void foo() {}` | `def foo():` | `def` keyword, colon, indentation |
| `#include <stdio.h>` | `import os` | Same idea, cleaner syntax |
| `struct Point { int x; int y; };` | `class Point:` with `self.x, self.y` | Classes replace structs |
| `nullptr` | `None` | Same concept |
| `true / false` | `True / False` | Capital letters |
| `//` comment | `#` comment | Different character |
| `/* multi-line */` | `"""multi-line"""` | Triple quotes |
| Curly braces `{}` for blocks | **Indentation** for blocks | This is the #1 gotcha |

**The single most important Python rule:** Indentation IS the code structure. There are no `{}` braces for blocks. Get this wrong and nothing works.

```python
# C/C++:
# if (x > 0) {
#     printf("positive");
# }

# Python:
if x > 0:
    print("positive")   # 4 spaces indent = inside the if
# back to 0 indent = outside the if
```

### 1.2 Python Data Types You'll See Constantly

```python
# String
name = "Questiz"

# Integer
count = 42

# Float
rate = 0.85

# Boolean
is_active = True

# List (like a dynamic array in C++)
question_types = ["multiple_choice", "short_text", "rating"]
question_types[0]          # "multiple_choice"
question_types.append("nps")  # add to end

# Dictionary (like a hash map / struct hybrid)
survey = {
    "title": "Customer Feedback",
    "status": "active",
    "response_count": 142
}
survey["title"]            # "Customer Feedback"
survey["status"] = "closed"  # update a value

# None (like nullptr)
email = None
```

### 1.3 Functions

```python
# Basic function
def greet(name):
    return f"Hello, {name}"

# Function with default argument
def create_question(text, required=False):
    return {"text": text, "required": required}

# The f-string is like printf but cleaner
survey_id = "abc123"
url = f"/api/surveys/{survey_id}/"  # "/api/surveys/abc123/"
```

### 1.4 Classes (OOP — You Know This)

Python classes work like C++ classes but with `self` instead of `this`, and you must always explicitly pass `self`.

```python
# C++ equivalent:
# class Survey {
#   string title;
#   Survey(string t) { title = t; }
#   string getTitle() { return title; }
# };

class Survey:
    def __init__(self, title):    # Constructor = __init__
        self.title = title        # self = this in C++

    def get_title(self):          # All methods take self as first arg
        return self.title

# Usage
s = Survey("Customer Feedback")  # No 'new' keyword
print(s.get_title())              # "Customer Feedback"
```

### 1.5 Inheritance (You Know This From C++)

```python
class Animal:
    def speak(self):
        return "..."

class Dog(Animal):           # Inherits from Animal
    def speak(self):
        return "Woof"        # Override parent method

# Django uses this EVERYWHERE
# Every Django model inherits from models.Model
# Every DRF view inherits from APIView or ViewSet
```

### 1.6 Loops and Iteration

```python
# For loop over a list (no index by default)
for question_type in ["multiple_choice", "short_text"]:
    print(question_type)

# With index (like C's for i = 0; i < n; i++)
for i, question_type in enumerate(["multiple_choice", "short_text"]):
    print(i, question_type)   # 0 multiple_choice, 1 short_text

# Dictionary iteration
survey = {"title": "Survey 1", "status": "active"}
for key, value in survey.items():
    print(key, value)
```

### 1.7 List Comprehensions (Python's Superpower)

```python
# Traditional loop:
squares = []
for n in range(5):
    squares.append(n * n)

# List comprehension (same thing, one line):
squares = [n * n for n in range(5)]  # [0, 1, 4, 9, 16]

# With filter:
active_surveys = [s for s in surveys if s["status"] == "active"]
```

### 1.8 Imports

```python
# Import a whole module
import json

# Import specific things from a module
from datetime import datetime
from django.db import models

# Import with alias
import numpy as np
```

---

## Part 2: Django — The Backend Framework

### 2.1 What Django Is (And Isn't)

Django is a **web framework** — it handles the machinery of receiving HTTP requests and sending HTTP responses so you don't have to build that from scratch.

**Without Django, a web server in C would require you to:**
- Open a TCP socket
- Parse raw HTTP text
- Route to the right handler
- Serialize your data to JSON
- Send it back with correct headers

**Django handles ALL of that.** You just write the business logic.

```
Browser/React     →   HTTP Request   →   Django   →   Database
Browser/React     ←   HTTP Response  ←   Django   ←   Database
```

### 2.2 The Django Project Structure

```
backend/
├── questizsurvey/         ← PROJECT (global config)
│   ├── settings.py        ← All configuration lives here
│   ├── urls.py            ← The master URL router
│   └── wsgi.py            ← Production server entry point
│
├── surveys/               ← APP (one feature domain)
│   ├── models/            ← Database table definitions
│   ├── views/             ← Request handlers (your logic)
│   ├── serializers/       ← JSON conversion
│   ├── urls.py            ← URL routes for this app
│   └── migrations/        ← Database change history
│
├── accounts/              ← APP (users & auth)
├── subscriptions/         ← APP (billing)
└── manage.py              ← CLI tool to run commands
```

**Key concept:** A Django **project** contains multiple **apps**. Each app is a self-contained feature module. This project has `surveys`, `accounts`, and `subscriptions` apps.

### 2.3 Django Models — Your Database Tables

A Django **Model** is a Python class that maps directly to a database table. This replaces writing `CREATE TABLE` SQL.

Look at the actual Survey model in this project:

```python
# backend/surveys/models/survey.py

from django.db import models
import uuid

class Survey(models.Model):
    # UUIDField = a unique ID column (like a UUID primary key in SQL)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ForeignKey = a relationship to another table (like SQL REFERENCES)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,  # the User table
        on_delete=models.CASCADE,  # if user deleted, delete surveys too
        related_name='surveys'
    )

    title = models.CharField(max_length=255)         # VARCHAR(255)
    description = models.TextField(blank=True)       # TEXT, can be empty
    slug = models.CharField(max_length=100, unique=True)  # unique string

    # CharField with choices = like an ENUM
    status = models.CharField(
        max_length=20,
        choices=[
            ('draft', 'Draft'),
            ('active', 'Active'),
            ('paused', 'Paused'),
            ('closed', 'Closed'),
        ],
        default='draft'
    )

    theme = models.JSONField(default=dict)     # JSON column in PostgreSQL
    created_at = models.DateTimeField(auto_now_add=True)  # set on create
    updated_at = models.DateTimeField(auto_now=True)       # set on every save

    class Meta:
        ordering = ['-created_at']  # newest first by default
```

**The Django ORM (Object Relational Mapper) lets you query the database with Python:**

```python
# SQL: SELECT * FROM surveys WHERE user_id = 5
surveys = Survey.objects.filter(user=request.user)

# SQL: SELECT * FROM surveys WHERE id = 'abc-123'
survey = Survey.objects.get(id='abc-123')

# SQL: INSERT INTO surveys (title, user_id) VALUES (...)
survey = Survey.objects.create(title="New Survey", user=request.user)

# SQL: UPDATE surveys SET status = 'active' WHERE id = ...
survey.status = 'active'
survey.save()

# SQL: DELETE FROM surveys WHERE id = ...
survey.delete()

# SQL: SELECT COUNT(*) FROM surveys WHERE status = 'active'
count = Survey.objects.filter(status='active').count()
```

This is the ORM. You **never write raw SQL** in Django (usually). The ORM generates it for you.

### 2.4 Migrations — Tracking Database Changes

When you change a model (add a field, rename a column), you create a **migration** — a Python file that describes what SQL to run to update the database schema.

```bash
# Step 1: Tell Django you changed models — generates migration file
python manage.py makemigrations

# Step 2: Actually run the SQL against the database
python manage.py migrate
```

This is like version control for your database schema. The `migrations/` folder in each app contains these files.

**You never edit migrations manually.** Django generates them.

### 2.5 Django REST Framework (DRF) — Building APIs

Django REST Framework (DRF) is an extension that makes it easy to build JSON APIs. Your React frontend talks to these APIs.

**The 3 core concepts of DRF:**

#### Serializers — Convert Model Objects ↔ JSON

```python
# backend/surveys/serializers/survey_serializers.py

from rest_framework import serializers
from surveys.models import Survey

class SurveyListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Survey
        fields = ['id', 'title', 'status', 'created_at']

# This handles:
# Python object  →  JSON  (when sending to React)
# JSON  →  Python object  (when receiving from React)
```

#### Views — Handle Requests

```python
# backend/surveys/views/survey_views.py

from rest_framework import viewsets, permissions

class SurveyViewSet(viewsets.ModelViewSet):
    serializer_class = SurveySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Only return the logged-in user's surveys
        return Survey.objects.filter(user=self.request.user)
```

`ModelViewSet` is magic — it **automatically** gives you:
- `GET /api/surveys/` → list all surveys
- `POST /api/surveys/` → create a survey
- `GET /api/surveys/{id}/` → get one survey
- `PUT /api/surveys/{id}/` → update a survey
- `DELETE /api/surveys/{id}/` → delete a survey

You get all 5 actions by inheriting from `ModelViewSet`.

#### URLs — Wire Endpoints to Views

```python
# backend/surveys/urls.py

from rest_framework.routers import DefaultRouter
from surveys.views.survey_views import SurveyViewSet

router = DefaultRouter()
router.register(r'surveys', SurveyViewSet, basename='survey')
urlpatterns = router.urls

# This auto-generates ALL the URL patterns from the ViewSet
```

### 2.6 Request/Response Lifecycle

Here's the full journey of a request from React to database and back:

```
React: fetch('/api/surveys/')
         ↓
questizsurvey/urls.py  →  routes to surveys/urls.py
         ↓
surveys/urls.py  →  routes to SurveyViewSet.list()
         ↓
SurveyViewSet.list()  →  calls get_queryset()
         ↓
get_queryset()  →  Survey.objects.filter(user=request.user)
         ↓
ORM  →  generates SQL  →  hits PostgreSQL
         ↓
PostgreSQL  →  returns rows
         ↓
SurveyListSerializer  →  converts Python objects to JSON
         ↓
DRF  →  wraps in HTTP 200 response
         ↓
React receives JSON: [{"id": "...", "title": "...", ...}]
```

### 2.7 Authentication — JWT Tokens

This project uses **JWT (JSON Web Tokens)** for authentication. Here's how it works:

1. User logs in → sends `{email, password}` to `/api/auth/login/`
2. Django verifies password → returns a **token** (a long random string)
3. React stores the token (in memory/localStorage)
4. Every future request includes `Authorization: Bearer <token>` in the HTTP header
5. Django reads the token, looks up the user, sets `request.user`

You don't write this logic — it's handled by `djangorestframework-simplejwt` library.

```python
# In any view, you can trust request.user is the logged-in user:
class SurveyViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return Survey.objects.filter(user=self.request.user)
```

### 2.8 Settings.py — The Brain of Django

`backend/questizsurvey/settings.py` configures everything:

```python
# Database connection
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'questizsurvey',
        'USER': 'postgres',
        'PASSWORD': '...',
        'HOST': 'localhost',
    }
}

# Which apps are installed
INSTALLED_APPS = [
    'django.contrib.auth',
    'rest_framework',     # DRF
    'surveys',            # our app
    'accounts',           # our app
    'subscriptions',      # our app
]

# DRF configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

### 2.9 manage.py — Your Django CLI

```bash
# Start the dev server
python manage.py runserver

# Create database migrations after model changes
python manage.py makemigrations
python manage.py migrate

# Open a Python shell with Django loaded
python manage.py shell

# Create a superuser for Django admin
python manage.py createsuperuser
```

---

## Part 3: JavaScript/React — The Frontend

### 3.1 JavaScript vs C/C++ Mental Model

| C/C++ | JavaScript | Notes |
|---|---|---|
| `int x = 5;` | `let x = 5;` or `const x = 5;` | `const` = can't reassign, `let` = can |
| `void foo() {}` | `function foo() {}` | or arrow: `const foo = () => {}` |
| Pointers | References | No pointer arithmetic |
| `struct` | Object literal `{}` | Same idea |
| Arrays | Arrays + built-in methods | Much richer |
| `#include` | `import` | ES6 module system |
| `nullptr` | `null` or `undefined` | Two "empty" values |

**JavaScript quirks from a C++ perspective:**
- Variables are dynamically typed — `x` can be a number, then a string
- `const` means "can't reassign the variable", NOT "the value is immutable"
- `===` is strict equality (always use this, not `==`)
- Functions are first-class — you can pass them as arguments

```javascript
// Arrow function (shorthand for function)
const add = (a, b) => a + b;

// Objects (like struct/dict hybrid)
const survey = {
    title: "My Survey",
    status: "active",
    getTitle() { return this.title; }  // method
};

// Destructuring (extract values from object)
const { title, status } = survey;  // title = "My Survey"

// Spread operator (copy + merge objects)
const updated = { ...survey, status: "closed" };

// Template literals (like Python f-strings)
const url = `/api/surveys/${survey.id}/`;

// Array methods (incredibly useful)
const types = ["mc", "text", "rating"];
const upper = types.map(t => t.toUpperCase());  // ["MC", "TEXT", "RATING"]
const short = types.filter(t => t.length <= 2); // ["mc"]
```

### 3.2 What React Is

React is a JavaScript library for building user interfaces. The core idea: **UI = f(state)**.

Instead of manually manipulating the DOM (like jQuery), you:
1. Define **state** (data that can change)
2. Write a **component** (function that returns HTML-like JSX)
3. When state changes, React **automatically re-renders** the affected components

```
State changes  →  React re-renders component  →  DOM updates
```

### 3.3 React Components — The Building Blocks

A React component is a **function that returns JSX** (HTML-like syntax in JavaScript).

```jsx
// src/components/SurveyCard.jsx

// JSX looks like HTML but it's actually JavaScript
function SurveyCard({ title, status, responseCount }) {
    return (
        <div className="card">        {/* className not class */}
            <h2>{title}</h2>          {/* {} = inject JavaScript */}
            <span>{status}</span>
            <p>{responseCount} responses</p>
        </div>
    );
}

export default SurveyCard;
```

**JSX rules (differences from HTML):**
- `class` → `className` (because `class` is reserved in JavaScript)
- `{}` to insert JavaScript expressions
- Every tag must close: `<br />` not `<br>`
- Return ONE root element (wrap in `<div>` or `<>` if needed)

### 3.4 State — Data That Changes

```jsx
import { useState } from 'react';

function Counter() {
    // useState returns [currentValue, setterFunction]
    const [count, setCount] = useState(0);  // 0 is the initial value

    return (
        <div>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>
                Increment
            </button>
        </div>
    );
}
```

**The golden rule:** Never mutate state directly. Always use the setter:
```javascript
// WRONG - React won't re-render
count = count + 1;

// RIGHT - React will re-render
setCount(count + 1);
```

### 3.5 useEffect — Side Effects

`useEffect` runs code *after* the component renders. Use it for:
- Fetching data from the API
- Setting up subscriptions
- Running code when a value changes

```jsx
import { useState, useEffect } from 'react';

function SurveyList() {
    const [surveys, setSurveys] = useState([]);

    useEffect(() => {
        // This runs after the component first renders
        fetch('/api/surveys/')
            .then(res => res.json())
            .then(data => setSurveys(data));
    }, []);  // [] = run only once (on mount)

    return (
        <ul>
            {surveys.map(survey => (
                <li key={survey.id}>{survey.title}</li>
            ))}
        </ul>
    );
}
```

The `[]` dependency array:
- `[]` = run once when component mounts
- `[userId]` = run when `userId` changes
- No array = run after every render

### 3.6 Props — Passing Data to Child Components

Props = arguments you pass to a component. Like function parameters.

```jsx
// Parent component
function Dashboard() {
    const surveys = [
        { id: 1, title: "Survey A", status: "active" }
    ];

    return (
        <div>
            {surveys.map(s => (
                <SurveyCard
                    key={s.id}
                    title={s.title}
                    status={s.status}
                />
            ))}
        </div>
    );
}

// Child component receives props
function SurveyCard({ title, status }) {   // destructured props
    return <div>{title} - {status}</div>;
}
```

### 3.7 TanStack Query — The Right Way to Fetch Data

This project uses `@tanstack/react-query` instead of raw `useEffect` for API calls. It handles caching, loading states, and refetching automatically.

```jsx
// How data fetching looks in this project (e.g., Dashboard.jsx)
import { useQuery } from '@tanstack/react-query';
import { getSurveys } from '../services/surveys';

function Dashboard() {
    const {
        data: surveys,     // the fetched data
        isLoading,         // true while fetching
        isError,           // true if fetch failed
        error              // the error object
    } = useQuery({
        queryKey: ['surveys'],       // cache key
        queryFn: getSurveys,         // function that fetches data
    });

    if (isLoading) return <div>Loading...</div>;
    if (isError) return <div>Error: {error.message}</div>;

    return (
        <ul>
            {surveys.map(s => <li key={s.id}>{s.title}</li>)}
        </ul>
    );
}
```

And the corresponding API service:
```javascript
// src/services/surveys.js
import api from './api';

export const getSurveys = () =>
    api.get('/surveys/').then(res => res.data);

export const createSurvey = (data) =>
    api.post('/surveys/', data).then(res => res.data);
```

### 3.8 React Router — Navigation

This project uses React Router for client-side navigation (no page reloads):

```jsx
// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/surveys/:id/edit" element={<SurveyBuilder />} />
            </Routes>
        </BrowserRouter>
    );
}

// In SurveyBuilder, get the :id from the URL:
import { useParams } from 'react-router-dom';

function SurveyBuilder() {
    const { id } = useParams();  // { id: "abc-123" }
    // fetch survey with this id
}
```

### 3.9 Tailwind CSS — Styling Without CSS Files

Tailwind applies styles via class names directly in JSX. No separate CSS files needed.

```jsx
// Instead of writing CSS:
// .card { padding: 16px; border-radius: 8px; background: white; }

// You use utility classes:
<div className="p-4 rounded-lg bg-white shadow-md">
    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    <p className="text-sm text-gray-500 mt-2">{description}</p>
</div>
```

Common patterns:
- `p-4` = padding 16px (4 × 4px)
- `m-2` = margin 8px
- `text-sm` = small text
- `font-bold` = bold
- `flex` = display flex
- `grid` = CSS grid
- `text-gray-900` = dark gray text
- `bg-white` = white background
- `rounded-lg` = large border radius
- `w-full` = width 100%
- `hidden` / `block` = display none / block

---

## Part 4: How the Full Stack Connects

### 4.1 The Architecture

```
┌─────────────────────────────────────────────────┐
│  BROWSER                                         │
│                                                  │
│  React App (localhost:5173)                      │
│  ├── Pages (Dashboard, Builder, Analytics)       │
│  ├── Components (SurveyCard, ChartCard, etc.)    │
│  ├── Services (api.js → axios calls)             │
│  └── State (React Query cache + useState)        │
└────────────────┬────────────────────────────────┘
                 │  HTTP/JSON (REST API)
                 │  GET /api/surveys/
                 │  POST /api/surveys/
                 │  Authorization: Bearer <jwt_token>
                 ↓
┌─────────────────────────────────────────────────┐
│  DJANGO (localhost:8000)                         │
│                                                  │
│  urls.py → routes requests to ViewSets          │
│  ViewSets → apply permissions + get data        │
│  Serializers → convert Python objects to JSON   │
│  Models (ORM) → generate SQL queries            │
└────────────────┬────────────────────────────────┘
                 │  SQL
                 ↓
┌─────────────────────────────────────────────────┐
│  PostgreSQL (localhost:5432)                     │
│  Tables: surveys, pages, questions, answers...   │
└─────────────────────────────────────────────────┘
```

### 4.2 How API Calls Work End-to-End

Let's trace what happens when you open the survey dashboard:

**Step 1: React fires a query**
```javascript
// src/services/surveys.js
const getSurveys = () => api.get('/surveys/').then(res => res.data);

// Dashboard.jsx uses it:
const { data } = useQuery({ queryKey: ['surveys'], queryFn: getSurveys });
```

**Step 2: Axios sends the HTTP request**
```
GET http://localhost:8000/api/surveys/
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Step 3: Django routes it**
```python
# questizsurvey/urls.py
path('api/', include('surveys.urls')),

# surveys/urls.py
router.register(r'surveys', SurveyViewSet)
# → GET /api/surveys/ maps to SurveyViewSet.list()
```

**Step 4: ViewSet executes**
```python
class SurveyViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return Survey.objects.filter(user=self.request.user)
    # DRF automatically calls the serializer and returns JSON
```

**Step 5: Serializer converts to JSON**
```python
class SurveyListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Survey
        fields = ['id', 'title', 'status', 'created_at']
```

**Step 6: Django sends response**
```json
HTTP 200 OK
[
  {"id": "abc-123", "title": "Customer Survey", "status": "active", ...},
  {"id": "def-456", "title": "Employee Survey", "status": "draft", ...}
]
```

**Step 7: React receives and renders**
```jsx
surveys.map(s => <SurveyCard key={s.id} title={s.title} />)
```

### 4.3 Environment Variables

Both sides use `.env` files for configuration secrets:

**Backend** (`backend/.env`):
```
SECRET_KEY=django-secret-key-here
DATABASE_URL=postgresql://user:pass@localhost/questizsurvey
DEBUG=True
```

**Frontend** (`frontend/.env`):
```
VITE_API_URL=http://localhost:8000/api
```

Read in code:
```python
# Python
import os
SECRET_KEY = os.environ.get('SECRET_KEY')
```
```javascript
// JavaScript (Vite)
const apiUrl = import.meta.env.VITE_API_URL;
```

Never commit `.env` files to git. They contain secrets.

---

## Part 5: Project-Specific Patterns

### 5.1 How This Project's Models Relate

```
User (accounts app)
 └── Survey (surveys app)
       ├── Page
       │    └── Question
       │          └── Choice
       ├── Collector
       │    └── EmailInvitation
       └── SurveyResponse
             └── Answer
```

Every model has `id = UUIDField(primary_key=True)`. When you see `survey_id`, `question_id` etc., they are UUIDs.

### 5.2 Reading an Actual View

Look at `backend/surveys/views/survey_views.py`. Here's how to read it:

```python
class SurveyViewSet(viewsets.ModelViewSet):
    # What serializer to use for different actions
    def get_serializer_class(self):
        if self.action == 'list':
            return SurveyListSerializer      # compact for lists
        return SurveyDetailSerializer        # full detail for single items

    # What data this ViewSet operates on
    def get_queryset(self):
        return Survey.objects.filter(user=self.request.user)

    # Custom action: POST /api/surveys/{id}/duplicate/
    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        survey = self.get_object()
        # ... copy the survey ...
        return Response(new_survey_data)
```

### 5.3 Reading an Actual Serializer

```python
# backend/surveys/serializers/survey_serializers.py
class SurveyDetailSerializer(serializers.ModelSerializer):
    # Nested serializer — include pages inside the survey JSON
    pages = PageSerializer(many=True, read_only=True)

    # Computed field — not a database column, calculated in Python
    response_count = serializers.SerializerMethodField()

    def get_response_count(self, obj):
        return obj.responses.count()   # obj = the Survey instance

    class Meta:
        model = Survey
        fields = ['id', 'title', 'status', 'pages', 'response_count']
```

### 5.4 Reading an Actual React Component

Look at `frontend/src/pages/surveys/SurveyBuilder.jsx`. The pattern:

```jsx
function SurveyBuilder() {
    // 1. Get URL params
    const { id } = useParams();

    // 2. Fetch data
    const { data: survey, isLoading } = useQuery({
        queryKey: ['survey', id],
        queryFn: () => getSurvey(id)
    });

    // 3. Mutations (create/update/delete)
    const updateMutation = useMutation({
        mutationFn: (data) => updateSurvey(id, data),
        onSuccess: () => toast.success("Saved!"),
    });

    // 4. Local state
    const [selectedQuestionId, setSelectedQuestionId] = useState(null);

    // 5. Render
    if (isLoading) return <Skeleton />;

    return (
        <div className="flex h-screen">
            <QuestionTypePalette />
            <SurveyBuilderCanvas
                survey={survey}
                onQuestionSelect={setSelectedQuestionId}
            />
            <QuestionSettingsPanel questionId={selectedQuestionId} />
        </div>
    );
}
```

### 5.5 The Services Layer (API Calls)

All API calls are centralized in `frontend/src/services/`:

```javascript
// src/services/api.js — base axios instance with auth header
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
});

// Automatically attach the JWT token to every request
api.interceptors.request.use(config => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default api;

// src/services/surveys.js
import api from './api';

export const getSurveys = () => api.get('/surveys/').then(r => r.data);
export const getSurvey = (id) => api.get(`/surveys/${id}/`).then(r => r.data);
export const createSurvey = (data) => api.post('/surveys/', data).then(r => r.data);
export const updateSurvey = (id, data) => api.patch(`/surveys/${id}/`, data).then(r => r.data);
export const deleteSurvey = (id) => api.delete(`/surveys/${id}/`);
```

---

## Part 6: AI-Era Development Workflow

### 6.1 Your Mental Model for Working with Claude Code

Think of yourself as the **architect** and Claude Code as the **builder**. Your job:
- Understand *what* needs to be built
- Know *where* it goes in the project
- Recognize when something is **wrong**
- Direct Claude with precise instructions

You do NOT need to memorize every syntax detail. You need to understand concepts well enough to:
1. Write accurate prompts
2. Read and verify generated code
3. Debug when things break

### 6.2 How to Prompt Effectively

**Bad prompt:** "Make the survey builder better"

**Good prompt:**
> "In `backend/surveys/views/survey_views.py`, add a `@action` method called `archive` that sets `survey.status = 'closed'` and `survey.archived = True`. It should be a POST method, detail=True. Use the existing pattern from the `duplicate` action already in that file."

The good prompt specifies:
- **Which file** to work in
- **What to name** the thing
- **What it should do** (exact behavior)
- **Reference existing patterns** to follow

### 6.3 How to Read an Error and Debug

**Python/Django errors:**
```
surveys.models.question.DoesNotExist: Question matching query does not exist.
```
→ You called `.get()` but nothing matched. Use `.filter().first()` or add a try/except.

```
django.db.utils.IntegrityError: NOT NULL constraint failed: surveys_answer.question_id
```
→ You're trying to create an Answer without providing a `question_id`.

```
rest_framework.exceptions.ValidationError: {"title": ["This field is required."]}
```
→ The serializer requires a field you didn't provide in your POST request.

**JavaScript/React errors:**
```
TypeError: Cannot read properties of undefined (reading 'title')
```
→ Your data hasn't loaded yet. Add a loading check: `if (!survey) return null;`

```
Warning: Each child in a list should have a unique "key" prop.
```
→ Add `key={item.id}` to elements in a `.map()` call.

### 6.4 The Development Loop

```
1. Pick a task from the development plan
2. Read the relevant existing files to understand context
3. Ask Claude: "Look at [file], explain what it does"
4. Ask Claude to implement the change
5. Read the generated code — understand what each part does
6. Run it (backend: python manage.py runserver, frontend: npm run dev)
7. Test in browser or with curl
8. If something breaks, paste the error to Claude with context
9. Commit the working code
```

### 6.5 Running the Project

**Backend:**
```bash
cd backend
source venv/bin/activate        # activate Python virtual environment
python manage.py runserver      # starts Django on http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm run dev                     # starts React on http://localhost:5173
```

**Both:** Use `./start.sh` from the project root (this project has a startup script).

**Check the API works:**
```bash
curl http://localhost:8000/api/surveys/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or open the Django admin at `http://localhost:8000/admin/` to browse the database.

---

## Part 7: Key Concepts Quick Reference

### Django Cheat Sheet

```python
# Model field types
models.CharField(max_length=255)     # short text
models.TextField()                    # long text
models.IntegerField()                # integer
models.DecimalField(max_digits=10, decimal_places=2)  # decimal
models.BooleanField(default=False)   # boolean
models.DateTimeField(auto_now_add=True)  # timestamp
models.UUIDField(primary_key=True, default=uuid.uuid4)  # UUID
models.JSONField(default=dict)        # JSON/JSONB
models.ForeignKey(OtherModel, on_delete=models.CASCADE)  # relation

# ORM queries
Model.objects.all()                   # get all
Model.objects.filter(field=value)     # WHERE field = value
Model.objects.get(id=pk)              # get exactly one (raises if not found)
Model.objects.create(field=value)     # INSERT
instance.save()                       # UPDATE
instance.delete()                     # DELETE
queryset.count()                      # COUNT(*)
queryset.order_by('-created_at')      # ORDER BY
queryset.select_related('user')       # JOIN (to avoid N+1)
```

### React/JavaScript Cheat Sheet

```javascript
// Hooks
const [value, setValue] = useState(initial)  // local state
useEffect(() => { /* side effect */ }, [dep]) // run on dep change
const { id } = useParams()                   // URL params
const navigate = useNavigate()               // programmatic navigation
navigate('/dashboard')                       // redirect

// React Query
const { data, isLoading } = useQuery({ queryKey: [...], queryFn: fn })
const mutation = useMutation({ mutationFn: fn, onSuccess: () => {} })
mutation.mutate(data)                        // trigger mutation

// Array methods
arr.map(item => <div key={item.id}>{item.name}</div>)  // render list
arr.filter(item => item.active)              // filter list
arr.find(item => item.id === id)             // find one item

// Conditional rendering
{isLoading && <Spinner />}                   // show if true
{error ? <Error /> : <Content />}           // if/else
{count > 0 && <Badge>{count}</Badge>}        // show if count > 0
```

---

## Part 8: Learning Path (Week by Week)

### Week 1 — Python and Django Basics
- [ ] Read Part 1 (Python) and write small Python scripts to test each concept
- [ ] Read `backend/surveys/models/survey.py` — understand every field
- [ ] Read `backend/surveys/models/question.py` — notice the 18 question types
- [ ] Open Django admin (`/admin/`) and create a test survey manually
- [ ] Run `python manage.py shell` and try: `Survey.objects.all()`

### Week 2 — Django REST Framework
- [ ] Read `backend/surveys/serializers/survey_serializers.py`
- [ ] Read `backend/surveys/views/survey_views.py`
- [ ] Test the API with curl or Postman: login, get token, list surveys
- [ ] Add one small field to an existing serializer (safe, non-breaking)
- [ ] Read `backend/surveys/urls.py`

### Week 3 — JavaScript and React Basics
- [ ] Read Part 3 (JavaScript/React) and experiment in browser console
- [ ] Read `frontend/src/pages/Dashboard.jsx` — identify state, effects, renders
- [ ] Read `frontend/src/services/surveys.js` — understand every API call
- [ ] Make a small visual change to the Dashboard (change a label, color)

### Week 4 — The Full Stack Together
- [ ] Trace one full feature end-to-end: creating a survey
- [ ] Read `frontend/src/pages/surveys/SurveyBuilder.jsx` with fresh eyes
- [ ] Read `backend/surveys/views/question_views.py` — how questions are saved
- [ ] Try adding a new field to the survey (backend + frontend)

### Ongoing — Building Features
- Use the Development Plan as your roadmap
- For each feature: read existing similar code first, then ask Claude to implement
- Always run and test before moving on

---

## Part 9: Vocabulary Glossary

| Term | Meaning |
|---|---|
| **API** | Interface for two programs to talk. Here: Django exposes endpoints React calls |
| **REST** | API design style using HTTP verbs (GET, POST, PUT, DELETE) |
| **JSON** | Text format for data. `{"key": "value"}` |
| **Endpoint** | A URL that does something. `/api/surveys/` is an endpoint |
| **Request** | Browser/React asking Django for something |
| **Response** | Django's reply (usually JSON) |
| **ORM** | Object Relational Mapper — Python objects that map to database rows |
| **Migration** | A file describing how to update the database schema |
| **Serializer** | Converts between Python objects and JSON |
| **ViewSet** | A class that handles multiple related API endpoints |
| **Component** | A React function that returns UI (JSX) |
| **State** | Data inside a React component that can change |
| **Props** | Arguments passed to a React component |
| **Hook** | A function starting with `use` that adds functionality to components |
| **JWT** | A secure token that proves who you are to the API |
| **CORS** | Security policy controlling which domains can call your API |
| **Vite** | Build tool that serves React in development |
| **Tailwind** | CSS utility class system |
| **shadcn/ui** | A set of pre-built React components using Tailwind |
| **Virtual env** | Isolated Python environment with specific packages |
| **npm** | Node Package Manager — installs JavaScript packages |
| **pip** | Python's package installer |

---

*This document covers everything needed to read, modify, and contribute to the Questiz codebase. Revisit sections as needed when working on specific features. The goal is not to memorize — it's to understand well enough to direct AI tools effectively and catch mistakes.*

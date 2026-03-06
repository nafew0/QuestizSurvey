# shadcn/ui Integration Guide

This template now includes [shadcn/ui](https://ui.shadcn.com/), a collection of beautifully designed, accessible, and customizable React components built with Radix UI and Tailwind CSS.

## What is shadcn/ui?

shadcn/ui is not a traditional component library. Instead of installing it as a dependency, you copy the component code directly into your project. This gives you full control over the components and allows you to customize them however you want.

## Included Components

The template comes with the following shadcn/ui components pre-installed:

### UI Components (`src/components/ui/`)
- **Button** - Versatile button component with multiple variants
- **Card** - Container component for content cards
- **Input** - Styled input fields
- **Label** - Form labels with proper accessibility
- **Avatar** - User avatar with fallback
- **Alert** - Alert messages with variants
- **Dropdown Menu** - Accessible dropdown menus with Radix UI

### Dependencies Installed

```json
{
  "@radix-ui/react-avatar": "^1.0.4",
  "@radix-ui/react-dialog": "^1.0.5",
  "@radix-ui/react-dropdown-menu": "^2.0.6",
  "@radix-ui/react-label": "^2.0.2",
  "@radix-ui/react-separator": "^1.0.3",
  "@radix-ui/react-slot": "^1.0.2",
  "@radix-ui/react-toast": "^1.1.5",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.0",
  "lucide-react": "^0.344.0",
  "tailwind-merge": "^2.2.1",
  "tailwindcss-animate": "^1.0.7"
}
```

## Where Components Are Used

### Login Page (`src/pages/Login.jsx`)
- `Button` - Submit button with loading state
- `Card` - Container for login form
- `Input` - Username and password fields
- `Label` - Form field labels
- `Alert` - Error messages

### Register Page (`src/pages/Register.jsx`)
- `Button` - Submit button with loading state
- `Card` - Container for registration form
- `Input` - All form input fields
- `Label` - Form field labels
- `Alert` - Error messages

### Navbar (`src/components/Navbar.jsx`)
- `Button` - Login and Dashboard buttons
- `Avatar` - User avatar in dropdown
- `DropdownMenu` - User menu with navigation options
- Lucide React icons: `User`, `LogOut`, `LayoutDashboard`, `Settings`

### Home Page (`src/pages/Home.jsx`)
- `Button` - Call-to-action buttons
- `Card` - Feature cards
- Lucide React icons: `Code2`, `Rocket`, `Shield`

## Configuration Files

### `components.json`
Configuration file for shadcn/ui CLI tool (if you want to add more components later):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

### `tailwind.config.js`
Extended Tailwind configuration with shadcn/ui theme:

- CSS variables for colors (light and dark mode)
- Custom animations (accordion, etc.)
- Container configuration
- Border radius tokens

### `src/index.css`
Global styles with CSS variables:

- Theme colors (primary, secondary, destructive, etc.)
- Dark mode support
- Base layer styles

### `src/lib/utils.js`
Utility function for merging Tailwind classes:

```javascript
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

### `vite.config.js`
Path alias configuration:

```javascript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
}
```

This allows imports like `import { Button } from "@/components/ui/button"`

## Adding More Components

To add additional shadcn/ui components to your project:

### Option 1: Using the CLI (Recommended)

```bash
cd frontend
npx shadcn-ui@latest add [component-name]
```

For example:
```bash
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add select
npx shadcn-ui@latest add checkbox
```

### Option 2: Manual Copy

1. Visit https://ui.shadcn.com/docs/components
2. Find the component you want
3. Click "Installation"
4. Copy the component code to `src/components/ui/[component-name].jsx`
5. Install any required dependencies

## Customizing Components

Since the components are in your codebase, you can customize them directly:

### Changing Colors

Edit `src/index.css` to change theme colors:

```css
:root {
  --primary: 221.2 83.2% 53.3%; /* Blue - change this */
  --destructive: 0 84.2% 60.2%; /* Red - change this */
  /* etc. */
}
```

### Modifying Components

Edit any component in `src/components/ui/` directly:

```javascript
// src/components/ui/button.jsx
// Change button styles, add new variants, etc.
```

### Creating Variants

Use `class-variance-authority` to create new component variants:

```javascript
const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "...",
        myNewVariant: "bg-purple-500 text-white", // Add custom variant
      },
    },
  }
)
```

## Dark Mode Support

The template includes dark mode support built-in. To enable it:

1. Add dark mode toggle to your navbar
2. Use `class="dark"` on the root element to activate dark mode
3. All shadcn/ui components will automatically adapt

Example toggle:

```javascript
const [isDark, setIsDark] = useState(false)

const toggleDarkMode = () => {
  setIsDark(!isDark)
  document.documentElement.classList.toggle('dark')
}
```

## Icon Library (Lucide React)

The template includes Lucide React for icons:

```javascript
import { User, Settings, LogOut } from "lucide-react"

<User className="h-4 w-4" />
<Settings className="h-4 w-4" />
<LogOut className="h-4 w-4" />
```

Browse all icons at: https://lucide.dev/icons/

## Accessibility

All shadcn/ui components are built with accessibility in mind:

- Proper ARIA attributes
- Keyboard navigation
- Focus management
- Screen reader support

Components use Radix UI primitives which are thoroughly tested for accessibility.

## Component Examples

### Button

```javascript
import { Button } from "@/components/ui/button"

<Button>Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button size="lg">Large</Button>
<Button size="sm">Small</Button>
<Button disabled>Disabled</Button>
```

### Card

```javascript
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Form with Input and Label

```javascript
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="Enter your email" />
</div>
```

### Alert

```javascript
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertDescription>
    Error message goes here
  </AlertDescription>
</Alert>
```

### Dropdown Menu

```javascript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

<DropdownMenu>
  <DropdownMenuTrigger>Open</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
    <DropdownMenuItem>Logout</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Useful Resources

- **Official Docs**: https://ui.shadcn.com/docs
- **All Components**: https://ui.shadcn.com/docs/components
- **Themes**: https://ui.shadcn.com/themes
- **Examples**: https://ui.shadcn.com/examples
- **Radix UI**: https://www.radix-ui.com/
- **Lucide Icons**: https://lucide.dev/
- **Tailwind CSS**: https://tailwindcss.com/

## Tips & Best Practices

1. **Use the `cn()` utility** for conditional classes:
   ```javascript
   import { cn } from "@/lib/utils"

   <Button className={cn("extra-class", isActive && "active-class")} />
   ```

2. **Compose components** instead of modifying them:
   ```javascript
   // Create a new component that wraps the base component
   export function LoadingButton({ loading, children, ...props }) {
     return (
       <Button disabled={loading} {...props}>
         {loading ? "Loading..." : children}
       </Button>
     )
   }
   ```

3. **Keep components organized**:
   - Base shadcn/ui components in `src/components/ui/`
   - Your custom components in `src/components/`

4. **Leverage Tailwind utilities**:
   - Use Tailwind classes for spacing, sizing, colors
   - Components are designed to work seamlessly with Tailwind

5. **Type safety** (if using TypeScript):
   - shadcn/ui components work great with TypeScript
   - Add `tsx: true` in `components.json` to generate TypeScript components

## Troubleshooting

### Import errors
Make sure path aliases are configured in `vite.config.js`:
```javascript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
}
```

### Styles not applying
1. Check that `src/index.css` is imported in `main.jsx`
2. Verify Tailwind is configured correctly
3. Make sure `tailwindcss-animate` plugin is in `tailwind.config.js`

### Components not rendering
1. Verify all Radix UI dependencies are installed
2. Check browser console for errors
3. Ensure `lucide-react` is installed for icon components

---

**shadcn/ui makes this template beautiful, accessible, and fully customizable!** 🎨

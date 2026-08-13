# DESIGN.md — Educational Light
> Version: 1.0 | Mood: 活潑、友善、清晰
> Reference: Duolingo, Khan Academy, Google Classroom feel
> Best for: 學生向介面、練習平台、課堂工具、家長/學生 App

---

## Colors

### Backgrounds
```
bg-base:     #fafafa   ← page background
bg-surface:  #ffffff   ← cards, panels
bg-elevated: #f4f4f8   ← input backgrounds, sub-panels
bg-section:  #f0f0f6   ← alternating section backgrounds
```

### Primary (Indigo)
```
primary-50:  #eef2ff
primary-100: #e0e7ff
primary-400: #818cf8
primary-500: #6366f1   ← PRIMARY
primary-600: #4f46e5   ← hover
primary-700: #4338ca   ← pressed
```

### Semantic
```
success-50:  #d1fae5
success-500: #10b981   ← correct answers, completion
success-600: #059669

warning-50:  #fef3c7
warning-500: #f59e0b   ← caution, in-progress
warning-600: #d97706

error-50:    #fee2e2
error-500:   #ef4444   ← wrong answers, errors
error-600:   #dc2626

info-50:     #e0f2fe
info-500:    #0ea5e9
```

### Subject Colors (for multi-subject platforms)
```
math:    #6366f1   (indigo)
science: #10b981   (emerald)
english: #f59e0b   (amber)
history: #f97316   (orange)
art:     #ec4899   (pink)
```

### Text
```
text-primary:   #111827
text-secondary: #6b7280
text-muted:     #9ca3af
text-disabled:  #d1d5db
```

### Borders
```
border-subtle:  #f3f4f6
border-default: #e5e7eb
border-strong:  #d1d5db
border-focus:   #6366f1
```

---

## Typography

Font family: Inter, system-ui, sans-serif

| Token       | Size    | Weight | Line Height | Use Case                              |
|------------|---------|--------|-------------|---------------------------------------|
| display    | 2.25rem | 800    | 1.10        | Page hero, score reveal               |
| heading-xl | 1.75rem | 700    | 1.20        | Section titles                        |
| heading-lg | 1.375rem| 700    | 1.25        | Card titles, chapter names            |
| heading-md | 1.125rem| 600    | 1.30        | Sub-headings, question stems          |
| body-lg    | 1rem    | 400    | 1.70        | Explanations, instructions            |
| body       | 0.9375rem| 400   | 1.60        | Default body text                     |
| body-sm    | 0.8125rem| 400   | 1.50        | Helper text, meta                     |
| label      | 0.875rem | 600   | 1.20        | Form labels, tab labels               |
| label-sm   | 0.75rem  | 600   | 1.20        | Badges, category tags                 |
| button     | 0.9375rem| 600   | 1.20        | Button labels                         |
| mono       | 0.875rem | 500   | 1.50        | Math expressions, code (use sparingly)|
| score      | 3rem    | 800    | 1.0         | Score display, big numbers            |

---

## Spacing System

```
space-1:  4px
space-2:  8px
space-3:  12px
space-4:  16px
space-5:  20px
space-6:  24px
space-8:  32px
space-10: 40px
space-12: 48px
section:  80px
```

---

## Border Radius

```
radius-sm:   8px    ← badges, tags
radius-md:   12px   ← buttons, inputs, small cards
radius-lg:   16px   ← standard cards
radius-xl:   20px   ← selected states, large cards
radius-2xl:  24px   ← hero sections, modals
radius-full: 9999px ← pill buttons, avatars, progress bars
```

---

## Elevation Model

- **Level 0** — bg-base. Page background only.
- **Level 1** — bg-surface + border-default + shadow-sm. Default cards.
- **Level 2** — bg-surface + border-strong + shadow-md. Hovered or selected cards.
- **Level 3** — bg-surface + border-focus (2px). Active/selected interactive items.

Shadows (light mode):
```
shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
shadow-md: 0 4px 8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)
shadow-lg: 0 8px 20px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06)
```

---

## Components

### Buttons

**`button-primary`**
- Background: `{colors.primary-500}`
- Text: white
- Typography: `{typography.button}`
- Radius: `{radius.lg}`
- Padding: 12px 24px
- Shadow: `{shadow-sm}`
- Hover → background: `{colors.primary-600}`
- Active → background: `{colors.primary-700}`

**`button-secondary`**
- Background: white
- Text: `{colors.text-primary}`
- Typography: `{typography.button}`
- Radius: `{radius.lg}`
- Padding: 12px 24px
- Border: 1px `{colors.border-default}`
- Shadow: `{shadow-sm}`
- Hover → background: `{colors.bg-elevated}`

**`button-success`**
- Background: `{colors.success-500}`
- Text: white
- Typography: `{typography.button}`
- Radius: `{radius.lg}`
- Padding: 12px 24px

**`button-ghost`**
- Background: transparent
- Text: `{colors.primary-500}`
- Typography: `{typography.button}`
- Radius: `{radius.lg}`
- Padding: 12px 24px
- Hover → background: `{colors.primary-50}`

**`button-danger`**
- Background: `{colors.error-500}`
- Text: white
- Typography: `{typography.button}`
- Radius: `{radius.lg}`
- Padding: 12px 24px

### Cards

**`card-default`**
- Background: `{colors.bg-surface}`
- Border: 1px `{colors.border-default}`
- Radius: `{radius.xl}`
- Padding: `{space-5}`
- Shadow: `{shadow-sm}`

**`card-highlight`** (active chapter, featured)
- Background: `{colors.primary-50}`
- Border: 1px `{colors.primary-100}`
- Radius: `{radius.xl}`
- Padding: `{space-5}`

**`card-selected`**
- Background: `{colors.bg-surface}`
- Border: 2px `{colors.primary-500}`
- Radius: `{radius.xl}`
- Padding: `{space-5}`
- Shadow: `{shadow-md}`

**`card-success`** (correct answer)
- Background: `{colors.success-50}`
- Border: 2px `{colors.success-500}`
- Radius: `{radius.xl}`
- Padding: `{space-5}`

**`card-error`** (wrong answer)
- Background: `{colors.error-50}`
- Border: 2px `{colors.error-500}`
- Radius: `{radius.xl}`
- Padding: `{space-5}`

### Quiz / MCQ Options

**`option-default`**
- Background: white
- Border: 2px `{colors.border-default}`
- Text: `{colors.text-primary}`
- Typography: `{typography.body}`
- Radius: `{radius.lg}`
- Padding: 12px 16px
- Hover → border: `{colors.primary-400}`, background: `{colors.primary-50}`

**`option-selected`**
- Background: `{colors.primary-50}`
- Border: 2px `{colors.primary-500}`
- Text: `{colors.primary-700}`
- Typography: `{typography.body}`
- Radius: `{radius.lg}`

**`option-correct`**
- Background: `{colors.success-50}`
- Border: 2px `{colors.success-500}`
- Text: `{colors.success-600}`

**`option-wrong`**
- Background: `{colors.error-50}`
- Border: 2px `{colors.error-500}`
- Text: `{colors.error-600}`

### Badges & Progress

**`badge-subject`**
- Background: subject tint color (e.g. primary-50 for Math)
- Text: subject dark color (e.g. primary-700)
- Typography: `{typography.label-sm}`
- Radius: `{radius.full}`
- Padding: 4px 10px

**`badge-score`**
- Background: `{colors.success-50}`
- Text: `{colors.success-600}`
- Typography: `{typography.label}`
- Radius: `{radius.full}`
- Padding: 4px 12px
- Border: 1px `{colors.success-500}` at 30%

**`progress-bar`**
- Track: `{colors.border-subtle}`
- Fill: `{colors.primary-500}`
- Height: 10px
- Radius: `{radius.full}`

**`progress-bar-success`**
- Fill: `{colors.success-500}`

**`progress-bar-warning`**
- Fill: `{colors.warning-500}`

### Feedback Messages

**`feedback-correct`**
- Background: `{colors.success-50}`
- Border: 1px `{colors.success-500}` at 30%
- Icon: ✓ in `{colors.success-500}`
- Text: `{colors.success-600}`
- Radius: `{radius.lg}`
- Padding: `{space-3}` `{space-4}`

**`feedback-wrong`**
- Background: `{colors.error-50}`
- Border: 1px `{colors.error-500}` at 30%
- Icon: ✗ in `{colors.error-500}`
- Text: `{colors.error-600}`
- Radius: `{radius.lg}`
- Padding: `{space-3}` `{space-4}`

**`feedback-tip`**
- Background: `{colors.warning-50}`
- Border: 1px `{colors.warning-500}` at 30%
- Icon: 💡 or ⚠️
- Text: `{colors.warning-600}`
- Radius: `{radius.lg}`

---

## Design Principles

### Color Strategy
- Primary indigo is the interactive color — all buttons, selected states, focus rings.
- Semantic colors (green/amber/red) are exclusively for feedback states. Do not decorate with them.
- Subject colors are only used when the content is explicitly multi-subject. Single-subject apps use primary only.
- White (#ffffff) surface is the clean canvas. Never use dark backgrounds on this theme.

### Friendliness
- Border radius should be generous (lg–xl) on all interactive elements.
- Buttons carry box-shadow to feel "pressable."
- Success states use enthusiastic copy ("Excellent!", "🎉 Great job!") paired with success-50 background.
- Error states are matter-of-fact, never alarming. Use red sparingly and with supportive copy.

### Typography Voice
- ExtraBold (800) only for scores and big achievement numbers.
- Bold (700) for headings. Regular (400) for all body text.
- Line height is always relaxed (1.6–1.7) for readability — students read long instructions.
- Never use UPPERCASE for body copy. ALL CAPS only allowed in eyebrow labels.

### Layout
- Cards are the primary unit of content — everything lives in a card.
- Questions center-aligned, explanations left-aligned.
- Max content width: 800px for quiz flow, 1200px for dashboard.
- Bottom-anchored primary CTA on mobile (sticky footer button pattern).

---

## Do's and Don'ts

### Do
- Use rounded corners everywhere — nothing should feel sharp or clinical.
- Add box-shadow to interactive cards (not just decorative ones).
- Use progress bars to motivate — show progress early and often.
- Use the semantic colors for answer feedback — green = right, red = wrong, amber = tip.
- Use subject color badges to categorize content.
- Show 🎉 and positive emoji in completion states.

### Don't
- Don't use dark backgrounds on this theme — it conflicts with the friendly mood.
- Don't use error-500 for decorative or warning states — red means wrong answer only.
- Don't use body text smaller than 15px — students need comfortable reading sizes.
- Don't use primary-500 for decorative accents — it must always be the interactive color.
- Don't use border radius smaller than 8px on any card or button.
- Don't put more than 4 MCQ options per question without scrolling.

---

## Responsive Behavior

| Breakpoint | Width  | Key Changes                                         |
|-----------|--------|-----------------------------------------------------|
| lg        | 1024px | Full dashboard with sidebar                         |
| md        | 768px  | No sidebar; top navigation tabs                     |
| sm        | 640px  | Single column; MCQ options stack vertically         |
| xs        | 375px  | CTA button anchored to bottom; font scale down 5%  |

Touch targets: all MCQ options min 52px height. All buttons min 48px height on mobile.

---

## Tailwind Quick Reference

```
bg-base:    bg-gray-50
bg-surface: bg-white
primary:    bg-indigo-500 / text-indigo-600
success:    bg-emerald-500 / text-emerald-600
warning:    bg-amber-500 / text-amber-600
error:      bg-red-500 / text-red-600
card:       bg-white rounded-2xl border border-gray-200 shadow-sm
badge:      px-2.5 py-1 text-xs font-semibold rounded-full
btn-primary: bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold
```

# PDF Export Feature - Area Summary Report

## Overview
Added comprehensive PDF report generation for the Area Summary analytics dashboard. Users can now generate professional, formatted PDF reports for selected months.

## What Was Implemented

### 1. PDF Generation Server Action
**File:** `src/app/analytics/pdf-actions.ts`

- Server-side PDF generation using Puppeteer
- Accepts year and array of month numbers
- Fetches data for each selected month
- Generates formatted HTML and converts to PDF
- Returns base64-encoded PDF for client download

### 2. Month Selector Modal
**File:** `src/components/analytics/MonthSelectorModal.tsx`

- Interactive month selection UI
- Grid layout with 3 columns (Jan-Dec)
- Toggle selection for multiple months
- Shows selected months summary
- Loading state during PDF generation

### 3. Updated Area Summary Report
**File:** `src/components/analytics/AreaSummaryReport.tsx`

**Added:**
- "Generate PDF Report" button next to existing Excel export
- Month selector modal integration
- PDF download handler with base64 to blob conversion
- State management for modal and loading states

**Kept:**
- Existing "Export Excel" button (quick data export)
- All current filtering and sorting functionality

## PDF Report Structure

### Single-Sheet Layout:

1. **Header Section**
   - Report title
   - Selected period (e.g., "January - February 2026")
   - Generation timestamp

2. **Summary Totals**
   - Total areas
   - Total quantity produced
   - Total work hours
   - Overall velocity
   - Overall efficiency (color-coded)

3. **Monthly Comparison** (if multiple months selected)
   - Side-by-side comparison table
   - Quantity, hours, velocity, efficiency per month

4. **Area Breakdown** (one section per month)
   - Detailed table for each selected month
   - All areas with their metrics
   - Color-coded efficiency indicators

5. **Top Performers**
   - Top 5 areas by efficiency
   - Across all selected months

6. **Areas Needing Attention**
   - Areas with efficiency < 80%
   - Sorted by lowest efficiency first

## Features

### Formatting
- Professional styling with colors and borders
- Color-coded efficiency (green >90%, yellow 80-90%, red <80%)
- Proper number formatting (1,234.5 for quantities, 85.3% for percentages)
- Page breaks between monthly sections
- Print-optimized A4 layout

### User Experience
- Two export options: Excel (quick data) and PDF (formal report)
- Modal for month selection with visual feedback
- Loading states during generation
- Automatic download when ready
- Error handling with user feedback

## Usage

1. Navigate to Analytics > Area Summary
2. Click "Generate PDF Report" button
3. Select one or more months from the modal
4. Click "Generate PDF"
5. Wait for generation (shows "Generating..." state)
6. PDF automatically downloads when ready

## Technical Details

### Dependencies Added
- `puppeteer` - Headless browser for PDF generation
- `@types/node` - TypeScript types

### Performance
- Server-side generation (no client bundle bloat)
- Fetches all data in parallel for selected months
- Generates PDF in ~2-5 seconds depending on data size

### File Naming
Format: `area-report-{year}-{month1}-{month2}-....pdf`
Example: `area-report-2024-1-2-3.pdf` (Jan, Feb, Mar 2024)

## Future Enhancements (Phase 2)

- Add charts/graphs (bar charts for area comparison, line charts for trends)
- Add week/year filters (currently month-based)
- Add report templates (different layouts for different audiences)
- Add scheduled reports (email PDF monthly)
- Add logo and company branding
- Add comparison reports (this period vs last period)

## Notes

- PDF generation requires Puppeteer which uses Chromium (~170MB download on first run)
- Server must have sufficient memory for Puppeteer (recommended: 512MB+ available)
- Generation is synchronous - user waits for completion
- For very large datasets (>1000 areas), consider pagination or optimization

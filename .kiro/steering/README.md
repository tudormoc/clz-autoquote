---
description: "Documentation index - start here to find what you need"
inclusion: manual
---

# Documentation Index

**Quick navigation to all project documentation**

## 🚀 Start Here

**New to the project?** Read in this order:

1. **`AI_RULES.md`** (root) - Project constitution and rules
2. **`structure.md`** - Project organization
3. **`tech.md`** - Technology stack
4. **`design-system.md`** - UI standards and tokens

## 📚 Core Documentation

### Project Rules & Standards
- **`AI_RULES.md`** (root) - Complete project constitution
  - Section 0: Rules of engagement
  - Section 1-4: Design philosophy, structure, standards
  - Section 5: Infrastructure patterns
  - Section 6: Pricing module architecture
  - Section 7: Analytics module architecture
  - Section 8: Design system enforcement

### Architecture & Structure
- **`structure.md`** - File organization and patterns
- **`tech.md`** - Technology stack and commands
- **`product.md`** - Product overview and features

### Design System
- **`design-system.md`** - Colors, typography, spacing rules
  - Auto-loaded for all `.tsx` files
  - Semantic tokens and examples
  - Zero tolerance for hardcoded values

### Database
- **`database-schema.md`** - Complete database reference
  - 3 databases: BUSINESS, NETPRO, QUOTES
  - Table schemas and relationships
  - Query patterns and examples
  - Commessa number handling (CRITICAL)
  - Common pitfalls and solutions

## 🎯 Domain-Specific Guides

### Analytics Module
- **`analytics-guide.md`** - Practical guide with examples
  - Where to add new reports
  - Real code examples
  - Common patterns
  - Troubleshooting
- **`src/app/analytics/REFACTORING_SUMMARY.md`** - File structure
  - Modular organization
  - Shared utilities
  - Adding new dashboards

### Pricing Module
- **`pricing-formulas.md`** - Formula standards (auto-loaded)
- **`src/lib/pricing/formulas/START_HERE.md`** - Quick orientation
- **`src/lib/pricing/formulas/QUICK_REFERENCE.md`** - One-page cheat sheet
- **`src/lib/pricing/formulas/README.md`** - Complete overview
- **`src/lib/pricing/formulas/CONTRIBUTING.md`** - How to add/modify
- **`src/lib/pricing/formulas/TEMPLATE.ts`** - Copy for new operations

## 🔧 Troubleshooting
- **`troubleshooting.md`** - Common issues and solutions
  - Analytics issues
  - Design system issues
  - Database issues
  - Pricing issues
  - Build issues
  - Performance issues

## 📖 Quick Reference by Task

### "I need to add a new analytics report"
1. Read: `database-schema.md` (CRITICAL)
2. Read: `analytics-guide.md` (examples)
3. Check: `AI_RULES.md` Section 7 (rules)
4. Reference: `REFACTORING_SUMMARY.md` (structure)

### "I need to modify a pricing formula"
1. Read: `pricing-formulas.md` (standards)
2. Read: `QUICK_REFERENCE.md` (formulas)
3. Check: `src/config/constants.ts` (try constants first)
4. Reference: `CONTRIBUTING.md` (if logic change needed)

### "I need to add a new UI component"
1. Read: `design-system.md` (MANDATORY)
2. Check: `src/app/globals.css` (tokens)
3. Check: `src/config/constants.ts` (spacing)
4. Reference: `AI_RULES.md` Section 4 (UI standards)

### "I need to query the database"
1. Read: `database-schema.md` (CRITICAL)
2. Check: `src/lib/mssql.ts` (use centralized pool)
3. Reference: `AI_RULES.md` Section 5 (infrastructure)

### "Something is broken"
1. Read: `troubleshooting.md` (common issues)
2. Check: Error message carefully
3. Compare: With similar working code
4. Reference: Relevant domain guide

## 🎓 Learning Path

### Junior Developer
```
1. product.md          (understand what we're building)
2. tech.md             (learn the stack)
3. structure.md        (understand organization)
4. design-system.md    (learn UI standards)
5. Pick a domain guide (analytics or pricing)
```

### AI Agent (First Time)
```
1. AI_RULES.md         (understand all rules)
2. structure.md        (understand organization)
3. database-schema.md  (if working with data)
4. design-system.md    (if working with UI)
5. Domain guide        (analytics-guide.md or pricing docs)
```

### AI Agent (Returning)
```
1. Check: What changed since last time?
2. Read: Relevant domain guide
3. Reference: troubleshooting.md if issues
```

## 📁 File Locations

### Root Level
```
/AI_RULES.md                    - Project constitution
/README.md                      - Project README
/DEPLOYMENT.md                  - Deployment guide
```

### Steering Files (.kiro/steering/)
```
/README.md                      - This file
/structure.md                   - Project organization
/tech.md                        - Technology stack
/product.md                     - Product overview
/design-system.md               - Design tokens and rules
/database-schema.md             - Database reference
/analytics-guide.md             - Analytics practical guide
/pricing-formulas.md            - Formula standards
/troubleshooting.md             - Common issues
```

### Analytics Documentation
```
/src/app/analytics/REFACTORING_SUMMARY.md
/src/app/analytics/queries/shared/*.ts (inline docs)
```

### Pricing Documentation
```
/src/lib/pricing/formulas/START_HERE.md
/src/lib/pricing/formulas/QUICK_REFERENCE.md
/src/lib/pricing/formulas/README.md
/src/lib/pricing/formulas/CONTRIBUTING.md
/src/lib/pricing/formulas/TEMPLATE.ts
```

## 🔍 Search Tips

**Looking for:**
- **Database queries?** → `database-schema.md`
- **UI colors/spacing?** → `design-system.md`
- **Analytics patterns?** → `analytics-guide.md`
- **Pricing formulas?** → `QUICK_REFERENCE.md`
- **File organization?** → `structure.md`
- **Error solutions?** → `troubleshooting.md`
- **Project rules?** → `AI_RULES.md`

## ✅ Documentation Quality Standards

All documentation in this project follows these standards:

1. **Practical examples** - Real code, not pseudocode
2. **Clear structure** - Easy to scan and find information
3. **Cross-references** - Links to related documentation
4. **Common pitfalls** - What NOT to do with explanations
5. **Quick reference** - Cheat sheets and checklists
6. **Up-to-date** - Reflects current codebase

## 🆘 Still Can't Find What You Need?

1. **Check AI_RULES.md** - Most comprehensive document
2. **Search codebase** - Look for similar existing code
3. **Check troubleshooting.md** - Common issues and solutions
4. **Read inline comments** - Shared utilities have detailed docs

## 📝 Contributing to Documentation

When adding/modifying documentation:

1. **Update this index** if adding new files
2. **Cross-reference** related documents
3. **Include examples** - Real code, not theory
4. **Add to troubleshooting** if solving a common issue
5. **Keep it practical** - Focus on "how to" not "what is"

---

**Last Updated:** After analytics refactoring and documentation enhancement
**Maintained By:** Project team and AI agents
**Purpose:** Help future developers and AI agents maintain perfect code quality

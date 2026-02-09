# Start Here - Pricing Formulas

**Quick orientation for AI agents and developers**

## 📚 Documentation (Read in Order)

1. **QUICK_REFERENCE.md** ← Start here (1 page, all formulas)
2. **README.md** ← Overview and examples
3. **CONTRIBUTING.md** ← How to add/modify formulas
4. **TEMPLATE.ts** ← Copy for new operations

## 🚨 Critical Rules

1. **NO magic numbers** → All in `src/config/constants.ts` → `PRICING_FORMULAS`
2. **Header block required** → Copy from existing files
3. **JSDoc + examples** → Every exported function
4. **Use TEMPLATE.ts** → For new operations

## ⚡ Quick Actions

**View all formulas:** `QUICK_REFERENCE.md`  
**Change constant:** `src/config/constants.ts`  
**Add operation:** Copy `TEMPLATE.ts`  
**Modify formula:** Try constants first

## ✅ Before Commit

- [ ] No magic numbers
- [ ] Header + JSDoc + examples
- [ ] `npm run lint` passes
- [ ] Tested in UI

**That's it!** Read QUICK_REFERENCE.md and you're ready to work.

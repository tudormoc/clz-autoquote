---
inclusion: manual
---

# Adding New Admin Tables

The admin panel uses a centralized configuration system. Adding a new table requires only 3 simple steps.

## Step 1: Create Manager Component

Create your table manager in `src/components/admin/YourTableManager.tsx`:

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { getYourDataAction } from '@/app/actions';
import { updateRecordAction, deleteRecordAction, insertRecordAction } from '@/app/admin-actions';

export function YourTableManager() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        const result = await getYourDataAction();
        setData(result);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Your table UI here...
    
    return <div>Your table manager UI</div>;
}
```

## Step 2: Register in Config

Add your table to `src/config/adminTables.ts`:

```typescript
// 1. Import your icon from lucide-react
import { Database } from 'lucide-react';

// 2. Import your manager component
import { YourTableManager } from '@/components/admin/YourTableManager';

// 3. Add to ADMIN_TABLES array
export const ADMIN_TABLES: AdminTableConfig[] = [
    // ... existing tables
    {
        id: 'your-table-id',
        label: 'Your Table Name',
        icon: Database,
        category: 'pricing', // or 'operations', 'clients', 'materials', 'other'
        description: 'Brief description of what this table manages'
    }
];

// 4. Add to MANAGER_COMPONENTS map
export const MANAGER_COMPONENTS: Record<string, React.ComponentType> = {
    // ... existing mappings
    'your-table-id': YourTableManager
};
```

## Step 3: Done!

That's it. Your table will automatically appear in the sidebar under the correct category.

## Categories

Available categories:
- `pricing` - Pricing rules, discounts, surcharges
- `operations` - Production operations, signatures, binding
- `clients` - Client management, contacts
- `materials` - Paper types, materials, inventory
- `other` - Everything else

## Best Practices

1. **Keep managers focused** - One table per manager component
2. **Use generic CRUD actions** - Leverage `updateRecordAction`, `deleteRecordAction`, `insertRecordAction`
3. **Follow naming conventions** - `YourTableManager.tsx` format
4. **Add loading states** - Always show loading indicators
5. **Handle errors gracefully** - Use try/catch and show user-friendly messages

## Example: Adding a "Paper Types" Table

```typescript
// In adminTables.ts
import { FileText } from 'lucide-react';
import { PaperTypesManager } from '@/components/admin/PaperTypesManager';

export const ADMIN_TABLES: AdminTableConfig[] = [
    // ... existing tables
    {
        id: 'paper-types',
        label: 'Paper Types',
        icon: FileText,
        category: 'materials',
        description: 'Manage available paper types and specifications'
    }
];

export const MANAGER_COMPONENTS: Record<string, React.ComponentType> = {
    // ... existing mappings
    'paper-types': PaperTypesManager
};
```

Done! The sidebar will automatically show "Paper Types" under the "Materials" category.

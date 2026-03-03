/**
 * Machine Configuration
 * 
 * Fetches machine codes (centri) and their production areas from NETPRO database.
 * This ensures data is always up-to-date with the database.
 * 
 * Sources:
 * - NETPRO.CENTRI table (CENTRO = machine code, REPARTO = area code, DESCRIZIONE = machine name)
 * - NETPRO.AREE table (area code and area name mapping)
 */

import { queryMSSQL } from '@/lib/mssql';

// Cache for machine data to avoid repeated DB queries
let machineAreasCache: Record<string, string> | null = null;
let machineNamesCache: Record<string, string> | null = null;

/**
 * Fetch all machines and their areas from database
 */
async function fetchMachineData(): Promise<void> {
  if (machineAreasCache && machineNamesCache) {
    return;
  }

  try {
    // First, fetch area code to area name mapping from AREE table
    const areaResult = await queryMSSQL(`
      SELECT 
        REPARTO as area_code,
        DESCRIZIONE as area_name
      FROM AREE WITH (NOLOCK)
      WHERE REPARTO IS NOT NULL
    `, {}, 'NETPRO');

    const areaNames: Record<string, string> = {};
    areaResult.recordset.forEach(row => {
      areaNames[row.area_code] = row.area_name;
    });

    // Then, fetch machines with their area codes
    const machineResult = await queryMSSQL(`
      SELECT 
        CENTRO as machine_code,
        REPARTO as area_code,
        DESCRIZIONE as machine_name
      FROM CENTRI WITH (NOLOCK)
      WHERE CENTRO IS NOT NULL
    `, {}, 'NETPRO');

    const areas: Record<string, string> = {};
    const names: Record<string, string> = {};

    machineResult.recordset.forEach(row => {
      const areaName = areaNames[row.area_code] || 'Unknown';
      areas[row.machine_code] = areaName;
      names[row.machine_code] = row.machine_name;
    });

    machineAreasCache = areas;
    machineNamesCache = names;
  } catch (error) {
    console.error('Failed to fetch machine data:', error);
    machineAreasCache = {};
    machineNamesCache = {};
  }
}

/**
 * Get area name for a machine code
 */
export async function getMachineArea(machineCode: string): Promise<string | undefined> {
  await fetchMachineData();
  return machineAreasCache?.[machineCode];
}

/**
 * Get machine name for a machine code
 */
export async function getMachineName(machineCode: string): Promise<string | undefined> {
  await fetchMachineData();
  return machineNamesCache?.[machineCode];
}

/**
 * Get all unique areas
 */
export async function getAllAreas(): Promise<string[]> {
  await fetchMachineData();
  return Array.from(new Set(Object.values(machineAreasCache || {}))).sort();
}

/**
 * Area Sort Order for Production Flow
 * Defines the logical order of production areas based on the 3-phase flow:
 * Phase 1: Parallel flows (Flow A: 10-40, Flow B: 10-40)
 * Phase 2: Assembly (50-60)
 * Phase 3: Finishing (70+)
 */
export const AREA_SORT_ORDER: Record<string, number> = {
  // Flow A: Block/Internal Production (10-40)
  'Taglio Carta': 10,
  'Piega': 20,
  'Raccolta': 30,
  'Cucitura': 40,
  
  // Flow B: Cover Production (10-40) - Same numbers as Flow A (parallel)
  'Taglio Cartone': 10,
  'Taglio Plancia': 20,
  'Copertine': 30,
  
  // Assembly Phase (50-60)
  'Messa in colla': 50,
  'Incassatura': 60,
  'Imbavatura': 65,
  
  // Finishing Phase (70+)
  'Accavallatura': 70,
  'Stampa a caldo': 75,
  'Finissaggio/lavori manuali': 80,
  'Lavorazione esterna': 90,
  'Generico': 100,
};

/**
 * Get sort order for a machine code
 * Returns the area's sort order, or 999 if not found
 */
export async function getMachineSortOrder(machineCode: string): Promise<number> {
  const area = await getMachineArea(machineCode);
  return area ? (AREA_SORT_ORDER[area] || 999) : 999;
}

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
        AREA as area_code,
        DESCRIZIONE as area_name
      FROM AREE WITH (NOLOCK)
      WHERE AREA IS NOT NULL
    `, {}, 'NETPRO');

    const areaNames: Record<string, string> = {};
    areaResult.recordset.forEach(row => {
      areaNames[row.area_code] = row.area_name;
    });

    // Then, fetch machines with their area codes
    const machineResult = await queryMSSQL(`
      SELECT 
        CENTRO as machine_code,
        AREA as area_code,
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

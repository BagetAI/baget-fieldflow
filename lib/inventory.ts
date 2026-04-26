
/**
 * FieldFlow Inventory Utility
 * Date: April 26, 2026
 * 
 * Provides centralized logic for FSMA 204 compliance and 
 * harvest data processing.
 */

export interface HarvestItem {
  produce_type: string;
  quantity_lbs: number;
  unit_price: number;
  status: 'In-Field' | 'Packed' | 'Ready';
}

/**
 * Generates a FSMA 204 compliant Lot Code.
 * Format: FF-[YYYYMMDD]-[FARMID-PREFIX]
 */
export function generateFsmaLotCode(farmId: string, timestamp: string = new Date().toISOString()): string {
  const datePart = timestamp.split('T')[0].replace(/-/g, '');
  const farmPart = farmId.substring(0, 4).toUpperCase();
  return `FF-${datePart}-${farmPart}`;
}

/**
 * Processes raw harvest items to ensure uniqueness within a batch.
 * Merges quantities for identical produce types.
 */
export function processUniqueHarvestItems(items: HarvestItem[]): HarvestItem[] {
  const uniqueMap = new Map<string, HarvestItem>();

  for (const item of items) {
    const key = item.produce_type.toLowerCase().trim();
    if (uniqueMap.has(key)) {
      const existing = uniqueMap.get(key)!;
      uniqueMap.set(key, {
        ...existing,
        quantity_lbs: existing.quantity_lbs + item.quantity_lbs,
        // Keep the lower price if they differ (arbitrage logic)
        unit_price: Math.min(existing.unit_price, item.unit_price)
      });
    } else {
      uniqueMap.set(key, { ...item });
    }
  }

  return Array.from(uniqueMap.values());
}

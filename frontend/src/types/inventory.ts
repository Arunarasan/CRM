// Central types for the Enterprise Inventory Management module.
// Mirrors backend com.arudra.crm.entity.{Product,Warehouse,InventoryCategory,InventoryItem,
// InventoryTransaction,StockTransfer,MaterialRequest,DamageEntry,PurchaseRequest,ProductSupplier}.

export interface EntityRef {
  id: number;
  name?: string;
  email?: string;
}

export interface InventoryCategory {
  id: number;
  name: string;
  description?: string;
  code?: string;
  parent?: { id: number; name?: string } | null;
}

export interface Warehouse {
  id: number;
  name: string;
  location?: string;
  managerName?: string;
}

export interface WarehouseStockSummary {
  warehouseId: number;
  warehouseName: string;
  location?: string;
  managerName?: string;
  availableStock: number;
  reservedStock: number;
  damagedStock: number;
  inTransitStock: number;
  itemCount: number;
}

export interface Product {
  id: number;
  name: string;
  sku?: string;
  barcode?: string;
  qrCode?: string;
  materialCode?: string;
  category?: { id: number; name?: string } | null;
  subCategory?: { id: number; name?: string } | null;
  unit?: string;
  brand?: string;
  model?: string;
  hsnCode?: string;
  gstPercent?: number;
  price?: number;
  costPrice?: number;
  sellingPrice?: number;
  purchasePrice?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderLevel?: number;
  leadTimeDays?: number;
  supplier?: EntityRef | null;
  defaultWarehouse?: EntityRef | null;
  imageUrl?: string;
  imageUrls?: string[];
  // Fabric / cloth specifications
  fabricComposition?: string;
  fabricWidth?: string;
  gsm?: number;
  pattern?: string;
  color?: string;
  colorFamily?: string;
  availableSizes?: string[];
  // Window suitability & design structure
  productType?: string;
  suitableWindowTypes?: string[];
  mountingType?: string;
  opacity?: string;
  suitableRooms?: string[];
  designStyle?: string;
  structureNotes?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export interface InventoryItem {
  id: number;
  product: Product;
  warehouse: Warehouse;
  quantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  inTransitQuantity: number;
  availableQuantity: number;
}

export type TransactionType =
  | "PURCHASE" | "CONSUMPTION" | "ADJUSTMENT" | "TRANSFER"
  | "RESERVATION" | "RELEASE" | "DAMAGE" | "OPENING" | "PROJECT_RETURN" | "SUPPLIER_RETURN";

export interface InventoryTransaction {
  id: number;
  product: Product;
  sourceWarehouse?: Warehouse;
  destinationWarehouse?: Warehouse;
  type: TransactionType;
  quantity: number;
  date: string;
  reference?: string;
  referenceType?: string;
  referenceId?: number;
  notes?: string;
}

export interface ProductAvailability {
  productId: number;
  productName: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  supplier?: string;
  brand?: string;
}

export interface InventoryDashboard {
  totalMaterials: number;
  availableStockValue: number;
  reservedStockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingPurchaseCount: number;
  todaysIssues: number;
  todaysReturns: number;
}

export type StockTransferStatus = "REQUESTED" | "APPROVED" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";

export interface StockTransferItem {
  id?: number;
  product: Product;
  quantity: number;
}

export interface StockTransfer {
  id: number;
  transferNumber: string;
  sourceWarehouse: Warehouse;
  destinationWarehouse: Warehouse;
  status: StockTransferStatus;
  requestedBy?: EntityRef;
  approvedBy?: EntityRef;
  notes?: string;
  items: StockTransferItem[];
  createdAt?: string;
}

export type MaterialRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "ISSUED";

export interface MaterialRequestItem {
  id?: number;
  product: Product;
  quantity: number;
  issuedQuantity: number;
}

export interface MaterialRequest {
  id: number;
  requestNumber: string;
  task?: { id: number; taskName?: string } | null;
  project?: { id: number; projectName?: string } | null;
  requestedBy?: EntityRef;
  warehouse?: Warehouse;
  status: MaterialRequestStatus;
  remarks?: string;
  approvedBy?: EntityRef;
  decidedAt?: string;
  items: MaterialRequestItem[];
  createdAt?: string;
}

export type DamageEntryStatus = "REPORTED" | "WRITTEN_OFF";

export interface DamageEntry {
  id: number;
  product: Product;
  warehouse: Warehouse;
  quantity: number;
  reason?: string;
  photoUrl?: string;
  responsiblePerson?: EntityRef;
  reportedBy?: EntityRef;
  status: DamageEntryStatus;
  createdAt?: string;
}

export type PurchaseRequestStatus = "PENDING" | "APPROVED" | "CONVERTED" | "REJECTED";

export interface PurchaseRequest {
  id: number;
  requestNumber: string;
  product: Product;
  warehouse: Warehouse;
  supplier?: EntityRef | null;
  quantity: number;
  reorderLevelSnapshot?: number;
  status: PurchaseRequestStatus;
  triggeredBy: "SYSTEM" | "MANUAL";
  notes?: string;
  createdAt?: string;
}

export interface ProductSupplier {
  id: number;
  supplier: EntityRef;
  purchasePrice?: number;
  leadTimeDays?: number;
  isPreferred: boolean;
  lastPurchaseDate?: string;
}

export const STOCK_ENTRY_TYPES = ["OPENING", "PURCHASE", "ADJUSTMENT", "PROJECT_RETURN", "SUPPLIER_RETURN", "CONSUMPTION", "TRANSFER"] as const;

export const INVENTORY_UNITS = [
  "Nos", "Piece", "Meter", "Running Feet", "Square Feet", "Square Meter",
  "Box", "Kg", "Gram", "Litre", "Bag", "Roll", "Sheet", "Bundle",
] as const;

// ---- Curtain / blind / fabric catalogue option sets (Material Master form) ----

export const PRODUCT_TYPES = [
  "Curtain", "Sheer Curtain", "Roman Blind", "Roller Blind", "Venetian Blind",
  "Vertical Blind", "Zebra / Day-Night Blind", "Wallpaper", "Upholstery Fabric",
  "Cushion / Soft Furnishing", "Curtain Hardware", "Accessory", "Other",
] as const;

export const FABRIC_WIDTHS = [
  '44 inch', '54 inch', '108 inch', '118 inch', '140 inch', '280 cm (drop)', 'Custom',
] as const;

export const FABRIC_PATTERNS = [
  "Plain / Solid", "Floral", "Geometric", "Stripes", "Abstract",
  "Jacquard", "Damask", "Textured", "Printed", "Embroidered",
] as const;

export const COLOR_FAMILIES = [
  "Neutrals", "Whites & Ivory", "Greys", "Blues", "Greens",
  "Earthy / Browns", "Reds & Maroons", "Yellows & Golds", "Pastels", "Dark / Blackout",
] as const;

export const CURTAIN_SIZES = [
  "Window (5 ft)", "Door (7 ft)", "Long Door (9 ft)", "Full Length (12 ft)", "Custom",
] as const;

export const WINDOW_TYPES = [
  "Standard", "Bay Window", "Sliding", "French Door", "Casement",
  "Skylight", "Picture / Large", "Arched", "Ventilator", "Balcony",
] as const;

export const MOUNTING_TYPES = [
  "Inside Mount", "Outside Mount", "Ceiling Mount", "Wall Track", "Rod / Pole",
] as const;

export const OPACITY_LEVELS = [
  "Sheer", "Semi-opaque", "Light Filtering", "Room Darkening", "Blackout",
] as const;

export const ROOM_TYPES = [
  "Living Room", "Bedroom", "Kids Room", "Kitchen", "Bathroom",
  "Dining", "Study / Office", "Pooja Room", "Balcony", "Commercial",
] as const;

export const DESIGN_STYLES = [
  "Modern", "Contemporary", "Classic", "Traditional", "Minimalist",
  "Luxury", "Bohemian", "Rustic", "Indian Ethnic",
] as const;

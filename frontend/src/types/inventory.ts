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

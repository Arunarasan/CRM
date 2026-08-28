import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Search, Plus, Filter, Download, Upload, Eye, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ResponsiveList, { type Column } from "@/components/ui/responsive-list";
import FilterSheet from "@/components/ui/filter-sheet";
import CustomerFormDialog from "./customers/CustomerFormDialog";
import { useNavigate } from "react-router-dom";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface CustomerProfileDTO {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  tags: {id: number, name: string}[];
}

const EMPTY_FILTERS = { name: "", city: "", email: "", phone: "", tag: "" };

function Tags({ tags }: { tags: CustomerProfileDTO["tags"] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {tags.map(tag => (
        <span key={tag.id} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">{tag.name}</span>
      ))}
    </div>
  );
}

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerProfileDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, filters]);

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page, filters]);

  const fetchCustomers = () => {
    setLoading(true);
    const params = new URLSearchParams({
      search: debouncedSearch,
      page: page.toString(),
      size: "10",
      ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ""))
    });

    api.get(`/customers?${params.toString()}`)
      .then(res => {
        setCustomers(res.data.content);
        setTotalPages(res.data.totalPages);
      })
      .catch(err => console.error("Failed to fetch customers", err))
      .finally(() => setLoading(false));
  };

  const handleExportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(customers.map(c => ({
      ID: c.id,
      Name: c.name,
      Email: c.email,
      Phone: c.phone,
      City: c.city,
      State: c.state,
      Tags: c.tags?.map(t => t.name).join(", ") || ""
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(workbook, "customers_export.xlsx");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Customers List", 14, 15);
    (doc as any).autoTable({
      head: [['ID', 'Name', 'Email', 'Phone', 'Location', 'Tags']],
      body: customers.map(c => [
        c.id, c.name, c.email, c.phone, `${c.city || ''} ${c.state || ''}`, c.tags?.map(t => t.name).join(", ") || ""
      ]),
      startY: 20
    });
    doc.save('customers_export.pdf');
  };

  const setFilter = (key: keyof typeof filters) => (value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const activeFilterCount = Object.values(filters).filter((v) => v !== "").length;

  const location = (c: CustomerProfileDTO) =>
    `${c.city || ""}${c.city && c.state ? ", " : ""}${c.state || ""}` || "—";

  const columns: Column<CustomerProfileDTO>[] = [
    { key: "name", header: "Name", cellClassName: "font-medium", cell: (c) => <span className="text-primary">{c.name}</span> },
    {
      key: "contact", header: "Contact", cell: (c) => (
        <div><div className="text-sm">{c.email}</div><div className="text-xs text-muted-foreground">{c.phone}</div></div>
      ),
    },
    { key: "location", header: "Location", cell: (c) => location(c) },
    { key: "tags", header: "Tags", cell: (c) => <Tags tags={c.tags} /> },
    {
      key: "actions", header: "", headClassName: "text-right", cellClassName: "text-right",
      cell: (c) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/customers/${c.id}`); }}>
          <Eye className="h-4 w-4 mr-1" /> Profile
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex flex-col h-full animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportExcel}><Download className="mr-2 h-4 w-4" /> Excel</Button>
          <Button variant="outline" onClick={handleExportPDF}><Download className="mr-2 h-4 w-4" /> PDF</Button>
          <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Import</Button>
          <Button onClick={() => setIsAddCustomerOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
        </div>
      </div>

      <CustomerFormDialog
        open={isAddCustomerOpen}
        onOpenChange={setIsAddCustomerOpen}
        onSaved={fetchCustomers}
      />

      {/* Search + filter toggle */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center space-x-2 bg-card p-1.5 rounded-lg border">
          <Search className="h-5 w-5 text-muted-foreground ml-2" />
          <Input
            placeholder="Search across all fields..."
            className="border-0 shadow-none focus-visible:ring-0 text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant={activeFilterCount > 0 ? "secondary" : "outline"} onClick={() => setShowFilters(true)}>
          <Filter className="mr-2 h-4 w-4" /> Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      <ResponsiveList
        items={customers}
        loading={loading}
        getRowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/customers/${c.id}`)}
        emptyIcon={Users}
        emptyTitle="No customers found"
        emptyDescription="No customers match your search or filters. Add your first customer to get started."
        emptyAction={<Button onClick={() => setIsAddCustomerOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>}
        columns={columns}
        renderCard={(c) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="font-medium text-primary truncate">{c.name}</div>
              {c.phone && <div className="text-sm text-muted-foreground">{c.phone}</div>}
              {c.email && <div className="text-sm text-muted-foreground truncate">{c.email}</div>}
              <div className="text-xs text-muted-foreground">{location(c)}</div>
              <Tags tags={c.tags} />
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          </div>
        )}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <FilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        activeCount={activeFilterCount}
        onClear={() => setFilters({ ...EMPTY_FILTERS })}
      >
        {([
          { label: "Name", key: "name" as const },
          { label: "Email", key: "email" as const },
          { label: "Phone", key: "phone" as const },
          { label: "City", key: "city" as const },
          { label: "Tag", key: "tag" as const },
        ]).map(({ label, key }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-sm font-medium">{label}</label>
            <Input value={filters[key]} onChange={(e) => setFilter(key)(e.target.value)} placeholder={`Filter by ${label.toLowerCase()}...`} />
          </div>
        ))}
      </FilterSheet>
    </div>
  );
}

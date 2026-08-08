import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Search, Plus, Filter, Download, Upload, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
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

export default function Customers() {
  const [customers, setCustomers] = useState<CustomerProfileDTO[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  
  const initialCustomerState = {
    name: "", email: "", phone: "", billingAddress: "", siteAddress: "", city: "", district: "", state: "", country: "", pincode: "", googleMapLocation: "", latitude: "", longitude: "", gstNumber: "",
    customerType: "Individual", companyName: "", contactPersonName: "", alternatePhone: "", whatsappNumber: "", website: "", panNumber: "", status: "Active"
  };
  const [newCustomer, setNewCustomer] = useState(initialCustomerState);
  
  // Advanced filters
  const [filters, setFilters] = useState({
    name: "",
    city: "",
    email: "",
    phone: "",
    tag: ""
  });

  useEffect(() => {
    fetchCustomers();
  }, [search, page, filters]);

  const fetchCustomers = () => {
    const params = new URLSearchParams({
      search,
      page: page.toString(),
      size: "10",
      ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ""))
    });
    
    api.get(`/customers?${params.toString()}`)
      .then(res => {
        setCustomers(res.data.content);
        setTotalPages(res.data.totalPages);
      })
      .catch(err => console.error("Failed to fetch customers", err));
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

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...newCustomer };
    if (!payload.email) payload.email = null as any;
    if (!payload.latitude) payload.latitude = null as any;
    if (!payload.longitude) payload.longitude = null as any;

    api.post("/customers", payload)
      .then(() => {
        setIsAddCustomerOpen(false);
        setNewCustomer(initialCustomerState);
        fetchCustomers();
      })
      .catch(err => console.error("Failed to create customer", err));
  };

  return (
    <div className="p-8 space-y-6 flex flex-col h-full animate-in fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportExcel}><Download className="mr-2 h-4 w-4" /> Excel</Button>
          <Button variant="outline" onClick={handleExportPDF}><Download className="mr-2 h-4 w-4" /> PDF</Button>
          <Button variant="outline"><Upload className="mr-2 h-4 w-4" /> Import</Button>
          <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Customer</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateCustomer} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Customer Type</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={newCustomer.customerType} 
                      onChange={e => setNewCustomer({...newCustomer, customerType: e.target.value})}
                    >
                      <option value="Individual">Individual</option>
                      <option value="Business">Business</option>
                      <option value="Builder">Builder</option>
                      <option value="Architect">Architect</option>
                      <option value="Contractor">Contractor</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={newCustomer.status} 
                      onChange={e => setNewCustomer({...newCustomer, status: e.target.value})}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Blacklisted">Blacklisted</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Customer Name *</label>
                    <Input required value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Company Name</label>
                    <Input value={newCustomer.companyName} onChange={e => setNewCustomer({...newCustomer, companyName: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contact Person</label>
                    <Input value={newCustomer.contactPersonName} onChange={e => setNewCustomer({...newCustomer, contactPersonName: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input type="email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mobile Number *</label>
                    <Input required value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Alternate Mobile</label>
                    <Input value={newCustomer.alternatePhone} onChange={e => setNewCustomer({...newCustomer, alternatePhone: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">WhatsApp Number</label>
                    <Input value={newCustomer.whatsappNumber} onChange={e => setNewCustomer({...newCustomer, whatsappNumber: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Website</label>
                    <Input value={newCustomer.website} onChange={e => setNewCustomer({...newCustomer, website: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">GST Number</label>
                    <Input value={newCustomer.gstNumber} onChange={e => setNewCustomer({...newCustomer, gstNumber: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">PAN Number</label>
                    <Input value={newCustomer.panNumber} onChange={e => setNewCustomer({...newCustomer, panNumber: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Billing Address</label>
                    <Input value={newCustomer.billingAddress} onChange={e => setNewCustomer({...newCustomer, billingAddress: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Site Address</label>
                    <Input value={newCustomer.siteAddress} onChange={e => setNewCustomer({...newCustomer, siteAddress: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <Input value={newCustomer.city} onChange={e => setNewCustomer({...newCustomer, city: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">District</label>
                    <Input value={newCustomer.district} onChange={e => setNewCustomer({...newCustomer, district: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">State</label>
                    <Input value={newCustomer.state} onChange={e => setNewCustomer({...newCustomer, state: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Country</label>
                    <Input value={newCustomer.country} onChange={e => setNewCustomer({...newCustomer, country: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Pincode</label>
                    <Input value={newCustomer.pincode} onChange={e => setNewCustomer({...newCustomer, pincode: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Google Map Location</label>
                    <Input value={newCustomer.googleMapLocation} onChange={e => setNewCustomer({...newCustomer, googleMapLocation: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Latitude</label>
                    <Input type="number" step="any" value={newCustomer.latitude} onChange={e => setNewCustomer({...newCustomer, latitude: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Longitude</label>
                    <Input type="number" step="any" value={newCustomer.longitude} onChange={e => setNewCustomer({...newCustomer, longitude: e.target.value})} />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit">Save Customer</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Main Content */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center space-x-2 bg-card p-2 rounded-lg border">
              <Search className="h-5 w-5 text-muted-foreground ml-2" />
              <Input 
                placeholder="Search across all fields..." 
                className="border-0 shadow-none focus-visible:ring-0 text-base"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant={showFilters ? "secondary" : "outline"} onClick={() => setShowFilters(!showFilters)}>
              <Filter className="mr-2 h-4 w-4" /> Filters
            </Button>
          </div>

          <div className="border rounded-xl bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Link to={`/customers/${customer.id}`} className="hover:underline text-primary">
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{customer.email}</div>
                      <div className="text-xs text-muted-foreground">{customer.phone}</div>
                    </TableCell>
                    <TableCell>
                      {customer.city}{customer.city && customer.state ? ', ' : ''}{customer.state}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {customer.tags?.map(tag => (
                          <span key={tag.id} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={`/customers/${customer.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" /> Profile
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {customers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No customers found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          )}
        </div>

        {/* Sidebar Filters */}
        {showFilters && (
          <div className="w-80 space-y-4 border rounded-xl p-4 bg-card animate-in slide-in-from-right-8">
            <h3 className="font-semibold text-lg border-b pb-2">Advanced Filters</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={filters.name} onChange={e => setFilters({...filters, name: e.target.value})} placeholder="Filter by name..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input value={filters.email} onChange={e => setFilters({...filters, email: e.target.value})} placeholder="Filter by email..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone</label>
                <Input value={filters.phone} onChange={e => setFilters({...filters, phone: e.target.value})} placeholder="Filter by phone..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">City</label>
                <Input value={filters.city} onChange={e => setFilters({...filters, city: e.target.value})} placeholder="Filter by city..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tag</label>
                <Input value={filters.tag} onChange={e => setFilters({...filters, tag: e.target.value})} placeholder="Filter by tag..." />
              </div>
              <Button className="w-full" variant="outline" onClick={() => setFilters({name: "", city: "", email: "", phone: "", tag: ""})}>
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

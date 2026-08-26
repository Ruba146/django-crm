"use client";

/**
 * INTERNAL DEVELOPMENT-ONLY component.
 *
 * This is NOT part of the application routing. It exists so the reusable
 * Design System can be visually verified during development. Import it from
 * a page temporarily, review, then remove the import. It is never shipped
 * to production screens.
 */

import { useState, type ReactNode } from "react";
import {
  Bell,
  Mail,
  Search,
  Settings,
  TriangleAlert,
  User,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  DataTable,
  Dialog,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  EmptyState,
  Input,
  Loading,
  Modal,
  Pagination,
  SearchInput,
  Select,
  SkeletonCard,
  SkeletonRows,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
} from "@/components/ui";
import {
  useTableFiltering,
  useTablePagination,
  useTableSorting,
} from "@/hooks";

interface DemoRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

const DEMO_ROWS: DemoRow[] = [
  { id: "1", name: "Aisha Rahman", email: "aisha@example.com", role: "Admin", status: "Active" },
  { id: "2", name: "Omar Khaled", email: "omar@example.com", role: "Sales", status: "Away" },
  { id: "3", name: "Lina Haddad", email: "lina@example.com", role: "Support", status: "Active" },
  { id: "4", name: "Yousef Nasser", email: "yousef@example.com", role: "Manager", status: "Offline" },
  { id: "5", name: "Sara Ali", email: "sara@example.com", role: "Sales", status: "Active" },
  { id: "6", name: "Khalid Sami", email: "khalid@example.com", role: "Engineer", status: "Active" },
  { id: "7", name: "Noor Aziz", email: "noor@example.com", role: "Designer", status: "Away" },
  { id: "8", name: "Huda Mahmoud", email: "huda@example.com", role: "Support", status: "Offline" },
  { id: "9", name: "Tariq Fawzi", email: "tariq@example.com", role: "Sales", status: "Active" },
  { id: "10", name: "Maya Georges", email: "maya@example.com", role: "Ops", status: "Active" },
];

/** Small helper to wrap a demo section. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function DesignSystemPreview() {
  const [tab, setTab] = useState("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [switchOn, setSwitchOn] = useState(true);
  const [checked, setChecked] = useState(false);
  const [search, setSearch] = useState("");

  // Table demo wiring uses the reusable hooks.
  const { query, setQuery, filteredData } = useTableFiltering(DEMO_ROWS, {
    searchKeys: ["name", "email", "role"],
  });
  const { sort, toggleSort, sortedData } = useTableSorting(filteredData, {
    initialSort: { columnId: "name", direction: "asc" },
  });
  const { pageItems, page, totalPages, goToPage } = useTablePagination(sortedData, {
    pageSize: 5,
  });

  const columns = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      cell: (r: DemoRow) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.name} size="sm" />
          <span className="font-medium">{r.name}</span>
        </div>
      ),
    },
    { id: "email", header: "Email", cell: (r: DemoRow) => r.email },
    { id: "role", header: "Role", sortable: true, cell: (r: DemoRow) => r.role },
    {
      id: "status",
      header: "Status",
      cell: (r: DemoRow) => (
        <Badge variant={r.status === "Active" ? "success" : r.status === "Away" ? "warning" : "neutral"}>
          {r.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Design System</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Internal preview of the reusable UI library. Not part of application routing.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="table">Data Table</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-8">
            <Section title="Buttons">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
                <Button size="sm">Small</Button>
                <Button size="lg">Large</Button>
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
              </div>
            </Section>

            <Section title="Badges">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="info">Info</Badge>
                <Badge variant="neutral">Neutral</Badge>
                <Badge variant="primary">Primary</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
            </Section>

            <Section title="Avatars">
              <div className="flex flex-wrap items-center gap-4">
                {["Aisha Rahman", "Omar Khaled", "Lina Haddad", "Yousef Nasser"].map((n, i) => (
                  <Avatar key={n} name={n} size={["sm", "md", "lg", "xl"][i] as "sm"} />
                ))}
                <Avatar src="https://i.pravatar.cc/80?img=5" name="User 5" size="lg" />
              </div>
            </Section>

            <Section title="Dropdown">
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="outline">
                    <Settings className="size-4" /> Menu
                  </Button>
                </DropdownTrigger>
                <DropdownContent>
                  <DropdownItem onClick={() => {}}>
                    <User className="size-4" /> Profile
                  </DropdownItem>
                  <DropdownItem onClick={() => {}}>
                    <Settings className="size-4" /> Settings
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem onClick={() => {}}>
                    <Bell className="size-4" /> Notifications
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
            </Section>

            <Section title="Tooltip, Modal & Dialog">
              <div className="flex flex-wrap items-center gap-3">
                <Tooltip label="This is a tooltip">
                  <Button variant="outline">Hover for tooltip</Button>
                </Tooltip>
                <Button variant="outline" onClick={() => setModalOpen(true)}>
                  Open Modal
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  Open Dialog
                </Button>
              </div>
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="forms">
          <div className="space-y-8">
            <Section title="Inputs">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Full name" placeholder="Jane Doe" helper="As it appears on your ID" />
                <Input label="Email" placeholder="you@example.com" type="email" error="Please enter a valid email" />
                <Input label="Phone" placeholder="+1 555 000 0000" />
                <Select
                  label="Country"
                  placeholder="Choose a country"
                  options={[
                    { value: "sa", label: "Saudi Arabia" },
                    { value: "ae", label: "UAE" },
                    { value: "eg", label: "Egypt" },
                  ]}
                />
                <Textarea label="Notes" placeholder="Write a note…" helper="Optional" />
              </div>
            </Section>

            <Section title="Search & Toggles">
              <div className="grid gap-6 sm:grid-cols-2">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search…"
                  label="Search"
                />
                <div className="space-y-4">
                  <Switch
                    checked={switchOn}
                    onCheckedChange={setSwitchOn}
                    label="Enable notifications"
                    helper={switchOn ? "Notifications on" : "Notifications off"}
                  />
                  <Checkbox
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    label="I agree to the terms"
                    helper="Required to continue"
                  />
                </div>
              </div>
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="feedback">
          <div className="space-y-8">
            <Section title="Loading & Skeletons">
              <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-6">
                <Loading label="Loading…" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SkeletonCard />
                <SkeletonCard />
              </div>
              <SkeletonRows rows={4} />
            </Section>

            <Section title="Empty State">
              <EmptyState
                title="No data found"
                description="Try adjusting your filters or create a new record."
                action={<Button size="sm">Create</Button>}
              />
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Data Table</CardTitle>
              <CardDescription>
                Demonstrates the generic DataTable wired to the sorting, filtering and pagination hooks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={pageItems}
                rowKey={(r) => r.id}
                sort={sort}
                onSortChange={toggleSort}
                toolbar={
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <SearchInput
                      value={query}
                      onChange={setQuery}
                      placeholder="Search name, email, role…"
                      className="sm:max-w-xs"
                    />
                    <Button size="sm" variant="outline">
                      <Mail className="size-4" /> Export
                    </Button>
                  </div>
                }
                emptyState={{
                  title: "No results",
                  description: "No rows match your search.",
                  icon: <Search className="size-6" />,
                }}
                footer={
                  <div className="flex items-center justify-end">
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      onPageChange={goToPage}
                    />
                  </div>
                }
              />
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
              Showing {pageItems.length} of {DEMO_ROWS.length} demo rows.
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Edit record" description="This is a reusable modal.">
        <div className="space-y-3">
          <Input label="Name" placeholder="Enter name" />
          <Input label="Email" placeholder="you@example.com" />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setModalOpen(false)}>Save</Button>
        </div>
      </Modal>

      {/* Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Delete this record?"
        description="This action cannot be undone. The record will be permanently removed."
        icon={<TriangleAlert className="size-6" />}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setDialogOpen(false)}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useSheets } from '@/context/SheetsContext';
import { Button } from '../ui/button';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { postToSheet } from '@/lib/fetchers';
import { PackageCheck } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Pill } from '../ui/pill';
import { DownloadOutlined } from "@ant-design/icons";
import * as XLSX from 'xlsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface StoreOutTableData {
    issueNo: string;
    issueDate: string;
    requestedBy: string;
    department: string;
    product: string;
    qty: number;
    unit: string;
    status: string;
    planned: string;
    actual: string;
    approveQty: number;
    indenterName: string;
    indentType: string;
    floor: string;
    wardName: string;
    category: string;
    areaOfUse: string;
    // Helper for update
    originalRow: any;
}

export default () => {
    const { storeOutSheet, indentLoading, updateStoreOutSheet } = useSheets();
    const { user } = useAuth();
    const [openDialog, setOpenDialog] = useState(false);
    const [tableData, setTableData] = useState<StoreOutTableData[]>([]);
    const [historyData, setHistoryData] = useState<StoreOutTableData[]>([]);
    const [selectedItem, setSelectedItem] = useState<StoreOutTableData | null>(null);
    const [loading, setLoading] = useState(false);

    // Fetching table data
    useEffect(() => {
        console.log("=== Store Out Approval Debug ===");
        console.log("storeOutSheet:", storeOutSheet);
        console.log("storeOutSheet length:", storeOutSheet?.length);

        if (!storeOutSheet) {
            console.log("storeOutSheet is null/undefined");
            return;
        }

        // Pending: Planned (Col L) is NOT NULL && Actual (Col M) is NULL
        const pending = storeOutSheet
            .filter((row) => {
                // Adjust filter logic based on your exact requirement for 'Pending'
                // For now, assuming Pending means status is empty or not Approved/Rejected
                return !row.status || (row.status !== 'Approved' && row.status !== 'Rejected');
            })
            .map(mapRowToTableData);

        // History: Status is Approved or Rejected
        const history = storeOutSheet
            .filter((row) => row.status === 'Approved' || row.status === 'Rejected')
            .map(mapRowToTableData);

        console.log("Pending items:", pending);
        console.log("History items:", history);

        setTableData(pending);
        setHistoryData(history);
    }, [storeOutSheet]);

    const mapRowToTableData = (row: any): StoreOutTableData => ({
        issueNo: row.issueNo || row['Issue No'],
        issueDate: formatDate(new Date(row.issueDate || row['Issue Date'])),
        requestedBy: row.requestedBy || row['Requested By'],
        department: row.department || row['Department'],
        product: row.productName || row['Product Name'],
        qty: Number(row.qty || row['Qty'] || row.quantity || 0),
        unit: row.unit || row['Unit'],
        status: row.status || '',
        planned: row.planned || '',
        actual: row.actual || '',
        approveQty: Number(row.approveQty || 0),
        indenterName: row.indenterName || row['Indenter Name'] || '',
        indentType: row.indentType || row['Indent Type'] || '',
        floor: row.floor || row['Floor'] || '',
        wardName: row.wardName || row['Ward Name'] || '',
        category: row.category || row['Category'] || '',
        areaOfUse: row.areaOfUse || row['Area Of Use'] || '',
        originalRow: row
    });

    const onDownloadClick = async () => {
        setLoading(true);
        try {
            const workbook = XLSX.utils.book_new();
            const worksheetData = tableData.map(item => ({
                'Issue No.': item.issueNo,
                'Requested By': item.requestedBy,
                'Department': item.department,
                'Item': item.product,
                'Date': item.issueDate,
                'Quantity': item.qty,
                'Unit': item.unit,
            }));
            const worksheet = XLSX.utils.json_to_sheet(worksheetData);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Store Out Pending');
            XLSX.writeFile(workbook, `Store_Out_Pending_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success('Excel file downloaded successfully!');
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download Excel file');
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnDef<StoreOutTableData>[] = [
        {
            id: 'actions',
            header: 'Action',
            cell: ({ row }) => (
                <Button
                    size="sm"
                    onClick={() => {
                        setSelectedItem(row.original);
                        setOpenDialog(true);
                    }}
                >
                    Action
                </Button>
            )
        },
        {
            accessorKey: 'issueNo',
            header: 'Issue No.',
            cell: ({ row }) => (
                <span className="font-medium">
                    {row.getValue('issueNo')}
                </span>
            )
        },
        { accessorKey: 'issueDate', header: 'Date' },
        { accessorKey: 'requestedBy', header: 'Requested By' },
        { accessorKey: 'floor', header: 'Floor' },
        { accessorKey: 'wardName', header: 'Ward Name' },
        { accessorKey: 'qty', header: 'Qty' },
        { accessorKey: 'unit', header: 'Unit' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'category', header: 'Category' },
        { accessorKey: 'areaOfUse', header: 'Area Of Use' },
    ];

    const historyColumns: ColumnDef<StoreOutTableData>[] = [
        { accessorKey: 'issueNo', header: 'Issue No.' },
        { accessorKey: 'issueDate', header: 'Request Date' },
        { accessorKey: 'actual', header: 'Approval Date', cell: ({ row }) => row.original.actual ? formatDate(new Date(row.original.actual)) : '-' },
        { accessorKey: 'requestedBy', header: 'Requested By' },
        { accessorKey: 'floor', header: 'Floor' },
        { accessorKey: 'wardName', header: 'Ward Name' },
        { accessorKey: 'qty', header: 'Req Qty' },
        { accessorKey: 'unit', header: 'Unit' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'category', header: 'Category' },
        { accessorKey: 'areaOfUse', header: 'Area Of Use' },
        { accessorKey: 'approveQty', header: 'Approve Qty' },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status;
                const variant = status === 'Rejected' ? 'reject' : 'secondary';
                return <Pill variant={variant}>{status}</Pill>;
            }
        },
    ];

    const schema = z.object({
        status: z.string().nonempty('Status is required'),
        approveQty: z.coerce.number().min(0, 'Quantity cannot be negative'),
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            status: '',
            approveQty: 0,
        },
    });

    useEffect(() => {
        if (selectedItem) {
            form.reset({
                status: '',
                approveQty: selectedItem.qty, // Default to requested qty
            });
        }
    }, [selectedItem]);

    async function onSubmit(values: z.infer<typeof schema>) {
        if (!selectedItem) return;

        // Format date as DD/MM/YYYY HH:mm:ss
        const now = new Date();
        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const year = now.getFullYear();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

        // Exclude 'planned' from the payload
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { planned, ...restOfRow } = selectedItem.originalRow;

        try {
            await postToSheet(
                [{
                    ...restOfRow,
                    actual: formattedDate,           // Column M
                    status: values.status,           // Column R
                    approveQty: values.approveQty,   // Column S
                }],
                'update',
                'STORE OUT'
            );

            toast.success(`Store Out Request ${values.status}!`);
            setOpenDialog(false);
            form.reset();
            setTimeout(() => updateStoreOutSheet(), 1000);
        } catch (e) {
            console.error(e);
            toast.error('Failed to update request');
        }
    }

    return (
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <Tabs defaultValue="pending">
                <Heading heading="Store Out Approval" subtext="Approve store out requests" tabs>
                    <PackageCheck size={50} className="text-primary" />
                </Heading>
                <TabsContent value="pending">
                    <DataTable
                        data={tableData}
                        columns={columns}
                        searchFields={['product', 'department', 'requestedBy', 'issueNo']}
                        dataLoading={indentLoading}
                        extraActions={
                            <Button
                                variant="default"
                                onClick={onDownloadClick}
                                style={{
                                    background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "0 16px",
                                    fontWeight: "bold",
                                    boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                            >
                                <DownloadOutlined />
                                {loading ? "Downloading..." : "Download"}
                            </Button>
                        }
                    />
                </TabsContent>
                <TabsContent value="history">
                    <DataTable
                        data={historyData}
                        columns={historyColumns}
                        searchFields={['product', 'department', 'requestedBy', 'issueNo']}
                        dataLoading={indentLoading}
                    />
                </TabsContent>
            </Tabs>

            {selectedItem && (
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Approve Request</DialogTitle>
                        <DialogDescription>
                            Review details for Issue No: {selectedItem.issueNo}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-4 text-sm">
                        <div className="col-span-2 grid grid-cols-2 gap-4 border-b pb-4">
                            <div>
                                <span className="font-semibold block text-xs text-muted-foreground">Department</span>
                                {selectedItem.department}
                            </div>
                            <div>
                                <span className="font-semibold block text-xs text-muted-foreground">Issue No</span>
                                {selectedItem.issueNo}
                            </div>
                        </div>

                        <div className="col-span-2 grid grid-cols-2 gap-4 border-b pb-4">
                            <div>
                                <span className="font-semibold block text-xs text-muted-foreground">Indenter Name</span>
                                {selectedItem.indenterName}
                            </div>
                            <div>
                                <span className="font-semibold block text-xs text-muted-foreground">Indent Type</span>
                                {selectedItem.indentType}
                            </div>
                        </div>

                        <div className="col-span-2 border-b pb-4">
                            <span className="font-semibold block text-xs text-muted-foreground">Qty</span>
                            <span className="text-lg font-bold text-primary">{selectedItem.qty}</span>
                        </div>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Approved">Approved</SelectItem>
                                                <SelectItem value="Rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="approveQty"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Approved Quantity</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? <Loader size={16} color="white" /> : 'Submit'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            )}
        </Dialog>
    );
};

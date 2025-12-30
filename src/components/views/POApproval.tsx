import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog';
import type { ColumnDef } from '@tanstack/react-table';
import { useSheets } from '@/context/SheetsContext';
import { Button } from '../ui/button';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { postToSheet } from '@/lib/fetchers';
import { PackageCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Pill } from '../ui/pill';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface PoTableData {
    partyName: string;
    poNumber: string;
    quotationNumber: string;
    quotationDate: string;
    enquiryNumber: string;
    enquiryDate: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gstPercent: number;
    discountPercent: number;
    amount: number;
    totalPoAmount: number;
    preparedBy: string;
    approvedBy: string;
    pdf: string;
    term1: string;
    term2: string;
    term3: string;
    term4: string;
    term5: string;
    term6: string;
    term7: string;
    term8: string;
    term9: string;
    term10: string;
    status: string;
    actual: string;
    originalRow: any;
}

export default () => {
    const { poMasterSheet, updatePoMasterSheet, poMasterLoading } = useSheets();
    const [openDialog, setOpenDialog] = useState(false);
    const [tableData, setTableData] = useState<PoTableData[]>([]);
    const [historyData, setHistoryData] = useState<PoTableData[]>([]);
    const [selectedItem, setSelectedItem] = useState<PoTableData | null>(null);
    const [loading, setLoading] = useState(false);

    const getV = (row: any, ...keys: string[]) => {
        if (!row || typeof row !== 'object') return '';
        const rowKeys = Object.keys(row);

        for (const key of keys) {
            // 1. Exact match
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];

            // 2. Normalized match (ignore spaces, underscores, case)
            const normalizedTarget = key.toLowerCase().replace(/[\s_%-]/g, '');
            const match = rowKeys.find(k => k.toLowerCase().replace(/[\s_%-]/g, '') === normalizedTarget);
            if (match && row[match] !== undefined && row[match] !== null && row[match] !== '') return row[match];
        }
        return '';
    };

    const mapRowToTableData = (row: any): PoTableData => ({
        partyName: String(getV(row, 'Party Name', 'partyName', 'party') || ''),
        poNumber: String(getV(row, 'PO Number', 'poNumber', 'ponumber') || ''),
        quotationNumber: String(getV(row, 'Quotation Number', 'quotationNumber') || ''),
        quotationDate: getV(row, 'Quotation Date', 'quotationDate') ? formatDate(new Date(getV(row, 'Quotation Date', 'quotationDate'))) : '',
        enquiryNumber: String(getV(row, 'Enquiry Number', 'enquiryNumber') || ''),
        enquiryDate: getV(row, 'Enquiry Date', 'enquiryDate') ? formatDate(new Date(getV(row, 'Enquiry Date', 'enquiryDate'))) : '',
        internalCode: String(getV(row, 'Internal Code', 'internalCode') || ''),
        product: String(getV(row, 'Product', 'product', 'productname') || ''),
        description: String(getV(row, 'Description', 'description') || ''),
        quantity: Number(getV(row, 'Quantity', 'quantity') || 0),
        unit: String(getV(row, 'Unit', 'unit', 'uom') || ''),
        rate: Number(getV(row, 'Rate', 'rate') || 0),
        gstPercent: Number(getV(row, 'GST %', 'gstPercent', 'gst') || 0),
        discountPercent: Number(getV(row, 'Discount %', 'discountPercent', 'discount') || 0),
        amount: Number(getV(row, 'Amount', 'amount') || 0),
        totalPoAmount: Number(getV(row, 'Total PO Amount', 'totalPoAmount') || 0),
        preparedBy: String(getV(row, 'Prepared By', 'preparedBy') || ''),
        approvedBy: String(getV(row, 'Approved By', 'approvedBy') || ''),
        pdf: String(getV(row, 'PDF', 'pdf') || ''),
        term1: String(getV(row, 'Term 1', 'term1') || ''),
        term2: String(getV(row, 'Term 2', 'term2') || ''),
        term3: String(getV(row, 'Term 3', 'term3') || ''),
        term4: String(getV(row, 'Term 4', 'term4') || ''),
        term5: String(getV(row, 'Term 5', 'term5') || ''),
        term6: String(getV(row, 'Term 6', 'term6') || ''),
        term7: String(getV(row, 'Term 7', 'term7') || ''),
        term8: String(getV(row, 'Term 8', 'term8') || ''),
        term9: String(getV(row, 'Term 9', 'term9') || ''),
        term10: String(getV(row, 'Term 10', 'term10') || ''),
        status: String(getV(row, 'Status', 'status') || ''),
        actual: String(getV(row, 'Actual', 'actual') || ''),
        originalRow: row
    });

    useEffect(() => {
        if (!poMasterSheet) return;

        // Filter: Keep ANY row that has at least one value
        const validRows = poMasterSheet.filter(row => {
            return Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
        });

        // Pending: Actual date is empty
        const pending = validRows
            .filter((row) => {
                const actualValue = getV(row, 'Actual', 'actual');
                return !actualValue || String(actualValue).trim() === '';
            })
            .map(mapRowToTableData);

        // History: Actual date is NOT empty
        const history = validRows
            .filter((row) => {
                const actualValue = getV(row, 'Actual', 'actual');
                return actualValue && String(actualValue).trim() !== '';
            })
            .map(mapRowToTableData);

        setTableData(pending);
        setHistoryData(history);
    }, [poMasterSheet]);

    const columns: ColumnDef<PoTableData>[] = [
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
        { accessorKey: 'partyName', header: 'Party Name' },
        { accessorKey: 'poNumber', header: 'PO Number' },
        { accessorKey: 'quotationNumber', header: 'Quotation Number' },
        { accessorKey: 'quotationDate', header: 'Quotation Date' },
        { accessorKey: 'enquiryNumber', header: 'Enquiry Number' },
        { accessorKey: 'enquiryDate', header: 'Enquiry Date' },
        { accessorKey: 'internalCode', header: 'Internal Code' },
        { accessorKey: 'product', header: 'Product' },
        { accessorKey: 'description', header: 'Description' },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'unit', header: 'Unit' },
        { accessorKey: 'rate', header: 'Rate' },
        { accessorKey: 'gstPercent', header: 'GST %' },
        { accessorKey: 'discountPercent', header: 'Discount %' },
        { accessorKey: 'amount', header: 'Amount' },
        { accessorKey: 'totalPoAmount', header: 'Total PO Amount' },
        { accessorKey: 'preparedBy', header: 'Prepared By' },
        { accessorKey: 'approvedBy', header: 'Approved By' },
        { accessorKey: 'pdf', header: 'PDF' },
        { accessorKey: 'term1', header: 'Term 1' },
        { accessorKey: 'term2', header: 'Term 2' },
        { accessorKey: 'term3', header: 'Term 3' },
        { accessorKey: 'term4', header: 'Term 4' },
        { accessorKey: 'term5', header: 'Term 5' },
        { accessorKey: 'term6', header: 'Term 6' },
        { accessorKey: 'term7', header: 'Term 7' },
        { accessorKey: 'term8', header: 'Term 8' },
        { accessorKey: 'term9', header: 'Term 9' },
        { accessorKey: 'term10', header: 'Term 10' },
    ];

    const historyColumns: ColumnDef<PoTableData>[] = [
        ...columns.filter(c => c.id !== 'actions'),
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.original.status;
                const variant = status === 'Rejected' ? 'reject' : status === 'Approved' ? 'primary' : 'secondary';
                return <Pill variant={variant}>{status}</Pill>;
            }
        },
    ];

    const schema = z.object({
        status: z.string().nonempty('Status is required'),
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            status: '',
        },
    });

    useEffect(() => {
        if (openDialog) {
            form.reset({
                status: '',
            });
        }
    }, [openDialog, form]);


    async function onSubmit(values: z.infer<typeof schema>) {
        if (!selectedItem) return;

        // Format date as DD/MM/YYYY HH:mm:ss
        const formattedDate = formatDate(new Date());

        // Exclude 'planned' from payload if needed, similar to StoreOut logic but for PO Master
        const { planned, ...restOfRow } = selectedItem.originalRow;

        try {
            await postToSheet(
                [{
                    rowIndex: (selectedItem.originalRow as any).rowIndex,
                    actual: formattedDate,           // Column AG
                    status: values.status,           // Column AI
                }],
                'update',
                'PO MASTER'
            );

            toast.success('Submitted successfully');
            setOpenDialog(false);
            // Refresh data
            updatePoMasterSheet();
        } catch (error) {
            console.error(error);
            toast.error('Failed to submit');
        }
    }

    if (poMasterLoading) return <div className="h-screen w-full grid place-items-center"><Loader color="red" /></div>;

    return (
        <div className="flex flex-col gap-5 h-full">
            <Heading
                heading="PO Approval"
                subtext="Approve or Reject Purchase Orders"
            >
                <PackageCheck size={50} className="text-primary" />
            </Heading>

            <Tabs defaultValue="pending" className="w-full h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="pending">Pending ({tableData.length})</TabsTrigger>
                    <TabsTrigger value="history">History ({historyData.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="flex-1 overflow-auto">
                    <DataTable columns={columns} data={tableData} searchFields={['partyName', 'poNumber']} />
                </TabsContent>

                <TabsContent value="history" className="flex-1 overflow-auto">
                    <DataTable columns={historyColumns} data={historyData} searchFields={['partyName', 'poNumber']} />
                </TabsContent>
            </Tabs>

            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Approve PO</DialogTitle>
                    </DialogHeader>
                    {selectedItem && (
                        <div className="grid grid-cols-2 gap-4 py-4 text-sm">
                            <div className="col-span-2 grid grid-cols-2 gap-4 border-b pb-4">
                                <div>
                                    <span className="font-semibold block text-xs text-muted-foreground">Party Name</span>
                                    {selectedItem.partyName}
                                </div>
                                <div>
                                    <span className="font-semibold block text-xs text-muted-foreground">PO Number</span>
                                    {selectedItem.poNumber}
                                </div>
                            </div>
                            <div className="col-span-2 grid grid-cols-2 gap-4 border-b pb-4">
                                <div>
                                    <span className="font-semibold block text-xs text-muted-foreground">Product</span>
                                    {selectedItem.product}
                                </div>
                                <div>
                                    <span className="font-semibold block text-xs text-muted-foreground">Quantity</span>
                                    {selectedItem.quantity} {selectedItem.unit}
                                </div>
                            </div>
                            <div className="col-span-2 border-b pb-4">
                                <span className="font-semibold block text-xs text-muted-foreground">Total PO Amount</span>
                                <span className="text-lg font-bold text-primary">{selectedItem.totalPoAmount}</span>
                            </div>

                            <div className="col-span-2 pt-4">
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
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <div className="flex justify-end gap-2 pt-4">
                                            <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
                                            <Button type="submit">Submit</Button>
                                        </div>
                                    </form>
                                </Form>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

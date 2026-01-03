import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState } from 'react';
import { useSheets } from '@/context/SheetsContext';
import { Button } from '../ui/button';
import { postToSheet } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { ClipboardList } from 'lucide-react';
import Heading from '../element/Heading';
import type { StoreOutSheet } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pill } from '../ui/pill';

interface StoreOutTableData {
    id: string;
    issueNo: string;
    indenterName: string;
    indentType: string;
    approveQty: number;
    groupHead: string;
    product: string;
    unit: string;
    department: string;
    category: string;
    searialNumber?: number | string;
    storeOutActual?: string;
    storeOutStatus?: string;
    approvalStatus?: string;
    slip?: string;
    wardName: string;
    floor: string;
    originalRow: StoreOutSheet;
}

interface GroupedStoreOutStatusData {
    issueNo: string;
    indenterName: string;
    department: string;
    category: string;
    wardName: string;
    floor: string;
    slip?: string;
    items: StoreOutTableData[];
}

export default () => {
    const { storeOutSheet, storeOutLoading, updateStoreOutSheet } = useSheets();

    const [pendingData, setPendingData] = useState<GroupedStoreOutStatusData[]>([]);
    const [historyData, setHistoryData] = useState<GroupedStoreOutStatusData[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<GroupedStoreOutStatusData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<GroupedStoreOutStatusData | null>(null);

    useEffect(() => {
        if (!storeOutSheet) return;

        const mappedData: StoreOutTableData[] = storeOutSheet.map((row, index) => {
            const actual = row.Actual1 || (row as any).actual1;
            const storeOutStatusVal = row.Status || (row as any).status1 || row.storeOutStatus;
            const approvalStatusVal = row.status || '';

            return {
                id: `${row.issueNo}_${index}`,
                issueNo: row.issueNo,
                indenterName: row.requestedBy,
                indentType: row.indentType || 'Store Out',
                approveQty: row.approveQty,
                groupHead: row.groupOfHead || row.category || '',
                product: row.productName,
                unit: row.unit || '',
                department: row.department || '',
                category: row.category || '',
                searialNumber: row.searialNumber,
                storeOutActual: actual,
                storeOutStatus: storeOutStatusVal,
                approvalStatus: approvalStatusVal,
                slip: row.slip || '',
                wardName: row.wardName || '',
                floor: row.floor || '',
                originalRow: row
            };
        });

        const groupItems = (items: StoreOutTableData[]) => {
            return items.reduce((acc, item) => {
                if (!acc[item.issueNo]) {
                    acc[item.issueNo] = {
                        issueNo: item.issueNo,
                        indenterName: item.indenterName,
                        department: item.department,
                        category: item.category,
                        wardName: item.wardName,
                        floor: item.floor,
                        slip: item.slip,
                        items: [],
                    };
                }
                acc[item.issueNo].items.push(item);
                return acc;
            }, {} as Record<string, GroupedStoreOutStatusData>);
        };

        const pending = mappedData.filter(row => {
            const isApproved = row.approvalStatus === 'Approved';
            const noActual = !row.storeOutActual || row.storeOutActual.trim() === '';
            return isApproved && noActual;
        });

        const history = mappedData.filter(row => {
            const isApproved = row.approvalStatus === 'Approved';
            const hasActual = row.storeOutActual && row.storeOutActual.trim() !== '';
            return isApproved && hasActual;
        });

        setPendingData(Object.values(groupItems(pending)).reverse());
        setHistoryData(Object.values(groupItems(history)).reverse());
    }, [storeOutSheet]);

    const historyColumns: ColumnDef<GroupedStoreOutStatusData>[] = [
        {
            id: 'action',
            header: 'Action',
            cell: ({ row }) => (
                <Button variant="outline" size="sm" onClick={() => setSelectedHistory(row.original)}>
                    View ({row.original.items.length})
                </Button>
            ),
        },
        { accessorKey: 'issueNo', header: 'Issue No' },
        { accessorKey: 'indenterName', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'category', header: 'Group Head' },
        { accessorKey: 'wardName', header: 'Ward Name' },
        { accessorKey: 'floor', header: 'Floor' },
        {
            header: 'Slip',
            cell: ({ row }) => row.original.slip ? (
                <a href={row.original.slip} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    View
                </a>
            ) : '-'
        },
        {
            header: 'Products',
            cell: ({ row }) => (
                <div className="max-w-[150px] break-words text-xs">
                    {row.original.items.map(i => i.product).join(', ')}
                </div>
            )
        },
    ];

    const pendingColumns: ColumnDef<GroupedStoreOutStatusData>[] = [
        {
            id: 'action',
            header: 'Action',
            cell: ({ row }) => (
                <Button variant="outline" size="sm" onClick={() => setSelectedGroup(row.original)}>
                    Update ({row.original.items.length})
                </Button>
            ),
        },
        { accessorKey: 'issueNo', header: 'Issue No' },
        { accessorKey: 'indenterName', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'category', header: 'Group Head' },
        { accessorKey: 'wardName', header: 'Ward Name' },
        { accessorKey: 'floor', header: 'Floor' },
        {
            header: 'Slip',
            cell: ({ row }) => row.original.slip ? (
                <a href={row.original.slip} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    View
                </a>
            ) : '-'
        },
        {
            header: 'Products',
            cell: ({ row }) => (
                <div className="max-w-[150px] break-words text-xs">
                    {row.original.items.map(i => i.product).join(', ')}
                </div>
            )
        },
    ];

    return (
        <div className="w-full overflow-hidden">
            <Heading heading="Store Out" subtext="Manage store out items pending actual confirmation">
                <ClipboardList size={50} className="text-primary" />
            </Heading>

            <Dialog open={!!(selectedGroup || selectedHistory)} onOpenChange={(open) => {
                if (!open) {
                    setSelectedGroup(null);
                    setSelectedHistory(null);
                }
            }}>
                <div className="p-5">
                    <Tabs defaultValue="pending" className="w-full">
                        <TabsList className="mb-4">
                            <TabsTrigger value="pending">Pending ({pendingData.length})</TabsTrigger>
                            <TabsTrigger value="history">History ({historyData.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending">
                            <DataTable data={pendingData} columns={pendingColumns} searchFields={['issueNo', 'indenterName']} dataLoading={storeOutLoading} />
                        </TabsContent>
                        <TabsContent value="history">
                            <DataTable data={historyData} columns={historyColumns} searchFields={['issueNo', 'indenterName']} dataLoading={storeOutLoading} />
                        </TabsContent>
                    </Tabs>
                </div>

                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {selectedGroup && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Update Status - {selectedGroup.issueNo}</DialogTitle>
                                <DialogDescription>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
                                        <span className="font-semibold">{selectedGroup.indenterName}</span>
                                        <span>| Floor: {selectedGroup.floor}</span>
                                        <span>| Ward: {selectedGroup.wardName}</span>
                                        {selectedGroup.slip && (
                                            <>
                                                | Slip: <a href={selectedGroup.slip} target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">View</a>
                                            </>
                                        )}
                                    </div>
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                                <StoreOutStatusForm
                                    items={selectedGroup.items}
                                    onSuccess={() => {
                                        setSelectedGroup(null);
                                        setTimeout(() => updateStoreOutSheet(), 1000);
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {selectedHistory && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Store Out History - {selectedHistory.issueNo}</DialogTitle>
                                <DialogDescription>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
                                        <span className="font-semibold">{selectedHistory.indenterName}</span>
                                        <span>| Floor: {selectedHistory.floor}</span>
                                        <span>| Ward: {selectedHistory.wardName}</span>
                                        {selectedHistory.slip && (
                                            <>
                                                | Slip: <a href={selectedHistory.slip} target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">View</a>
                                            </>
                                        )}
                                    </div>
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <table className="w-full text-sm">
                                    <thead className="bg-primary">
                                        <tr className="border-b text-primary-foreground font-bold text-left">
                                            <th className="py-2">Product</th>
                                            <th className="py-2">Qty</th>
                                            <th className="py-2">Status</th>
                                            <th className="py-2">Date</th>
                                            <th className="py-2">S.No</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedHistory.items.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0 border-muted/20">
                                                <td className="py-2">{item.product}</td>
                                                <td className="py-2">{item.approveQty} {item.unit}</td>
                                                <td className="py-2"><Pill variant="secondary">{item.storeOutStatus}</Pill></td>
                                                <td className="py-2">{item.storeOutActual ? item.storeOutActual.split(' ')[0] : '-'}</td>
                                                <td className="py-2">{item.searialNumber || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const StoreOutStatusForm = ({ items, onSuccess }: { items: StoreOutTableData[], onSuccess: () => void }) => {
    const schema = z.object({
        updates: z.array(z.object({
            searialNumber: z.union([z.string(), z.number()]),
            status: z.string().nonempty('Status is required'),
            product: z.string(),
            rowIndex: z.number(),
            issueNo: z.string(),
        }))
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            updates: items.map(item => ({
                searialNumber: item.searialNumber || '',
                status: item.storeOutStatus || '',
                product: item.product,
                rowIndex: (item.originalRow as any).rowIndex,
                issueNo: item.issueNo,
            }))
        }
    });

    const onSubmit = async (values: z.infer<typeof schema>) => {
        const now = new Date();
        const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        try {
            const payload = values.updates.map(update => {
                const originalItem = items.find(i => String(i.searialNumber) === String(update.searialNumber))!;
                return {
                    rowIndex: originalItem.originalRow.rowIndex,
                    issueNo: originalItem.issueNo,
                    searialNumber: update.searialNumber,
                    actual1: formattedDate,
                    status1: update.status, // Targeted update for Column AA
                };
            });

            await postToSheet(payload, 'update', 'STORE OUT');
            toast.success(`Updated ${items.length} items`);
            onSuccess();
        } catch (e) {
            toast.error('Failed to update');
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {items.map((item, index) => (
                        <div key={item.searialNumber || index} className="border p-4 rounded-md bg-muted/20 space-y-3">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-semibold text-sm">{item.product}</span>
                                <span className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded">
                                    S.No: {item.searialNumber} | Approved Qty: {item.approveQty}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                                <div><span className="font-medium">Ward:</span> {item.wardName}</div>
                                <div><span className="font-medium">Floor:</span> {item.floor}</div>
                                {item.slip && (
                                    <div className="col-span-2">
                                        <span className="font-medium">Slip:</span>{" "}
                                        <a href={item.slip} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                            View Slip
                                        </a>
                                    </div>
                                )}
                            </div>

                            <FormField
                                control={form.control}
                                name={`updates.${index}.status`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Done">Done</SelectItem>
                                                <SelectItem value="Not Done">Not Done</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                        </div>
                    ))}
                </div>
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                    {form.formState.isSubmitting ? <Loader size={16} color="white" /> : `Confirm ${items.length} Items`}
                </Button>
            </form>
        </Form>
    );
};

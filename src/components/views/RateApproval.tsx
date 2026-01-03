import type { ColumnDef, Row } from '@tanstack/react-table';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog';
import { useEffect, useState } from 'react';
import { useSheets } from '@/context/SheetsContext';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { postToSheet } from '@/lib/fetchers';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Input } from '../ui/input';

interface RateApprovalData {
    rowIndex: number;
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    comparisonSheet: string;
    vendors: [string, string, string][];
    date: string;
    searialNumber?: string | number;
}

interface GroupedRateApprovalData {
    indentNo: string;
    indenter: string;
    department: string;
    comparisonSheet: string;
    date: string;
    items: RateApprovalData[];
}

interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    vendor: [string, string];
    date: string;
    searialNumber?: string | number;
}

interface GroupedHistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    date: string;
    items: HistoryData[];
}

export default () => {
    const { indentLoading, indentSheet, updateIndentSheet } = useSheets();
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<GroupedRateApprovalData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<GroupedHistoryData | null>(null);
    const [tableData, setTableData] = useState<GroupedRateApprovalData[]>([]);
    const [historyData, setHistoryData] = useState<GroupedHistoryData[]>([]);

    useEffect(() => {
        const pendingItems = indentSheet
            .filter((sheet) => sheet.planned3 !== '' && sheet.actual3 === '' && sheet.vendorType === 'Three Party')
            .map((sheet) => ({
                rowIndex: (sheet as any).rowIndex,
                indentNo: sheet.indentNumber,
                indenter: sheet.indenterName,
                department: sheet.department,
                product: sheet.productName,
                comparisonSheet: sheet.comparisonSheet || '',
                date: formatDate(new Date(sheet.timestamp)),
                searialNumber: sheet.searialNumber,
                vendors: [
                    [sheet.vendorName1, sheet.rate1.toString(), sheet.paymentTerm1],
                    [sheet.vendorName2, sheet.rate2.toString(), sheet.paymentTerm2],
                    [sheet.vendorName3, sheet.rate3.toString(), sheet.paymentTerm3],
                ] as [string, string, string][],
            }));

        const groupedPending = pendingItems.reduce((acc, item) => {
            if (!acc[item.indentNo]) {
                acc[item.indentNo] = {
                    indentNo: item.indentNo,
                    indenter: item.indenter,
                    department: item.department,
                    comparisonSheet: item.comparisonSheet,
                    date: item.date,
                    items: [],
                };
            }
            acc[item.indentNo].items.push(item);
            return acc;
        }, {} as Record<string, GroupedRateApprovalData>);

        setTableData(Object.values(groupedPending).reverse());

        const historyItems = indentSheet
            .filter((sheet) => sheet.planned3 !== '' && sheet.actual3 !== '' && sheet.vendorType === 'Three Party')
            .map((sheet) => ({
                indentNo: sheet.indentNumber,
                indenter: sheet.indenterName,
                department: sheet.department,
                product: sheet.productName,
                date: new Date(sheet.timestamp).toDateString(),
                searialNumber: sheet.searialNumber,
                vendor: [sheet.approvedVendorName, sheet.approvedRate.toString()] as [string, string],
            }));

        const groupedHistory = historyItems.reduce((acc, item) => {
            if (!acc[item.indentNo]) {
                acc[item.indentNo] = {
                    indentNo: item.indentNo,
                    indenter: item.indenter,
                    department: item.department,
                    date: item.date,
                    items: [],
                };
            }
            acc[item.indentNo].items.push(item);
            return acc;
        }, {} as Record<string, GroupedHistoryData>);

        setHistoryData(Object.values(groupedHistory).reverse());
    }, [indentSheet]);

    const columns: ColumnDef<GroupedRateApprovalData>[] = [
        ...(user.threePartyApprovalAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<GroupedRateApprovalData> }) => (
                        <Button
                            variant="outline"
                            onClick={() => setSelectedIndent(row.original)}
                        >
                            Approve ({row.original.items.length})
                        </Button>
                    ),
                },
            ]
            : []),
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        {
            accessorKey: 'items',
            header: 'Products',
            cell: ({ row }) => (
                <div className="max-w-[200px] break-words whitespace-normal text-xs">
                    {row.original.items.map(i => i.product).join(', ')}
                </div>
            ),
        },
        { accessorKey: 'date', header: 'Date' },
        {
            accessorKey: 'comparisonSheet',
            header: 'Comp. Sheet',
            cell: ({ row }) => row.original.comparisonSheet ? (
                <a href={row.original.comparisonSheet} target="_blank" className="text-primary hover:underline">View</a>
            ) : '-',
        },
    ];

    const historyColumns: ColumnDef<GroupedHistoryData>[] = [
        { accessorKey: 'date', header: 'Date' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        {
            accessorKey: 'items',
            header: 'Products',
            cell: ({ row }) => (
                <div className="max-w-[200px] break-words whitespace-normal text-xs">
                    {row.original.items.map(i => i.product).join(', ')}
                </div>
            ),
        },
    ];

    return (
        <div>
            <Dialog open={!!(selectedIndent || selectedHistory)} onOpenChange={(open) => {
                if (!open) {
                    setSelectedIndent(null);
                    setSelectedHistory(null);
                }
            }}>
                <Tabs defaultValue="pending">
                    <Heading heading="Three Party Rate Approval" subtext="Approve rates for three party vendors" tabs>
                        <Users size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        <DataTable data={tableData} columns={columns} searchFields={['indentNo', 'department', 'indenter']} dataLoading={indentLoading} />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable data={historyData} columns={historyColumns} searchFields={['indentNo', 'department', 'indenter']} dataLoading={indentLoading} />
                    </TabsContent>
                </Tabs>

                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {selectedIndent && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Rate Approval - {selectedIndent.indentNo}</DialogTitle>
                                <DialogDescription>
                                    {selectedIndent.indenter} | {selectedIndent.department}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6 py-4">
                                <RateApprovalForm
                                    items={selectedIndent.items}
                                    onSuccess={() => {
                                        setSelectedIndent(null);
                                        setTimeout(() => updateIndentSheet(), 1000);
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {selectedHistory && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Approval History - {selectedHistory.indentNo}</DialogTitle>
                                <DialogDescription>{selectedHistory.indenter} | {selectedHistory.department} | {selectedHistory.date}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <table className="w-full text-sm">
                                    <thead className="bg-primary">
                                        <tr className="border-b text-primary-foreground font-bold text-left">
                                            <th className="py-2">Product</th>
                                            <th className="py-2">Approved Vendor</th>
                                            <th className="py-2">Rate</th>
                                            <th className="py-2">S.No</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedHistory.items.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0 border-muted/20">
                                                <td className="py-2">{item.product}</td>
                                                <td className="py-2">{item.vendor[0]}</td>
                                                <td className="py-2">₹{item.vendor[1]}</td>
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

const RateApprovalForm = ({ items, onSuccess }: { items: RateApprovalData[], onSuccess: () => void }) => {
    const { indentSheet } = useSheets();
    const schema = z.object({
        approvals: z.array(z.object({
            searialNumber: z.union([z.string(), z.number()]),
            vendorIndex: z.string().nonempty('Vendor selection is required'),
            product: z.string(),
            indentNumber: z.string()
        }))
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            approvals: items.map(item => ({
                searialNumber: item.searialNumber || '',
                vendorIndex: '',
                product: item.product,
                indentNumber: item.indentNo
            }))
        }
    });

    const onSubmit = async (values: z.infer<typeof schema>) => {
        try {
            const payload = values.approvals.map(appr => {
                const originalItem = items.find(i => String(i.searialNumber) === String(appr.searialNumber))!;
                const selectedVendor = originalItem.vendors[parseInt(appr.vendorIndex)];

                return {
                    rowIndex: originalItem.rowIndex,
                    indentNumber: appr.indentNumber,
                    actual3: formatDate(new Date()),
                    approvedVendorName: selectedVendor[0],
                    approvedRate: selectedVendor[1],
                    approvedPaymentTerm: selectedVendor[2],
                };
            });

            await postToSheet(payload, 'update', 'INDENT');
            toast.success(`Approved ${items.length} items`);
            onSuccess();
        } catch {
            toast.error('Failed to update');
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                console.error("Form errors:", errors);
                toast.error("Please select a vendor for all items");
            })} className="space-y-6">
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                    {items.map((item, index) => (
                        <div key={item.searialNumber || index} className="border p-4 rounded-md bg-muted/20 space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-semibold text-sm text-primary">{item.product}</span>
                                <span className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded">S.No: {item.searialNumber}</span>
                            </div>
                            <FormField
                                control={form.control}
                                name={`approvals.${index}.vendorIndex`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold">Select Vendor</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col gap-3">
                                                {item.vendors.map((vendor, i) => (
                                                    <div
                                                        key={i}
                                                        onClick={() => field.onChange(`${i}`)}
                                                        className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${field.value === `${i}`
                                                            ? 'border-blue-500 bg-blue-50/50'
                                                            : 'border-muted/40 hover:border-blue-200 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <RadioGroupItem
                                                                value={`${i}`}
                                                                id={`v-${item.searialNumber}-${i}`}
                                                                className="h-5 w-5 border-2 border-muted-foreground/30 text-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-blue-600"
                                                            />
                                                            <span className="text-sm font-medium text-foreground/80">
                                                                Payment Term: {vendor[2]}
                                                            </span>
                                                        </div>
                                                        <span className="font-bold text-base">₹{vendor[1]}</span>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                    ))}
                </div>
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                    {form.formState.isSubmitting ? <Loader size={16} color="white" /> : `Approve ${items.length} Items`}
                </Button>
            </form>
        </Form>
    );
};

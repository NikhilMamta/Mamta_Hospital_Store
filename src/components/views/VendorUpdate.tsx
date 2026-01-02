import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
    DialogHeader,
    DialogFooter,
    DialogClose,
} from '../ui/dialog';
import { postToSheet, uploadFile, fetchVendors } from '@/lib/fetchers';
import { z } from 'zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { UserCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { formatDate } from '@/lib/utils';

interface VendorUpdateData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    vendorType: 'Three Party' | 'Regular';
    vendorName?: string;
    searialNumber?: string | number;
}
interface GroupedVendorUpdateData {
    indentNo: string;
    indenter: string;
    department: string;
    vendorType: 'Three Party' | 'Regular';
    items: VendorUpdateData[];
}

interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    rate: number;
    vendorType: 'Three Party' | 'Regular';
    date: string;
    vendorName?: string;
    searialNumber?: string | number;
}

interface GroupedHistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    date: string;
    items: HistoryData[];
}

const ThreePartyFields = ({ index, form, vendors, options }: any) => {
    const { fields } = useFieldArray({ control: form.control, name: `updates.${index}.vendors` });

    return (
        <Tabs defaultValue="0" className="border rounded-md p-3 bg-background">
            <TabsList className="bg-muted overflow-x-auto h-9 w-full justify-start">
                {fields.map((_, i) => <TabsTrigger key={i} value={`${i}`} className="px-2 text-[10px]">V{i + 1}</TabsTrigger>)}
            </TabsList>
            {fields.map((field, vIndex) => (
                <TabsContent key={field.id} value={`${vIndex}`} className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                    <FormField
                        control={form.control}
                        name={`updates.${index}.vendors.${vIndex}.vendorName`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px]">Vendor {vIndex + 1}</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vendor" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {vendors?.map((v: any, i: number) => <SelectItem key={i} value={v.vendorName}>{v.vendorName}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`updates.${index}.vendors.${vIndex}.rate`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px]">Rate</FormLabel>
                                <FormControl><Input type="number" {...field} className="h-8 text-xs" /></FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name={`updates.${index}.vendors.${vIndex}.paymentTerm`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px]">Term</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Term" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {options?.paymentTerms?.map((term: string, i: number) => <SelectItem key={i} value={term}>{term}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                </TabsContent>
            ))}
        </Tabs>
    );
};

const VendorUpdateForm = ({ items, vendorType, vendors, options, onSuccess }: any) => {
    const { indentSheet } = useSheets();
    const [vendorSearch, setVendorSearch] = useState('');

    const regularSchema = z.object({
        updates: z.array(z.object({
            searialNumber: z.union([z.string(), z.number()]),
            vendorName: z.string().nonempty("Vendor required"),
            rate: z.coerce.number().gt(0, "Rate must be > 0"),
            paymentTerm: z.string().nonempty("Payment term required"),
            product: z.string(),
            indentNumber: z.string()
        }))
    });

    const threePartySchema = z.object({
        comparisonSheet: z.any().optional(),
        updates: z.array(z.object({
            searialNumber: z.union([z.string(), z.number()]),
            product: z.string(),
            indentNumber: z.string(),
            vendors: z.array(z.object({
                vendorName: z.string().optional(),
                rate: z.coerce.number().optional(),
                paymentTerm: z.string().optional(),
            })).max(10).min(1),
        }))
    });

    const isThreeParty = vendorType === 'Three Party';
    const form = useForm<any>({
        resolver: zodResolver(isThreeParty ? threePartySchema : regularSchema),
        defaultValues: {
            comparisonSheet: undefined,
            updates: items.map((item: any) => ({
                searialNumber: item.searialNumber || '',
                product: item.product,
                indentNumber: item.indentNo,
                vendorName: '',
                rate: undefined,
                paymentTerm: '',
                vendors: isThreeParty ? Array.from({ length: 10 }, () => ({ vendorName: '', rate: undefined, paymentTerm: '' })) : []
            }))
        }
    });

    const onSubmit = async (values: any) => {
        try {
            let commonUrl = '';
            if (isThreeParty && values.comparisonSheet) {
                commonUrl = await uploadFile(values.comparisonSheet, import.meta.env.VITE_COMPARISON_SHEET_FOLDER);
            }

            const payload = values.updates.map((update: any) => {
                const now = formatDate(new Date());
                const originalItem = items.find((i: any) => String(i.searialNumber) === String(update.searialNumber))!;
                const rowIndex = (originalItem as any).rowIndex || indentSheet.find(s => String(s.searialNumber) === String(update.searialNumber))?.rowIndex;

                if (isThreeParty) {
                    const partyPayload: any = {
                        rowIndex,
                        indentNumber: update.indentNumber,
                        actual2: now,
                        comparisonSheet: commonUrl || ''
                    };
                    update.vendors.forEach((v: any, i: number) => {
                        if (v.vendorName) {
                            partyPayload[`vendorName${i + 1}`] = v.vendorName;
                            partyPayload[`rate${i + 1}`] = v.rate?.toString() || '';
                            partyPayload[`paymentTerm${i + 1}`] = v.paymentTerm || '';
                        }
                    });
                    return partyPayload;
                } else {
                    return {
                        rowIndex,
                        indentNumber: update.indentNumber,
                        actual2: now,
                        vendorName1: update.vendorName,
                        rate1: update.rate.toString(),
                        paymentTerm1: update.paymentTerm,
                        approvedVendorName: update.vendorName,
                        approvedRate: update.rate,
                        approvedPaymentTerm: update.paymentTerm,
                    };
                }
            });

            await postToSheet(payload, 'update', 'INDENT');
            toast.success(`Updated ${items.length} items`);
            onSuccess();
        } catch (e) {
            toast.error('Failed to update');
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {isThreeParty && (
                    <div className="border-b pb-4 mb-4">
                        <FormField
                            control={form.control}
                            name="comparisonSheet"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-bold">Comparison Sheet (Entire Indent)</FormLabel>
                                    <FormControl><Input type="file" onChange={(e) => field.onChange(e.target.files?.[0])} className="h-9" /></FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                )}

                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                    {items.map((item: any, index: number) => (
                        <div key={item.searialNumber || index} className="border p-4 rounded-md bg-muted/20 space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="font-semibold text-sm text-primary">{item.product}</span>
                                <span className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded">Qty: {item.quantity} {item.uom} | S.No: {item.searialNumber}</span>
                            </div>

                            {!isThreeParty ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField
                                        control={form.control}
                                        name={`updates.${index}.vendorName`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Vendor</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value} onOpenChange={(open) => !open && setVendorSearch("")}>
                                                    <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Vendor" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <div className="px-2 py-1">
                                                            <Input placeholder="Search..." className="h-8" value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} />
                                                        </div>
                                                        <div className="max-h-[150px] overflow-y-auto">
                                                            {vendors?.filter((v: any) => v.vendorName.toLowerCase().includes(vendorSearch.toLowerCase())).map((v: any, i: number) => (
                                                                <SelectItem key={i} value={v.vendorName}>{v.vendorName}</SelectItem>
                                                            ))}
                                                        </div>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`updates.${index}.rate`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Rate</FormLabel>
                                                <FormControl><Input type="number" {...field} className="h-9" /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`updates.${index}.paymentTerm`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Term</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Terms" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        {options?.paymentTerms?.map((term: string, i: number) => <SelectItem key={i} value={term}>{term}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            ) : (
                                <ThreePartyFields index={index} form={form} vendors={vendors} options={options} />
                            )}
                        </div>
                    ))}
                </div>

                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                    {form.formState.isSubmitting ? <Loader size={16} color="white" /> : `Update ${items.length} Items`}
                </Button>
            </form>
        </Form>
    );
};

export default () => {
    const { indentSheet, indentLoading, updateIndentSheet, masterSheet: options } = useSheets();
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<GroupedVendorUpdateData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<GroupedHistoryData | null>(null);
    const [historyData, setHistoryData] = useState<GroupedHistoryData[]>([]);
    const [tableData, setTableData] = useState<GroupedVendorUpdateData[]>([]);
    const [vendors, setVendors] = useState([]);
    const [vendorsLoading, setVendorsLoading] = useState(true);

    useEffect(() => {
        const loadVendors = async () => {
            setVendorsLoading(true);
            const vendorsList = await fetchVendors();
            setVendors(vendorsList);
            setVendorsLoading(false);
        };
        loadVendors();
    }, []);

    useEffect(() => {
        const pendingItems = indentSheet
            .filter((sheet) => sheet.planned2 !== '' && sheet.actual2 === '')
            .map((sheet) => ({
                indentNo: sheet.indentNumber,
                indenter: sheet.indenterName,
                department: sheet.department,
                product: sheet.productName,
                quantity: sheet.approvedQuantity,
                uom: sheet.uom,
                vendorType: sheet.vendorType as VendorUpdateData['vendorType'],
                vendorName: sheet.approvedVendorName || sheet.vendorName1 || '',
                searialNumber: sheet.searialNumber,
            }));

        const groupedPending = pendingItems.reduce((acc, item) => {
            if (!acc[item.indentNo]) {
                acc[item.indentNo] = {
                    indentNo: item.indentNo,
                    indenter: item.indenter,
                    department: item.department,
                    vendorType: item.vendorType,
                    items: [],
                };
            }
            acc[item.indentNo].items.push(item);
            return acc;
        }, {} as Record<string, GroupedVendorUpdateData>);

        setTableData(Object.values(groupedPending).reverse());

        const historyItems = indentSheet
            .filter((sheet) => sheet.planned2 !== '' && sheet.actual2 !== '')
            .map((sheet) => ({
                date: formatDate(new Date(sheet.actual2)),
                indentNo: sheet.indentNumber,
                indenter: sheet.indenterName,
                department: sheet.department,
                product: sheet.productName,
                quantity: sheet.quantity,
                uom: sheet.uom,
                rate: sheet.approvedRate || 0,
                vendorType: sheet.vendorType as HistoryData['vendorType'],
                vendorName: sheet.approvedVendorName || sheet.vendorName1 || '',
                searialNumber: sheet.searialNumber,
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

    const columns: ColumnDef<GroupedVendorUpdateData>[] = [
        ...(user.updateVendorAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<GroupedVendorUpdateData> }) => (
                        <Button
                            variant="outline"
                            onClick={() => setSelectedIndent(row.original)}
                        >
                            Update ({row.original.items.length})
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
        {
            accessorKey: 'vendorType',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const variant = row.original.vendorType === 'Regular' ? 'primary' : 'secondary';
                return <Pill variant={variant}>{row.original.vendorType}</Pill>;
            },
        },
    ];

    const historyColumns: ColumnDef<GroupedHistoryData>[] = [
        ...(user.updateVendorAction ? [
            {
                header: 'Action',
                cell: ({ row }: { row: Row<GroupedHistoryData> }) => (
                    <Button
                        variant="outline"
                        onClick={() => setSelectedHistory(row.original)}
                    >
                        View ({row.original.items.length})
                    </Button>
                ),
            },
        ] : []),
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
                    <Heading heading="Vendor Rate Update" subtext="Update vendors for Regular and Three Party indents" tabs>
                        <UserCheck size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['indentNo', 'department', 'indenter']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['indentNo', 'department', 'indenter']}
                            dataLoading={indentLoading}
                        />
                    </TabsContent>
                </Tabs>

                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {selectedIndent && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Update Vendor Rates - {selectedIndent.indentNo}</DialogTitle>
                                <DialogDescription>
                                    {selectedIndent.indenter} | {selectedIndent.department} | {selectedIndent.vendorType}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6 py-4">
                                <VendorUpdateForm
                                    items={selectedIndent.items}
                                    vendorType={selectedIndent.vendorType}
                                    vendors={vendors}
                                    options={options}
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
                                <DialogTitle>Indent History - {selectedHistory.indentNo}</DialogTitle>
                                <DialogDescription>
                                    {selectedHistory.indenter} | {selectedHistory.department} | {selectedHistory.date}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="text-left py-2 font-medium">Product</th>
                                            <th className="text-left py-2 font-medium">Qty</th>
                                            <th className="text-left py-2 font-medium">Rate</th>
                                            <th className="text-left py-2 font-medium">Vendor</th>
                                            <th className="text-left py-2 font-medium">S.No</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedHistory.items.map((item, idx) => (
                                            <tr key={idx} className="border-b last:border-0">
                                                <td className="py-2">{item.product}</td>
                                                <td className="py-2">{item.quantity} {item.uom}</td>
                                                <td className="py-2">₹{item.rate}</td>
                                                <td className="py-2">{item.vendorName}</td>
                                                <td className="py-2">{item.searialNumber || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Interface for table data
interface StoreOutTableData {
    id: string;
    issueNo: string;
    indenterName: string;
    indentType: string;
    approveQty: number;
    groupHead: string;
    product: string;
    searialNumber?: number | string;
    storeOutActual?: string;
    storeOutStatus?: string;
    approvalStatus?: string; // Column O
    slip?: string; // Column W
    originalRow: StoreOutSheet;
}

export default () => {
    const { storeOutSheet, storeOutLoading, updateStoreOutSheet } = useSheets();

    // Separate state for tabs
    const [pendingData, setPendingData] = useState<StoreOutTableData[]>([]);
    const [historyData, setHistoryData] = useState<StoreOutTableData[]>([]);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<StoreOutTableData | null>(null);
    const [status, setStatus] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);

    // Filter and Map Data
    useEffect(() => {
        if (!storeOutSheet) return;

        console.log("Raw Store Out Data:", storeOutSheet[0]);

        const mappedData = storeOutSheet.map((row, index) => {
            // Read keys with robustness (User confirmed Planned1/Actual1)
            // We read multiple variations just in case, but write specific ones.
            const planned = row.Planned1 || row.planned1;
            const actual = row.Actual1 || row.actual1;
            // Read keys with robustness
            // row.status is usually "Approved" (Column O)
            // The fetcher likely renames the second "Status" header to "status1" for Column AA
            const storeOutStatusVal = row.Status || row.status1 || row.storeOutStatus;
            const approvalStatusVal = row.status || ''; // Column O

            return {
                id: `${row.issueNo}_${index}`,
                issueNo: row.issueNo,
                indenterName: row.requestedBy || row.indenterName,
                indentType: row.indentType || 'Store Out',
                approveQty: row.approveQty,
                // Fallback to category as per helper mapping, or try direct property
                // Log shows 'groupOfHead' is the key
                groupHead: row.groupOfHead || row.groupHead || row.category || '',
                product: row.productName,
                searialNumber: row.searialNumber,
                storeOutActual: actual,
                storeOutStatus: storeOutStatusVal,
                approvalStatus: approvalStatusVal,
                slip: row.slip || '',
                originalRow: row
            };
        });

        // console.log("Mapped Data Sample:", mappedData[0]);

        // Pending: Planned (X) Present AND Actual (Y) Empty
        const pending = mappedData.filter(row => {
            // Determine if "Planned" exists
            const pVal = row.originalRow.Planned1 || row.originalRow.planned1;
            const hasPlanned = pVal && String(pVal).trim() !== '';

            // Determine if "Actual" is empty
            const aVal = row.originalRow.Actual1 || row.originalRow.actual1;
            const noActual = !aVal || String(aVal).trim() === '';

            // Note: If you want to show ALL items regardless of planned status, remove `hasPlanned` check.
            // But based on user request context, keeping existing logic for now.
            return hasPlanned && noActual;
        });

        // History: Planned (X) Present AND Actual (Y) Present
        const history = mappedData.filter(row => {
            const pVal = row.originalRow.Planned1 || row.originalRow.planned1;
            const hasPlanned = pVal && String(pVal).trim() !== '';

            const aVal = row.originalRow.Actual1 || row.originalRow.actual1;
            const hasActual = aVal && String(aVal).trim() !== '';

            return hasPlanned && hasActual;
        });

        setPendingData(pending);
        setHistoryData(history);
    }, [storeOutSheet]);

    const handleActionClick = (row: StoreOutTableData) => {
        setSelectedRow(row);
        // Pre-fill status if it exists, otherwise default empty or 'Not Done' depending on requirement.
        // If data has existing status, use it.
        setStatus(row.storeOutStatus || '');
        setIsDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!selectedRow || !status) {
            toast.error("Please select a status");
            return;
        }

        setSubmitting(true);
        try {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const formattedTimestamp = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

            // Prepare Payload
            // User requested: "submit status in colum AA and actual submit in column Y"
            // Keys: Status -> AA, Actual1 -> Y
            // Prepare Payload
            // Prepare Payload
            // User requested: "submit status in colum AA and actual submit in column Y"
            // Keys: Status -> AA, Actual1 -> Y
            // Found that ReceiveItems.tsx uses lowercase keys (e.g. actual5) which map to headers.
            // Also it includes sheetName in the payload.
            const payload = [{
                // searialNumber: selectedRow.originalRow.searialNumber, 
                rowIndex: selectedRow.originalRow.rowIndex,
                issueNo: selectedRow.originalRow.issueNo,
                sheetName: 'STORE OUT', // Explicitly adding sheetName as seen in ReceiveItems
                actual1: formattedTimestamp, // Lowercase key 'actual1' -> matches 'Actual1' header via mapping?
                status1: status, // Lowercase key 'status1' -> matches 'Status1' header via mapping?
            }];

            console.log("Submitting Lowercase Payload:", payload);

            await postToSheet(payload, 'update', 'STORE OUT');

            toast.success("Updated successfully");
            setIsDialogOpen(false);
            setTimeout(() => updateStoreOutSheet(), 1000);

        } catch (error) {
            console.error("Submit Error:", error);
            toast.error("Failed to update");
        } finally {
            setSubmitting(false);
        }
    };

    const pendingColumns: ColumnDef<StoreOutTableData>[] = [
        {
            accessorKey: 'issueNo',
            header: 'Issue No',
            size: 100,
        },
        {
            accessorKey: 'indenterName',
            header: 'Indenter Name',
            size: 150,
        },
        {
            accessorKey: 'indentType',
            header: 'Indent Type',
            size: 120,
        },
        {
            accessorKey: 'approvalStatus',
            header: 'Status (O)',
            size: 120,
        },
        {
            accessorKey: 'approveQty',
            header: 'Approval Needed',
            size: 120,
        },
        {
            accessorKey: 'groupHead',
            header: 'Group of head',
            size: 150,
        },
        {
            accessorKey: 'product',
            header: 'Product Name',
            size: 200,
        },
        {
            accessorKey: 'searialNumber',
            header: 'Serial Number',
            size: 100,
        },
        {
            id: 'action',
            header: 'Action',
            cell: ({ row }) => (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleActionClick(row.original)}
                >
                    Update
                </Button>
            ),
            size: 100,
        }
    ];

    const historyColumns: ColumnDef<StoreOutTableData>[] = [
        {
            accessorKey: 'issueNo',
            header: 'Issue No',
            size: 100,
        },
        {
            accessorKey: 'indenterName',
            header: 'Indenter Name',
            size: 150,
        },
        {
            accessorKey: 'approvalStatus',
            header: 'Status (O)',
            size: 120,
        },
        {
            accessorKey: 'indentType',
            header: 'Indent Type',
            size: 120,
        },
        {
            accessorKey: 'approveQty',
            header: 'Approval Needed',
            size: 120,
        },
        {
            accessorKey: 'groupHead',
            header: 'Group of head',
            size: 150,
        },
        {
            accessorKey: 'product',
            header: 'Product Name',
            size: 200,
        },
        {
            accessorKey: 'searialNumber',
            header: 'Serial Number',
            size: 100,
        },
        {
            accessorKey: 'storeOutStatus',
            header: 'Status',
            size: 100,
        },
        {
            accessorKey: 'storeOutActual',
            header: 'Confirmation Date',
            size: 150,
        },
    ];

    return (
        <div className="w-full overflow-hidden">
            <Heading
                heading="Store Out"
                subtext="Manage store out items pending actual confirmation"
            >
                <ClipboardList size={50} className="text-primary" />
            </Heading>

            <div className="p-5">
                <Tabs defaultValue="pending" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="pending">Pending ({pendingData.length})</TabsTrigger>
                        <TabsTrigger value="history">History ({historyData.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending">
                        <DataTable
                            data={pendingData}
                            columns={pendingColumns}
                            searchFields={['issueNo', 'indenterName', 'product']}
                            dataLoading={storeOutLoading}
                        />
                    </TabsContent>

                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['issueNo', 'indenterName', 'product']}
                            dataLoading={storeOutLoading}
                        />
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update Status</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sno" className="text-right">
                                S.No.
                            </Label>
                            <Input
                                id="sno"
                                value={selectedRow?.searialNumber || '-'}
                                disabled
                                className="col-span-3 bg-gray-100"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="issueNo" className="text-right">
                                Issue No
                            </Label>
                            <Input
                                id="issueNo"
                                value={selectedRow?.issueNo || '-'}
                                disabled
                                className="col-span-3 bg-gray-100"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="slip" className="text-right">
                                Slip (Col W)
                            </Label>
                            <Input
                                id="slip"
                                value={selectedRow?.slip || '-'}
                                disabled
                                className="col-span-3 bg-gray-100"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="appStatus" className="text-right">
                                Status (O)
                            </Label>
                            <Input
                                id="appStatus"
                                value={selectedRow?.approvalStatus || '-'}
                                disabled
                                className="col-span-3 bg-gray-100"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="qty" className="text-right">
                                Approve Qty
                            </Label>
                            <Input
                                id="qty"
                                value={selectedRow?.approveQty || '-'}
                                disabled
                                className="col-span-3 bg-gray-100"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="status" className="text-right">
                                Status
                            </Label>
                            <Select onValueChange={setStatus} value={status}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Done">Done</SelectItem>
                                    <SelectItem value="Not Done">Not Done</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting ? <Loader size={16} /> : 'Submit'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

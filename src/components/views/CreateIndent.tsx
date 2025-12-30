



import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { ClipLoader as Loader } from 'react-spinners';
import { ClipboardList, Trash, Search, Plus } from 'lucide-react'; // Plus ko import karo
import { postToSheet, uploadFile } from '@/lib/fetchers';
import type { IndentSheet, StoreOutSheet } from '@/types';
import { useSheets } from '@/context/SheetsContext';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';


export default () => {
    const { indentSheet: sheet, storeOutSheet, updateIndentSheet, updateStoreOutSheet, masterSheet: options } = useSheets();
    const [indentSheet, setIndentSheet] = useState<IndentSheet[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchTermGroupHead, setSearchTermGroupHead] = useState("");
    const [searchTermProductName, setSearchTermProductName] = useState("");
    const [newProductName, setNewProductName] = useState<{ [key: number]: string }>({});
    const [showAddProduct, setShowAddProduct] = useState<{ [key: number]: boolean }>({});
    const [localProducts, setLocalProducts] = useState<{ [key: string]: string[] }>({});
    const [searchTermCategory, setSearchTermCategory] = useState("");


    useEffect(() => {
        setIndentSheet(sheet);
    }, [sheet]);


    const schema = z.object({
        indenterName: z.string().optional(),
        indentApproveBy: z.string().optional(),
        indentType: z.enum(['Purchase', 'Store Out'], { required_error: 'Select a status' }),
        products: z
            .array(
                z.object({
                    department: z.string().nonempty(),
                    groupHead: z.string().optional(),
                    productName: z.string().optional(),
                    quantity: z.coerce.number().gt(0, 'Must be greater than 0'),
                    uom: z.string().nonempty(),
                    areaOfUse: z.string().nonempty(),
                    attachment: z.instanceof(File).optional(),
                    specifications: z.string().optional(),
                    // New fields for Store Out
                    floor: z.string().optional(),
                    wardName: z.string().optional(),
                    category: z.string().optional(),
                    issueDate: z.string().optional(),
                    requestedBy: z.string().optional(),
                })
            )
            .min(1, 'At least one product is required'),
    }).refine((data) => {
        if (data.indentType === 'Purchase') {
            return !!data.indenterName && !!data.indentApproveBy;
        }
        return true;
    }, {
        message: "Required for Purchase",
        path: ["indenterName"] // Shows on indenterName, but logic applies to both
    });


    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            indenterName: '',
            indentApproveBy: '',
            indentType: '' as any, // Change from undefined to ''
            products: [
                {
                    attachment: undefined,
                    uom: '',
                    productName: '',
                    specifications: '',
                    quantity: 1,
                    areaOfUse: '',
                    groupHead: '',
                    department: '',
                    // Initialize Store Out specific fields to avoid uncontrolled warnings
                    floor: '',
                    wardName: '',
                    category: '',
                    requestedBy: '',
                    issueDate: undefined,
                },
            ],
        },
    });


    const products = form.watch('products');
    const indentType = form.watch('indentType');
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'products',
    });


    // Function to generate next indent number
    const getNextIndentNumber = () => {
        if (indentSheet.length === 0) {
            return 'SI-0001';
        }

        const indentNumbers = indentSheet
            .map(row => row.indentNumber)
            .filter(num => num && num.startsWith('SI-'))
            .map(num => parseInt(num.replace('SI-', ''), 10))
            .filter(num => !isNaN(num));

        const maxNumber = Math.max(...indentNumbers, 0);
        const nextNumber = maxNumber + 1;

        return `SI-${String(nextNumber).padStart(4, '0')}`;
    };

    const getNextIssueNumber = () => {
        if (!storeOutSheet || storeOutSheet.length === 0) {
            return 'IS-001';
        }

        const issueNumbers = storeOutSheet
            .map(row => (row as any)['Issue No'] || row.issueNo || (row as any).issueNumber || (row as any).indentNumber)
            .filter(num => num && typeof num === 'string' && num.startsWith('IS-'))
            .map(num => parseInt(num.replace('IS-', ''), 10))
            .filter(num => !isNaN(num));

        const maxNumber = Math.max(...issueNumbers, 0);
        const nextNumber = maxNumber + 1;

        return `IS-${String(nextNumber).padStart(3, '0')}`;
    };


    // Better approach using image tag
    const submitProductToMasterSheet = (productName: string, groupHead: string) => {
        const MASTER_SHEET_URL = 'https://script.google.com/a/macros/jjspl.in/s/AKfycbyybfRgC2y9wLktUTQ9fTqp-qGMleFrj1c3pQJbLEQiMWr9-hNEaZyoqkWpeV9HF9Az/exec';

        const params = new URLSearchParams({
            sheetName: 'Items And Location',
            productName: productName,
            groupHead: groupHead
        });

        // Use image tag trick (no CORS issue)
        const img = new Image();
        img.src = `${MASTER_SHEET_URL}?${params.toString()}`;

        return Promise.resolve(true);
    };

    // Update addNewProductLocally - sync version
    const addNewProductLocally = (index: number, groupHead: string) => {
        const productName = newProductName[index]?.trim();

        if (!productName) {
            toast.error('Please enter a product name');
            return;
        }

        if (!groupHead) {
            toast.error('Please select a group head first');
            return;
        }

        // Add to local state
        setLocalProducts(prev => ({
            ...prev,
            [groupHead]: [...(prev[groupHead] || []), productName]
        }));

        // Set the value in form
        form.setValue(`products.${index}.productName`, productName);

        // Reset states
        setNewProductName(prev => ({ ...prev, [index]: '' }));
        setShowAddProduct(prev => ({ ...prev, [index]: false }));

        // Submit to master sheet
        submitProductToMasterSheet(productName, groupHead);

        toast.success('Product added successfully');
    };

    async function onSubmit(data: z.infer<typeof schema>) {
        try {
            const now = new Date();
            const day = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit' });
            const month = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: '2-digit' });
            const year = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric' });
            const time = now.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            const timestamp = `${day}/${month}/${year} ${time}`;
            const issueDate = `${day}/${month}/${year}`;

            if (data.indentType === 'Store Out') {
                // STORE OUT sheet submission
                const storeOutRows: Partial<StoreOutSheet>[] = [];
                let currentIssueNumber = getNextIssueNumber();

                for (let i = 0; i < data.products.length; i++) {
                    const product = data.products[i];
                    if (i > 0) {
                        const lastNumber = parseInt(currentIssueNumber.replace('IS-', ''), 10);
                        currentIssueNumber = `IS-${String(lastNumber + 1).padStart(3, '0')}`;
                    }

                    // const storeOutRow: Partial<StoreOutSheet> = {
                    //     timestamp: timestamp,
                    //     // Match Column B: Issue No
                    //     issueNo: currentIssueNumber,
                    //     indentNumber: currentIssueNumber,
                    //     // Match Column C: Issue Date
                    //     issueDate: product.issueDate ? formatDate(new Date(product.issueDate)) : issueDate,
                    //     // Match Column D: Requested By
                    //     requestedBy: product.requestedBy || data.indenterName || '',
                    //     // Match Column E: Floor
                    //     floor: product.floor || '',
                    //     // Match Column F: Ward Name
                    //     wardName: product.wardName || '',
                    //     // Match Column G: Qty
                    //     qty: Number(product.quantity) || 0,
                    //     quantity: Number(product.quantity) || 0,
                    //     // Match Column H: Unit
                    //     unit: product.uom || '',
                    //     uom: product.uom || '',
                    //     // Match Column I: Department
                    //     department: product.department || '',
                    //     // Match Column J: Category
                    //     category: product.category || '',
                    //     groupHead: product.category || '',
                    //     // Match Product Name (Missing in previous version but required)
                    //     productName: product.productName || '',
                    //     // Match Column K: Area Of Use
                    //     areaOfUse: product.areaOfUse || '',
                    //     // App Specific
                    //     indentType: 'Store Out'
                    // };


                    // Using camelCase keys that backend expects
                    const storeOutRow: any = {
                        timestamp: timestamp,
                        issueNo: currentIssueNumber,
                        issueDate: product.issueDate ? formatDate(new Date(product.issueDate)) : issueDate,
                        indenterName: data.indenterName || '',
                        indentType: data.indentType || 'Store Out',
                        approvalNeeded: data.indentApproveBy || '',
                        requestedBy: product.requestedBy || data.indenterName || '',
                        floor: product.floor || '',
                        wardName: product.wardName || '',
                        qty: Number(product.quantity) || 0,
                        unit: product.uom || '',
                        department: product.department || '',
                        category: product.category || '',
                        areaOfUse: product.areaOfUse || '',
                        productName: product.productName || '',
                        planned: '',  // Empty for now, will be filled during approval
                        actual: '',   // Empty for now, will be filled during approval
                        timeDelay: '',
                        status: '',
                        approveQty: ''
                    };


                    storeOutRows.push(storeOutRow);
                }

                console.log("=== FINAL ALIGNED PAYLOAD ===");
                console.log(JSON.stringify(storeOutRows, null, 2));

                const res = await postToSheet(storeOutRows, 'insert', 'STORE OUT');
                console.log("Response:", res);

                if (res.success) {
                    toast.success(`Store Out created! Issue No: ${storeOutRows.map(r => r.issueNo).join(', ')}`);
                    setTimeout(() => updateStoreOutSheet(), 1000);
                } else {
                    toast.error(res.message || 'Failed to create Store Out');
                }

            } else {
                // INDENT sheet submission (Purchase type)
                const indentRows: Partial<IndentSheet>[] = [];
                let currentIndentNumber = getNextIndentNumber();

                for (let i = 0; i < data.products.length; i++) {
                    const product = data.products[i];
                    if (i > 0) {
                        const lastNumber = parseInt(currentIndentNumber.replace('SI-', ''), 10);
                        currentIndentNumber = `SI-${String(lastNumber + 1).padStart(4, '0')}`;
                    }

                    const row: Partial<IndentSheet> = {
                        timestamp: timestamp,
                        indentNumber: currentIndentNumber,
                        indenterName: data.indenterName || '',
                        department: product.department || '',
                        areaOfUse: product.areaOfUse || '',
                        groupHead: product.groupHead || '',
                        productName: product.productName || '',
                        quantity: Number(product.quantity) || 0,
                        uom: product.uom || '',
                        specifications: product.specifications || '',
                        indentApprovedBy: data.indentApproveBy || '',
                        indentType: data.indentType || 'Purchase',
                        attachment: '',
                    };

                    if (product.attachment !== undefined) {
                        row.attachment = await uploadFile(
                            product.attachment,
                            import.meta.env.VITE_IDENT_ATTACHMENT_FOLDER
                        );
                    }
                    indentRows.push(row);
                }

                console.log("=== INDENT SUBMISSION ===");
                console.log("Rows to submit:", JSON.stringify(indentRows, null, 2));

                const res = await postToSheet(indentRows, 'insert', 'INDENT');
                console.log("Response:", res);

                if (res.success) {
                    toast.success(`Purchase indent created! Indent No: ${indentRows.map(r => r.indentNumber).join(', ')}`);
                    setTimeout(() => updateIndentSheet(), 1000);
                } else {
                    toast.error(res.message || 'Failed to create indent');
                }
            }

            form.reset();
            setLocalProducts({});
            setNewProductName({});
            setShowAddProduct({});

        } catch (error) {
            console.error('=== SUBMIT ERROR ===');
            console.error('Error:', error);
            toast.error(`Error: ${error instanceof Error ? error.message : 'Please try again'}`);
        }
    }



    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }


    return (
        <div>
            <Heading heading="Indent Form" subtext="Create new Indent">
                <ClipboardList size={50} className="text-primary" />
            </Heading>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6 p-5">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <FormField
                            control={form.control}
                            name="indenterName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Indenter Name
                                        <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter indenter name" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />


                        <FormField
                            control={form.control}
                            name="indentType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Indent Type
                                        <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Purchase">Purchase</SelectItem>
                                            <SelectItem value="Store Out">Store Out</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />


                        <FormField
                            control={form.control}
                            name="indentApproveBy"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        {indentType === 'Store Out' ? 'Approval Needed' : 'Approved By'}
                                        <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input placeholder={indentType === 'Store Out' ? "Enter approval needed" : "Enter approved by"} {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>


                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Products</h2>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    append({
                                        department: '',
                                        groupHead: '',
                                        productName: '',
                                        quantity: 1,
                                        uom: '',
                                        areaOfUse: '',
                                        // @ts-ignore
                                        priority: undefined,
                                        attachment: undefined,
                                        // Initialize Store Out specific fields
                                        floor: '',
                                        wardName: '',
                                        category: '',
                                        requestedBy: '',
                                        issueDate: undefined,
                                    })
                                }
                            >
                                Add Product
                            </Button>
                        </div>


                        {fields.map((field, index) => {
                            const groupHead = indentType === 'Store Out' ? products[index]?.category : products[index]?.groupHead;

                            // Combine master sheet products + local products
                            const masterProducts = options?.groupHeads[groupHead] || [];
                            const localGroupProducts = localProducts[groupHead] || [];
                            const productOptions = [...masterProducts, ...localGroupProducts];


                            return (
                                <div
                                    key={field.id}
                                    className="flex flex-col gap-4 border p-4 rounded-lg"
                                >
                                    <div className="flex justify-between">
                                        <h3 className="text-md font-semibold">
                                            Product {index + 1}
                                        </h3>
                                        <Button
                                            variant="destructive"
                                            type="button"
                                            onClick={() => fields.length > 1 && remove(index)}
                                            disabled={fields.length === 1}
                                        >
                                            <Trash />
                                        </Button>
                                    </div>
                                    <div className="grid gap-4">
                                        <div className={`grid grid-cols-1 ${indentType === 'Store Out' ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.department`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Department<span className="text-destructive">*</span></FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 opacity-50" />
                                                                    <input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="flex h-10 w-full bg-transparent text-sm outline-none" />
                                                                </div>
                                                                {options?.departments.filter(d => d.toLowerCase().includes(searchTerm.toLowerCase())).map((d, i) => (
                                                                    <SelectItem key={i} value={d}>{d}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {indentType === 'Store Out' && (
                                                <>
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.floor`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Floor<span className="text-destructive">*</span></FormLabel>
                                                                <FormControl><Input placeholder="Enter floor" {...field} /></FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.wardName`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Ward Name<span className="text-destructive">*</span></FormLabel>
                                                                <FormControl><Input placeholder="Enter ward name" {...field} /></FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.issueDate`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Issue Date<span className="text-destructive">*</span></FormLabel>
                                                                <FormControl><Input type="date" {...field} /></FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name={`products.${index}.requestedBy`}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Requested By<span className="text-destructive">*</span></FormLabel>
                                                                <FormControl><Input placeholder="Requested by" {...field} /></FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </>
                                            )}

                                            <FormField
                                                control={form.control}
                                                name={indentType === 'Store Out' ? `products.${index}.category` : `products.${index}.groupHead`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>{indentType === 'Store Out' ? 'Category' : 'Group Head'}<span className="text-destructive">*</span></FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger><SelectValue placeholder={`Select ${indentType === 'Store Out' ? 'category' : 'group head'}`} /></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <div className="flex items-center border-b px-3 pb-3">
                                                                    <Search className="mr-2 h-4 w-4 opacity-50" />
                                                                    <input placeholder="Search..." value={indentType === 'Store Out' ? searchTermCategory : searchTermGroupHead} onChange={(e) => indentType === 'Store Out' ? setSearchTermCategory(e.target.value) : setSearchTermGroupHead(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="flex h-10 w-full bg-transparent text-sm outline-none" />
                                                                </div>
                                                                {Object.keys(options?.groupHeads || {}).filter(k => k.toLowerCase().includes(indentType === 'Store Out' ? searchTermCategory.toLowerCase() : searchTermGroupHead.toLowerCase())).map((k, i) => (
                                                                    <SelectItem key={i} value={k}>{k}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {indentType !== 'Store Out' && (
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.productName`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Product Name<span className="text-destructive">*</span></FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value} disabled={!groupHead}>
                                                                <FormControl><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger></FormControl>
                                                                <SelectContent>
                                                                    <div className="flex items-center border-b px-3 pb-3">
                                                                        <Search className="mr-2 h-4 w-4 opacity-50" />
                                                                        <input placeholder="Search..." value={searchTermProductName} onChange={(e) => setSearchTermProductName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="flex h-10 w-full bg-transparent text-sm outline-none" />
                                                                    </div>
                                                                    {!showAddProduct[index] && (
                                                                        <div className="flex items-center px-3 py-2 cursor-pointer hover:bg-accent" onClick={() => setShowAddProduct(prev => ({ ...prev, [index]: true }))}>
                                                                            <Plus className="mr-2 h-4 w-4" /><span className="text-sm font-medium">Add New Product</span>
                                                                        </div>
                                                                    )}
                                                                    {showAddProduct[index] && (
                                                                        <div className="flex items-center gap-2 px-3 py-2 border-b">
                                                                            <Input placeholder="New product" value={newProductName[index] || ''} onChange={(e) => setNewProductName(prev => ({ ...prev, [index]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNewProductLocally(index, groupHead!))} />
                                                                            <Button type="button" size="sm" onClick={() => addNewProductLocally(index, groupHead!)}>Add</Button>
                                                                        </div>
                                                                    )}
                                                                    {productOptions.filter(p => p.toLowerCase().includes(searchTermProductName.toLowerCase())).map((p, i) => (
                                                                        <SelectItem key={i} value={p}>{p}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            )}

                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.quantity`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Quantity<span className="text-destructive">*</span></FormLabel>
                                                        <FormControl><Input type="number" {...field} /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.uom`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>UOM<span className="text-destructive">*</span></FormLabel>
                                                        <FormControl><Input {...field} placeholder="e.g. Pcs, Kgs" /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`products.${index}.areaOfUse`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Area Of Use<span className="text-destructive">*</span></FormLabel>
                                                        <FormControl><Input placeholder="Enter area of use" {...field} /></FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {indentType !== 'Store Out' && (
                                            <>
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.attachment`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Attachment</FormLabel>
                                                            <FormControl><Input type="file" onChange={(e) => field.onChange(e.target.files?.[0])} /></FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name={`products.${index}.specifications`}
                                                    render={({ field }) => (
                                                        <FormItem className="w-full">
                                                            <FormLabel>Specifications</FormLabel>
                                                            <FormControl><Textarea placeholder="Enter specifications" className="resize-y" {...field} /></FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>


                    <div>
                        <Button
                            className="w-full"
                            type="submit"
                            disabled={form.formState.isSubmitting}
                        >
                            {form.formState.isSubmitting && (
                                <Loader size={20} color="white" aria-label="Loading Spinner" />
                            )}
                            Create Indent
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
};

// Helper function to directly insert Store Out data to Google Sheets
// This bypasses the backend's getCamelCaseHeaders issue

export async function insertStoreOutDirect(rows: any[]) {
    try {
        console.log("=== insertStoreOutDirect called ===");
        console.log("Rows:", rows);

        // Convert camelCase to array format matching column positions
        const formattedRows = rows.map(row => {
            // Column order matches STORE OUT sheet (A to P)
            return [
                row.timestamp || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),  // A: Timestamp
                row.issueNo || '',          // B: Issue No
                row.issueDate || '',        // C: Issue Date
                row.requestedBy || '',      // D: Requested By
                row.floor || '',            // E: Floor
                row.wardName || '',         // F: Ward Name
                Number(row.qty) || 0,       // G: Qty
                row.unit || '',             // H: Unit
                row.department || '',       // I: Department
                row.category || '',         // J: Category
                row.areaOfUse || '',        // K: Area Of Use
                row.planned || '',          // L: Planned
                row.actual || '',           // M: Actual
                Number(row.timeDelay) || 0, // N: Time Delay
                row.status || '',           // O: Status
                Number(row.approveQty) || 0, // P: Approve Qty
                '',                         // Q: Index 16
                '',                         // R: Index 17
                '',                         // S: Index 18
                row.category || '',         // T: Group of head (Index 19)
                row.productName || ''       // U: Product Name (Index 20)
            ];
        });

        console.log("Formatted rows (array format):", formattedRows);

        const form = new FormData();
        form.append('action', 'insertStoreOutDirect');
        form.append('sheetName', 'STORE OUT');
        form.append('rows', JSON.stringify(formattedRows));

        const response = await fetch(import.meta.env.VITE_APP_SCRIPT_URL, {
            method: 'POST',
            body: form,
            redirect: 'follow',
        });

        if (!response.ok) {
            throw new Error(`Failed to insert Store Out data: ${response.statusText}`);
        }

        const res = await response.json();

        if (!res.success) {
            throw new Error(res.message || res.error || 'Failed to insert Store Out data');
        }

        return res;
    } catch (error) {
        console.error("Error in insertStoreOutDirect:", error);
        throw error;
    }
}

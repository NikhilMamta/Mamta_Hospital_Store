import type { ReactNode } from 'react';
import { SidebarTrigger } from '../ui/sidebar';
import { TabsList, TabsTrigger } from '../ui/tabs';

interface HeaderProps {
    children: ReactNode;
    heading: string;
    subtext: string;
    tabs?: boolean;
}

export default ({ children, heading, subtext, tabs = false }: HeaderProps) => {
    return (
        <div className="bg-gradient-to-br from-green-100 via-amber-50 to-green-50 rounded-md">
            <div className="flex justify-between p-5">
                <div className="flex gap-2 items-center">
                    {children}
                    <div>
                        <h1 className="text-2xl font-bold text-primary">{heading}</h1>
                        <p className="text-muted-foreground text-sm">{subtext}</p>
                    </div>
                </div>
                <SidebarTrigger />
            </div>
            {tabs && (
                <TabsList className="w-full rounded-none bg-transparent rounded-b-md">
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
            )}
        </div>
    );
};

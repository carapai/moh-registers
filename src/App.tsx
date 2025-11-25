import { useDataEngine } from "@dhis2/app-runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ConfigProvider, App } from "antd";
import React, { FC } from "react";
import { router } from "./router";
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            retry: false,
        },
    },
});

const Registers: FC = () => {
    const engine = useDataEngine();
    return (
        <ConfigProvider>
            <App>
                <QueryClientProvider client={queryClient}>
                    <RouterProvider router={router} context={{ engine }} />
                </QueryClientProvider>
            </App>
        </ConfigProvider>
    );
};

export default Registers;

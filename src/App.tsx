import { useDataEngine } from "@dhis2/app-runtime";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { App, ConfigProvider } from "antd";
import React, { FC } from "react";
import { queryClient } from "./query-client";
import { router } from "./router";
import "./app.css";
const Registers: FC = () => {
    const engine = useDataEngine();
    return (
        <ConfigProvider
            theme={{
                components: {
                    Table: {
                        rowHoverBg: "#F1EFFD",
                        borderRadius: 0,
                        headerBorderRadius: 0,
                    },
                    Card: {
                        borderRadius: 0,
												
                    },
                },
                token: {
                    fontSize: 16,
										borderRadius: 0,
                },
            }}
        >
            <App>
                <QueryClientProvider client={queryClient}>
                    <RouterProvider router={router} context={{ engine }} />
                </QueryClientProvider>
            </App>
        </ConfigProvider>
    );
};

export default Registers;

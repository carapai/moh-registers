import { useDataEngine } from "@dhis2/app-runtime";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { App, ConfigProvider } from "antd";
import React, { FC } from "react";
import { queryClient } from "./query-client";
import { router } from "./router";
import "./app.css";
import { OrgUnit } from "./schemas";
import { resourceQueryOptions } from "./query-options";
import { Spinner } from "./components/Spinner";

const Main = () => {
    const engine = useDataEngine();
    const { data, error, isError, isLoading } = useQuery(
        resourceQueryOptions<{
            organisationUnits: OrgUnit[];
            id: string;
        }>({
            engine,
            resource: "me",
            params: {
                fields: "id,organisationUnits[id,name,level,parent,leaf]",
            },
        }),
    );
    if (isError) return <div>Error: {String(error)}</div>;
    if (isLoading) return <Spinner />;

    if (data && data.organisationUnits.length > 0)
        return (
            <RouterProvider
                router={router}
                context={{
                    engine,
                    orgUnit: data.organisationUnits[0],
                }}
            />
        );
    return null;
};
const Registers: FC = () => {
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
                    // borderRadius: 0,
                },
            }}
        >
            <App>
                <QueryClientProvider client={queryClient}>
                    <Main />
                </QueryClientProvider>
            </App>
        </ConfigProvider>
    );
};

export default Registers;

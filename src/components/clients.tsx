import { Outlet } from "@tanstack/react-router";
import { Flex } from "antd";
import React, { useEffect } from "react";
import OrgUnitTreeSelect from "../components/tree-select";
import { RootRoute } from "../routes/__root";
import { ClientsRoute } from "../routes/clients";
export default function Clients() {
    const navigate = ClientsRoute.useNavigate();
    const { orgUnits } = ClientsRoute.useSearch();
    const { organisationUnits } = RootRoute.useLoaderData();
    // useEffect(() => {
    //     if (organisationUnits.length === 1 && organisationUnits.at(0)?.leaf) {
    //         navigate({
    //             search: { orgUnits: organisationUnits.at(0)?.id },
    //         });
    //     }
    // }, [organisationUnits]);
    return (
        <Flex vertical gap="16px">
            <OrgUnitTreeSelect
                onChange={(value) => {
                    // navigate({ search: { orgUnits: value } });
                }}
                value={orgUnits}
            />
            <Outlet />
        </Flex>
    );
}
